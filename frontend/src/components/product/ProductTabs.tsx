"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Star, MessageSquare, FileText, ListChecks, CheckCircle, AlertCircle, User, Calendar, Send, Loader2, ChevronDown, PenLine, X } from "lucide-react";
import { Product } from "@/services/productService";
import { reviewService, Review } from "@/services/reviewService";
import { useAuth } from "@/hooks/useAuth";
import { demoteH1ToH2 } from "@/lib/seo";
import { normalizeDescriptionRoot } from "@/lib/productDescription";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import Link from "next/link";
import "./product-details.css";

type Section = "desc" | "specs" | "reviews";

const sectionIds: Record<Section, string> = {
    specs: "product-info",
    desc: "product-description",
    reviews: "pdp-comments",
};

const specPreviewCount = 6;

interface ProductTabsProps {
    product: Product;
    activeTab: Section;
    onTabChange: (tab: Section) => void;
    purchaseSummary: ReactNode;
}

// The storefront's structured product template (header / intro / 01..06 cards /
// applications / technical table) is styled entirely with inline CSS. Detecting
// it lets us skip the Quill style-stripping pass that would flatten it.
const STRUCTURED_TEMPLATE_RE = /(background:\s*#f9fafb|font-family:\s*Tahoma|محصول\s*حرفه)/i;
const isStructuredTemplate = (html: string) => STRUCTURED_TEMPLATE_RE.test(html);

const SPEC_HEADING = "مشخصات\\s*فنی";

/**
 * Remove a leftover trailing «مشخصات فنی» block (comment + container + heading +
 * table). Products created before the backend cleanup may still ship it, and it
 * duplicates the dedicated specs tab.
 */
const stripSpecificationBlock = (html: string): string => {
    let out = html;

    // comment + container div + heading + table
    out = out.replace(
        new RegExp(`<!--\\s*Technical\\s+Specifications\\s*-->\\s*<div\\b[^>]*>\\s*<h[1-6]\\b[^>]*>\\s*${SPEC_HEADING}\\s*<\\/h[1-6]>[\\s\\S]*?<\\/table>\\s*<\\/div>`, "gi"),
        "",
    );
    // container div + heading + table
    out = out.replace(
        new RegExp(`<div\\b[^>]*>\\s*<h[1-6]\\b[^>]*>\\s*${SPEC_HEADING}\\s*<\\/h[1-6]>[\\s\\S]*?<\\/table>\\s*<\\/div>`, "gi"),
        "",
    );
    // heading + table without a dedicated container
    out = out.replace(
        new RegExp(`<h[1-6]\\b[^>]*>\\s*${SPEC_HEADING}\\s*<\\/h[1-6]>\\s*<table\\b[\\s\\S]*?<\\/table>`, "gi"),
        "",
    );

    return out.trim();
};

export default function ProductTabs({ product, activeTab, onTabChange, purchaseSummary }: ProductTabsProps) {
    const specs = product.specs ?? [];
    const hasSpecs = specs.length > 0;
    const hasDescription = Boolean(product.description?.trim());
    const [currentSection, setCurrentSection] = useState<Section>(hasSpecs ? "specs" : hasDescription ? "desc" : "reviews");
    const [specsExpanded, setSpecsExpanded] = useState(false);
    const [reviewFormOpen, setReviewFormOpen] = useState(false);
    const desktopNavRef = useRef<HTMLElement>(null);
    const reviewSectionRef = useRef<HTMLElement>(null);
    const specToggleRef = useRef<HTMLButtonElement>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(Boolean(product.reviewCount));
    const [reviewTotal, setReviewTotal] = useState(product.reviewCount ?? 0);
    const [reviewLoadError, setReviewLoadError] = useState(false);
    const reviewsRequested = useRef(false);

    useEffect(() => {
        const sectionId = window.location.hash.slice(1);
        if (!Object.values(sectionIds).includes(sectionId)) return;
        const frame = window.requestAnimationFrame(() => {
            // The product route restores scroll during mount. Apply an explicit
            // section link after that so shared desktop URLs open at the section.
            const section = document.getElementById(sectionId);
            if (desktopNavRef.current?.getClientRects().length && section?.getClientRects().length) {
                section.scrollIntoView();
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const nav = desktopNavRef.current;
        if (!nav) return;
        const sections = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[data-section]"))
            .map((link) => ({ name: link.dataset.section as Section, element: document.getElementById(link.hash.slice(1)) }));
        const lastSection = sections[sections.length - 1];
        const sectionsFromEnd = [...sections].reverse();
        let frame = 0;
        const updateSection = () => {
            frame = 0;
            if (!nav.getClientRects().length) return;
            const threshold = nav.getBoundingClientRect().bottom + 32;
            const visibleSection = sectionsFromEnd.find(({ element }) => element && element.getBoundingClientRect().top <= threshold);
            const nearPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
            const atEnd = nearPageEnd && lastSection?.element && lastSection.element.getBoundingClientRect().top < window.innerHeight;
            // The browser can clamp two nearby anchors to the same scroll position.
            const linkedSection = atEnd && sections.find(({ element }) => {
                if (!element || `#${element.id}` !== window.location.hash) return false;
                const bounds = element.getBoundingClientRect();
                return bounds.bottom > threshold && bounds.top < window.innerHeight;
            });
            const active = linkedSection || (atEnd ? lastSection : visibleSection ?? sections[0]);
            if (active) setCurrentSection(active.name);
        };
        const scheduleUpdate = () => {
            if (!frame) frame = window.requestAnimationFrame(updateSection);
        };
        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);
        window.addEventListener("hashchange", scheduleUpdate);
        scheduleUpdate();
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", scheduleUpdate);
            window.removeEventListener("resize", scheduleUpdate);
            window.removeEventListener("hashchange", scheduleUpdate);
        };
    }, [hasDescription, hasSpecs, specsExpanded]);

    // Helper to format Quill/RichText HTML automatically into structured layout
    const transformQuillHtml = (html: string) => {
        if (!html) return "";

        let cleaned = html;

        // 1. Decode HTML entities if string is double encoded
        cleaned = cleaned
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');

        // 1b. SEO: demote <h1> inside CMS product copy to <h2>. The PDP already
        // renders exactly one <h1> (the product name); extra h1s coming from
        // rich-text descriptions would create duplicate h1s on the page.
        cleaned = demoteH1ToH2(cleaned);

        // 1c. Remove any leftover "Technical Specifications" block. New products
        // already store a cleaned description, but older rows in the database may
        // still carry the trailing container/heading/table, which duplicates the
        // dedicated specs tab and leaves an empty white box.
        cleaned = stripSpecificationBlock(cleaned);

        // 1d. The storefront's structured product template must keep ALL inline
        // styles (backgrounds, colours, the 01..06 cards, table layout). The
        // Quill-normalisation below would destroy them, so return as-is — after
        // releasing any pixel width pinned on the article's root, which would
        // otherwise shrink the whole description into a narrow centred card
        // inside the (much wider) product-page column.
        if (isStructuredTemplate(cleaned)) return sanitizeRichHtml(normalizeDescriptionRoot(cleaned));

        // 2. Strip inline background-color and color styles completely
        cleaned = cleaned.replace(/style="([^"]*)"/gi, (match, p1) => {
            const cleanStyle = p1
                .replace(/background-color\s*:\s*[^;"]*;?/gi, '')
                .replace(/color\s*:\s*[^;"]*;?/gi, '')
                .replace(/font-family\s*:\s*[^;"]*;?/gi, '')
                .trim();
            return cleanStyle ? `style="${cleanStyle}"` : '';
        });

        // Also clean style inside inner tags like <span style="..."> or <strong style="...">
        cleaned = cleaned
            .replace(/<span[^>]*style="[^"]*"[^>]*>/gi, '<span>')
            .replace(/<strong[^>]*style="[^"]*"[^>]*>/gi, '<strong>');

        // 3. Match 3-element pattern in Quill HTML (01..99):
        // Pattern 1: <p...>01</p> <p...>Title</p> <p...>Desc</p>
        const pattern1 = /<p[^>]*>\s*(?:<[^>]+>)*\s*(\d{2})\s*(?:<\/[^>]+>)*\s*<\/p>\s*<p[^>]*>(.*?)<\/p>\s*<p[^>]*>(.*?)<\/p>/gi;

        // Pattern 2: <p...>Title</p> <p...>Desc</p> <p...>01</p>
        const pattern2 = /<p[^>]*>(.*?)<\/p>\s*<p[^>]*>(.*?)<\/p>\s*<p[^>]*>\s*(?:<[^>]+>)*\s*(\d{2})\s*(?:<\/[^>]+>)*\s*<\/p>/gi;

        const renderCard = (num: string, title: string, desc: string) => {
            const cleanTitle = title.replace(/<\/?(?:strong|span|p)[^>]*>/gi, '').trim();
            const cleanDesc = desc.replace(/<\/?(?:span|p)[^>]*>/gi, '').trim();
            if (!cleanTitle || !cleanDesc) return '';
            return `
            <div class="my-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex justify-between items-start gap-4 shadow-sm text-right dir-rtl" dir="rtl">
                <div class="flex-1 text-right">
                    <div class="font-bold text-slate-900 text-base mb-1">${cleanTitle}</div>
                    <div class="text-slate-600 text-sm leading-relaxed">${cleanDesc}</div>
                </div>
                <span class="bg-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1 rounded-md shrink-0">${num}</span>
            </div>
            `.trim();
        };

        if (pattern1.test(cleaned)) {
            cleaned = cleaned.replace(pattern1, (m, num, title, desc) => renderCard(num, title, desc) || m);
        } else {
            cleaned = cleaned.replace(pattern2, (m, title, desc, num) => renderCard(num, title, desc) || m);
        }

        // 4. Transform Specs pairs: <p...><strong>Label</strong></p> <p...><span>Value</span></p>
        const specsPairRegex = /<p[^>]*>\s*<strong[^>]*>(.*?)<\/strong>\s*<\/p>\s*<p[^>]*>\s*<span[^>]*>(.*?)<\/span>\s*<\/p>/gi;

        cleaned = cleaned.replace(specsPairRegex, (match, label, value) => {
            return `
            <div class="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/60 border border-slate-100 rounded-lg my-1.5 text-sm text-right dir-rtl" dir="rtl">
                <span class="font-bold text-slate-800 mb-1 sm:mb-0">${label}</span>
                <span class="text-slate-600">${value}</span>
            </div>
            `.trim();
        });

        return sanitizeRichHtml(cleaned);
    };


    // Form State
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const { isAuthenticated } = useAuth();

    const fetchReviews = useCallback(async () => {
        try {
            reviewsRequested.current = true;
            setReviewLoadError(false);
            setLoadingReviews(true);
            const res = await reviewService.getProductReviews(product.id);
            setReviews(res.data);
            setReviewTotal(res.pagination.total);
        } catch (err) {
            setReviewLoadError(true);
            console.error("Error fetching reviews", err);
        } finally {
            setLoadingReviews(false);
        }
    }, [product.id]);

    useEffect(() => {
        if (activeTab === "reviews" && !reviewsRequested.current) void fetchReviews();
    }, [activeTab, fetchReviews]);

    useEffect(() => {
        const section = reviewSectionRef.current;
        if (!section || reviewsRequested.current) return;
        if (typeof IntersectionObserver === "undefined") {
            if (desktopNavRef.current?.getClientRects().length) void fetchReviews();
            return;
        }
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !reviewsRequested.current) void fetchReviews();
        }, { rootMargin: "0px 0px 200px" });
        observer.observe(section);
        return () => observer.disconnect();
    }, [fetchReviews]);

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rating || !comment.trim()) return;

        try {
            setSubmitting(true);
            setSubmitError("");
            await reviewService.addReview(product.id, rating, comment);
            setSubmitSuccess(true);
            setComment("");
            setRating(5);
        } catch (err: any) {
            setSubmitError(err.response?.data?.message || "خطا در ثبت دیدگاه");
        } finally {
            setSubmitting(false);
        }
    };

    const desktopSections: { name: Section; label: string }[] = [];
    if (hasSpecs) desktopSections.push({ name: "specs", label: "مشخصات فنی" });
    if (hasDescription) desktopSections.push({ name: "desc", label: "توضیحات محصول" });
    desktopSections.push({ name: "reviews", label: "دیدگاه‌ها" });

    const mobileTabs: { name: Section; label: string }[] = [
        { name: "desc", label: "توضیحات" },
        { name: "specs", label: "مشخصات فنی" },
        { name: "reviews", label: `دیدگاه‌ها (${reviewTotal.toLocaleString("fa-IR")})` },
    ];
    const handleSpecsToggle = () => {
        const previousTop = specToggleRef.current?.getBoundingClientRect().top ?? 0;
        setSpecsExpanded(!specsExpanded);
        if (specsExpanded) {
            requestAnimationFrame(() => {
                const toggle = specToggleRef.current;
                if (toggle && toggle.getBoundingClientRect().top < (desktopNavRef.current?.getBoundingClientRect().bottom ?? 0)) {
                    toggle.scrollIntoView({ block: previousTop < window.innerHeight ? "center" : "nearest" });
                }
            });
        }
    };

    return (
        <article id="product-details" className="product-details" aria-label="جزئیات محصول">
            <nav ref={desktopNavRef} className="product-details__nav" aria-label="بخش‌های جزئیات محصول">
                {desktopSections.map(({ name, label }) => (
                    <a key={name} href={`#${sectionIds[name]}`} data-section={name} aria-current={currentSection === name ? "location" : undefined}>
                        {label}
                    </a>
                ))}
            </nav>

            <div className="product-details__mobile-tabs" aria-label="بخش‌های جزئیات محصول">
                {mobileTabs.map(({ name, label }) => (
                    <button
                        type="button"
                        key={name}
                        aria-pressed={activeTab === name}
                        aria-controls={sectionIds[name]}
                        onClick={(event) => {
                            onTabChange(name);
                            event.currentTarget.closest("article")?.scrollIntoView?.({ block: "start" });
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="product-details__layout">
                <div className="product-details__content">
                    <section id={sectionIds.specs} aria-labelledby="product-specs-heading" className="product-details__section" data-mobile-active={activeTab === "specs"} data-empty={!hasSpecs}>
                        <h2 id="product-specs-heading" className="product-details__heading"><ListChecks size={20} aria-hidden="true" /> مشخصات فنی</h2>
                        {hasSpecs ? (
                            <>
                                <dl id="product-specs-list" className="product-details__specs" data-expanded={specsExpanded}>
                                    {specs.map((spec, index) => (
                                        <div key={`${spec.label}-${index}`} data-extra={index >= specPreviewCount}>
                                            <dt>{spec.label}</dt>
                                            <dd dir="auto">{spec.value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {specs.length > specPreviewCount && (
                                    <button ref={specToggleRef} type="button" className="product-details__spec-toggle product-details__desktop-only" aria-expanded={specsExpanded} aria-controls="product-specs-list" onClick={handleSpecsToggle}>
                                        {specsExpanded ? "نمایش کمتر" : "نمایش همهٔ مشخصات"}
                                        <ChevronDown size={18} aria-hidden="true" />
                                    </button>
                                )}
                            </>
                        ) : (
                            <p className="py-8 text-center text-gray-500">مشخصات فنی ثبت نشده است.</p>
                        )}
                    </section>

                    <section id={sectionIds.desc} aria-labelledby="product-description-heading" className="product-details__section" data-mobile-active={activeTab === "desc"} data-empty={!hasDescription}>
                        <h2 id="product-description-heading" className="product-details__heading">
                            <FileText size={20} aria-hidden="true" /> توضیحات محصول
                        </h2>
                        {product.description ? (
                            <div
                                className="text-ekg-700 leading-8 text-start [overflow-wrap:anywhere] overflow-x-auto
                                [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mb-3 [&_h2]:mt-5
                                [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-800 [&_h3]:mb-2 [&_h3]:mt-4
                                [&_h4]:text-base [&_h4]:font-bold [&_h4]:text-gray-800 [&_h4]:mb-2
                                [&_p]:mb-4
                                [&_ul]:list-disc [&_ul]:mr-6 [&_ul]:mb-4
                                [&_ol]:list-decimal [&_ol]:mr-6 [&_ol]:mb-4
                                [&_li]:mb-1
                                [&_img]:rounded-xl [&_img]:max-w-full [&_img]:h-auto [&_img]:my-6 [&_img]:mx-auto [&_img]:shadow-sm
                                [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_table]:text-sm
                                [&_td]:border [&_td]:border-gray-200 [&_td]:p-3
                                [&_th]:border [&_th]:border-gray-200 [&_th]:p-3 [&_th]:bg-gray-50 [&_th]:font-bold [&_th]:text-right
                                [&_a]:text-kala-600 [&_a]:underline [&_a]:font-medium hover:[&_a]:text-kala-700
                                [&_blockquote]:border-r-4 [&_blockquote]:border-gray-200 [&_blockquote]:pr-4 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:text-gray-500 [&_blockquote]:italic
                                [&_pre]:bg-gray-50 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre]:text-sm [&_pre]:font-mono
                                [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-pink-500
                                [&_.ql-align-center]:text-center [&_.ql-align-right]:text-right [&_.ql-align-left]:text-left [&_.ql-align-justify]:text-justify
                                [&_.ql-direction-rtl]:[direction:rtl]
                                "
                                dangerouslySetInnerHTML={{ __html: transformQuillHtml(product.description || "") }}
                            />
                        ) : (
                            <p className="text-gray-400 text-center py-8">توضیحاتی ثبت نشده است.</p>
                        )}
                    </section>

                    <section ref={reviewSectionRef} id={sectionIds.reviews} aria-labelledby="product-reviews-heading" className="product-details__section" data-mobile-active={activeTab === "reviews"}>
                        <h2 id="product-reviews-heading" className="product-details__heading"><MessageSquare size={20} aria-hidden="true" /> دیدگاه‌های کاربران</h2>
                        <div className="product-details__review-summary product-details__desktop-only">
                            <div className="product-details__review-rating">
                                <strong data-rated={product.rating > 0}>
                                    {product.rating > 0 ? product.rating.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) : "بدون امتیاز"}
                                </strong>
                                <div>
                                    <p>{reviewTotal.toLocaleString("fa-IR")} دیدگاه</p>
                                    <div className="product-details__review-stars" aria-hidden="true">
                                        {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={18} fill="currentColor" data-filled={star <= Math.round(product.rating || 0)} />)}
                                    </div>
                                </div>
                            </div>
                            <button type="button" className="product-details__review-button" aria-expanded={reviewFormOpen} aria-controls="product-review-form" onClick={() => setReviewFormOpen(!reviewFormOpen)}>
                                {reviewFormOpen ? <X size={16} aria-hidden="true" /> : <PenLine size={16} aria-hidden="true" />}
                                {reviewFormOpen ? "بستن فرم" : "نوشتن دیدگاه"}
                            </button>
                        </div>
                        <div className="product-details__reviews">
                            <div id="product-review-form" className="product-details__review-form" data-open={reviewFormOpen}>
                                <div className="bg-white border border-ekg-200 rounded-2xl p-4 sm:p-6">
                                    <h3 className="font-bold text-gray-900 mb-4">ثبت دیدگاه جدید</h3>

                                    {!isAuthenticated ? (
                                        <div className="bg-ekg-50 rounded-xl p-4 sm:p-6 text-center">
                                            <p className="text-ekg-700 text-sm mb-4">
                                                برای ثبت دیدگاه وارد حساب کاربری‌تان شوید.
                                            </p>
                                            <Link href="/login" className="inline-block px-6 py-2 bg-kala-700 text-white rounded-lg text-sm font-bold hover:bg-kala-800 transition-colors">
                                                ورود به حساب
                                            </Link>
                                        </div>
                                    ) : submitSuccess ? (
                                        <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
                                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <CheckCircle size={24} />
                                            </div>
                                            <h4 className="font-bold text-green-800 mb-2">دیدگاه شما ثبت شد</h4>
                                            <p className="text-green-600 text-sm">
                                                نظر شما با موفقیت ثبت شد و پس از تأیید مدیر نمایش داده خواهد شد.
                                            </p>
                                            <button
                                                onClick={() => setSubmitSuccess(false)}
                                                className="mt-4 text-sm text-green-700 font-bold hover:underline"
                                            >
                                                ثبت نظر دیگر
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmitReview} className="space-y-4">
                                            {submitError && (
                                                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                                                    <AlertCircle size={16} />
                                                    {submitError}
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">امتیاز شما</label>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => setRating(star)}
                                                            aria-label={`${star} ستاره`}
                                                            aria-pressed={rating === star}
                                                            className="transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-kala-500"
                                                        >
                                                            <Star
                                                                size={28}
                                                                className={`${star <= rating
                                                                    ? "fill-amber-400 text-amber-400"
                                                                    : "text-gray-200 hover:text-amber-200"
                                                                    } transition-colors`}
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                                <span className="text-xs text-gray-400 mt-1 block">
                                                    {rating === 5 ? "عالی" : rating === 4 ? "خوب" : rating === 3 ? "معمولی" : rating === 2 ? "بد" : "خیلی بد"}
                                                </span>
                                            </div>

                                            <div>
                                                <label htmlFor="product-review-comment" className="block text-sm font-bold text-gray-700 mb-2">متن دیدگاه</label>
                                                <textarea
                                                    id="product-review-comment"
                                                    value={comment}
                                                    onChange={(e) => setComment(e.target.value)}
                                                    rows={4}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-kala-500 focus:ring-2 focus:ring-kala-100 outline-none transition-all resize-none text-sm"
                                                    placeholder="نقاط قوت و ضعف محصول را بنویسید..."
                                                    required
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="w-full py-3 bg-kala-500 text-white rounded-xl font-bold hover:bg-kala-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={18} />
                                                        در حال ثبت...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={18} />
                                                        ثبت دیدگاه
                                                    </>
                                                )}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                            <div className="min-w-0">
                                {loadingReviews ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="animate-spin text-kala-500" size={32} />
                                    </div>
                                ) : reviewLoadError ? (
                                    <div role="status" className="product-details__review-empty">
                                        <p>بارگیری دیدگاه‌ها انجام نشد.</p>
                                        <button type="button" onClick={() => void fetchReviews()}>تلاش دوباره</button>
                                    </div>
                                ) : reviews.length > 0 ? (
                                    <div className="space-y-4">
                                        {reviews.map((review) => (
                                            <div key={review._id} className="bg-ekg-50 rounded-xl p-4 border border-ekg-100">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                                            <User size={16} />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-800 block">
                                                                {review.user?.name || "کاربر مهمان"}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                <Calendar size={10} />
                                                                {new Date(review.createdAt).toLocaleDateString('fa-IR')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-0.5">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                size={14}
                                                                className={
                                                                    star <= review.rating
                                                                        ? "fill-amber-400 text-amber-400"
                                                                        : "text-gray-300"
                                                                }
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-gray-600 text-sm leading-relaxed">
                                                    {review.comment}
                                                </p>
                                                {review.adminReply && (
                                                    <div className="mt-3 bg-white border-r-2 border-kala-500 p-3 rounded-l-lg text-sm">
                                                        <span className="text-kala-600 font-bold text-xs block mb-1">پاسخ ادمین:</span>
                                                        <p className="text-gray-600">{review.adminReply.message}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="product-details__review-empty text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <MessageSquare size={40} className="product-details__mobile-only mx-auto text-gray-300 mb-3" />
                                        <p className="text-ekg-700 font-medium">هنوز دیدگاهی برای این محصول ثبت نشده است.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="product-details__purchase" aria-label="خلاصهٔ خرید محصول">
                    {purchaseSummary}
                </aside>
            </div>
        </article>
    );
}
