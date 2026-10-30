"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, MessageSquare, Info, CheckCircle, AlertCircle, User, Calendar, Send, Loader2 } from "lucide-react";
import { Product } from "@/services/productService";
import { reviewService, Review } from "@/services/reviewService";
import { useAuth } from "@/hooks/useAuth";
import { demoteH1ToH2 } from "@/lib/seo";
import Link from "next/link";

interface ProductTabsProps {
    product: Product;
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

export default function ProductTabs({ product }: ProductTabsProps) {
    const [activeTab, setActiveTab] = useState<"desc" | "specs" | "reviews">("desc");
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [reviewStats, setReviewStats] = useState({ total: 0, avg: 0 });
    console.log("Review stats:", reviewStats);

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
        // Quill-normalisation below would destroy them, so return as-is.
        if (isStructuredTemplate(cleaned)) return cleaned;

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

        return cleaned;
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
            setLoadingReviews(true);
            const res = await reviewService.getProductReviews(product.id);
            setReviews(res.data);
            setReviewStats({
                total: res.pagination.total,
                avg: product.rating || 0 // Use product rating as source of truth for avg
            });
        } catch (err) {
            console.error("Error fetching reviews", err);
        } finally {
            setLoadingReviews(false);
        }
    }, [product.id, product.rating]);

    useEffect(() => {
        if (activeTab === "reviews") {
            fetchReviews();
        }
    }, [activeTab, fetchReviews]);

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

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden my-6">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab("desc")}
                    className={`flex-1 min-w-[120px] py-4 text-sm font-bold transition-colors relative ${activeTab === "desc" ? "text-kala-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    توضیحات
                    {activeTab === "desc" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-kala-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("specs")}
                    className={`flex-1 min-w-[120px] py-4 text-sm font-bold transition-colors relative ${activeTab === "specs" ? "text-kala-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    مشخصات فنی
                    {activeTab === "specs" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-kala-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("reviews")}
                    className={`flex-1 min-w-[120px] py-4 text-sm font-bold transition-colors relative ${activeTab === "reviews" ? "text-kala-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    دیدگاه‌ها ({product.reviewCount || 0})
                    {activeTab === "reviews" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-kala-500" />
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="p-6 min-h-[300px]">
                {activeTab === "desc" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Info size={20} className="text-kala-600" /> توضیحات محصول
                        </h3>
                        {product.description ? (
                            <div
                                className="text-gray-600 leading-8 text-justify 
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
                    </div>
                )}

                {activeTab === "specs" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Info size={20} className="text-kala-600" /> مشخصات فنی
                        </h3>
                        {product.specs && product.specs.length > 0 ? (
                            <div className="grid gap-0 border border-gray-100 rounded-xl overflow-hidden">
                                {product.specs.map((spec, i) => (
                                    <div
                                        key={i}
                                        className={`flex flex-col sm:flex-row p-4 ${i !== product.specs!.length - 1 ? "border-b border-gray-100" : ""
                                            } ${i % 2 === 0 ? "bg-gray-50/50" : "bg-white"}`}
                                    >
                                        <span className="text-gray-500 text-sm w-full sm:w-1/3 mb-1 sm:mb-0 font-medium">
                                            {spec.label}
                                        </span>
                                        <span className="text-gray-800 text-sm w-full sm:w-2/3 font-bold">
                                            {spec.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-xl">
                                <p className="text-gray-500">مشخصات فنی ثبت نشده است.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "reviews" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid md:grid-cols-12 gap-8">
                            {/* Reviews List */}
                            <div className="md:col-span-7 space-y-6">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <MessageSquare size={20} className="text-kala-600" />
                                    نظرات کاربران
                                </h3>

                                {loadingReviews ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="animate-spin text-kala-500" size={32} />
                                    </div>
                                ) : reviews.length > 0 ? (
                                    <div className="space-y-4">
                                        {reviews.map((review) => (
                                            <div key={review._id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
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
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-500 font-medium">هنوز دیدگاهی برای این محصول ثبت نشده است.</p>
                                        <p className="text-gray-400 text-sm mt-1">اولین نفری باشید که نظر می‌دهد!</p>
                                    </div>
                                )}
                            </div>

                            {/* Add Review Form */}
                            <div className="md:col-span-5">
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm sticky top-24">
                                    <h3 className="font-bold text-gray-900 mb-4">ثبت دیدگاه جدید</h3>

                                    {!isAuthenticated ? (
                                        <div className="bg-gray-50 rounded-xl p-6 text-center">
                                            <p className="text-gray-600 text-sm mb-4">
                                                برای ثبت نظر، لطفاً ابتدا وارد حساب کاربری خود شوید.
                                            </p>
                                            <Link href="/login" className="inline-block px-6 py-2 bg-kala-500 text-white rounded-lg text-sm font-bold hover:bg-kala-600 transition-colors">
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
                                                            className="transition-transform hover:scale-110 focus:outline-none"
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
                                                <label className="block text-sm font-bold text-gray-700 mb-2">متن دیدگاه</label>
                                                <textarea
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
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
