"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import {
    Send,
    Instagram,
    Video,
    Phone,
    MapPin,
    Clock,
    Mail,
    Loader2,
    CheckCircle,
    AlertCircle,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    Truck,
    Wrench,
    ShieldCheck,
    CreditCard,
    MessageCircle,
    Headphones,
    Award,
    Sparkles,
} from "lucide-react";
import { settingsService } from "@/services/settingsService";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useCategoryTree } from "@/hooks/useCategories";
import { CATEGORY_FILTER_HREF } from "@/lib/categoryNavigation";
import styles from "./Footer.module.css";

// Verified Enamad trust seal — kept static outside the component to avoid re-creation on render
const ENAMAD_HTML = `<a referrerpolicy='origin' target='_blank' rel='noopener noreferrer' href='https://trustseal.enamad.ir/?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' style='display:flex;align-items:center;justify-content:center;width:100%;height:100%;'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' alt='نماد اعتماد الکترونیکی ای‌کا‌جی کالا' onload="this.parentElement.style.backgroundColor='#ffffff';this.style.opacity='1';" onerror="this.style.opacity='0';" style='cursor:pointer;width:62px;height:62px;object-fit:contain;opacity:0;transition:opacity 0.2s ease;' code='VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6'></a>`;

interface StoreInfo {
    storeName?: string;
    storeEmail?: string;
    storePhone?: string;
    storeAddress?: string;
    socialLinks?: {
        telegram?: string;
        instagram?: string;
        aparat?: string;
    };
}

interface NavLinkItem {
    href: string;
    label: string;
}

interface NavColumn {
    id: string;
    title: string;
    links: NavLinkItem[];
}

const DEFAULT_CATEGORY_LINKS: NavLinkItem[] = [
    {
        href: `/products?category=${encodeURIComponent("دوربین-مداربسته-ipانالوگبیسیم")}&includeChildren=true`,
        label: "دوربین مداربسته IP و آنالوگ",
    },
    {
        href: `/products?category=${encodeURIComponent("دستگاه-ضبط-تصویر-dvrnvr")}&includeChildren=true`,
        label: "دستگاه ضبط تصویر DVR و NVR",
    },
    {
        href: `/products?category=${encodeURIComponent("تجهیزات-شبکه-مخصوص-cctv")}&includeChildren=true`,
        label: "تجهیزات شبکه و سوئیچ PoE",
    },
    { href: "/products", label: "مشاهده همه محصولات" },
    { href: CATEGORY_FILTER_HREF, label: "فیلتر هوشمند دسته‌بندی‌ها" },
];

const OFFICIAL_PARTNERS = [
    {
        brand: "Dahua",
        role: "نمایندگی انحصاری با گارانتی ماد طلایی",
        href: "/about",
    },
    {
        brand: "Sailgis",
        role: "نمایندگی رسمی سیستم‌های نظارتی",
        href: "/about",
    },
    {
        brand: "Suzuki",
        role: "نمایندگی رسمی محصولات حفاظتی",
        href: "/about",
    },
    {
        brand: "Vekra & Mover",
        role: "نماینده برتر جک‌های پارکینگی",
        href: "/about",
    },
    {
        brand: "HSP",
        role: "نماینده انحصاری ریموت و کنترل تردد",
        href: "/about",
    },
] as const;

const DEFAULT_BRANCH_PHONES = [
    { label: "شعبه ۱ (پیروزی)", display: "051-35013383", tel: "05135013383" },
    { label: "شعبه ۲ (سبحان)", display: "051-37136355", tel: "05137136355" },
    { label: "خط ویژه فروش", display: "051-37136356", tel: "05137136356" },
    { label: "شعبه ۳ و مشاوره", display: "09154191788", tel: "09154191788" },
] as const;

function Footer() {
    const [storeInfo, setStoreInfo] = useState<StoreInfo>({});
    const { isAuthenticated } = useAuth();
    const { categoryTree } = useCategoryTree();

    const [isSeoExpanded, setIsSeoExpanded] = useState(false);
    const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
    const [newsletterMessage, setNewsletterMessage] = useState("");

    const orderTrackingHref = isAuthenticated ? "/profile/orders?status=current" : "/tracking";
    const supportHref = isAuthenticated ? "/profile/tickets" : "/contact";
    const accountHref = isAuthenticated ? "/profile" : "/login";

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await settingsService.getPublicSettings();
                setStoreInfo({
                    storeName: data.storeName,
                    storeEmail: data.storeEmail,
                    storePhone: data.storePhone,
                    storeAddress: data.storeAddress,
                    socialLinks: data.socialLinks,
                });
            } catch (error) {
                console.error("Error fetching store info:", error);
            }
        };
        fetchSettings();

        const handleSettingsUpdated = () => fetchSettings();
        window.addEventListener("settings:updated", handleSettingsUpdated);

        return () => {
            window.removeEventListener("settings:updated", handleSettingsUpdated);
        };
    }, []);

    const scrollToTop = useCallback(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    const toggleAccordion = useCallback((sectionId: string) => {
        setActiveAccordion((prev) => (prev === sectionId ? null : sectionId));
    }, []);

    const categoryLinks = useMemo<NavLinkItem[]>(() => {
        const activeRoots = (categoryTree || []).filter(
            (cat) => cat && cat.isActive !== false && Boolean(cat.slug) && Boolean(cat.name)
        );
        if (activeRoots.length === 0) {
            return DEFAULT_CATEGORY_LINKS;
        }
        const dynamicItems = activeRoots.slice(0, 4).map((cat) => ({
            href: `/products?category=${encodeURIComponent(cat.slug)}&includeChildren=true`,
            label: cat.name,
        }));
        return [
            ...dynamicItems,
            { href: "/products", label: "مشاهده همه محصولات" },
            { href: CATEGORY_FILTER_HREF, label: "فیلتر هوشمند دسته‌بندی‌ها" },
        ];
    }, [categoryTree]);

    const navColumns = useMemo<NavColumn[]>(
        () => [
            {
                id: "categories",
                title: "دسته‌بندی محصولات",
                links: categoryLinks,
            },
            {
                id: "guides",
                title: "راهنمای خرید و مقایسه",
                links: [
                    {
                        href: "/guides/راهنمای-خرید-دوربین-مداربسته",
                        label: "راهنمای خرید دوربین مداربسته",
                    },
                    {
                        href: "/guides/بهترین-دوربین-مداربسته-برای-خانه",
                        label: "بهترین دوربین مداربسته خانگی",
                    },
                    {
                        href: "/guides/راهنمای-خرید-dvr",
                        label: "راهنمای تخصصی خرید DVR",
                    },
                    {
                        href: "/compare/داهوا-در-برابر-هایک-ویژن",
                        label: "مقایسه داهوا و هایک‌ویژن",
                    },
                    {
                        href: "/compare/دوربین-دام-در-برابر-بولت",
                        label: "تفاوت دوربین دام و بولت",
                    },
                    {
                        href: "/guides",
                        label: "همه راهنماهای خرید",
                    },
                ],
            },
            {
                id: "knowledge",
                title: "دانشنامه و مجله امنیت",
                links: [
                    { href: "/blog", label: "مجله تخصصی ای‌کا‌جی کالا" },
                    { href: "/glossary", label: "واژه‌نامه تجهیزات امنیتی" },
                    { href: "/glossary/dvr-چیست", label: "دستگاه DVR چیست؟" },
                    { href: "/glossary/nvr-چیست", label: "دستگاه NVR چیست؟" },
                    { href: "/glossary/poe-چیست", label: "فناوری PoE در شبکه چیست؟" },
                    { href: "/glossary/دوربین-ptz-چیست", label: "دوربین چرخشی PTZ چیست؟" },
                ],
            },
            {
                id: "customers",
                title: "خدمات مشتریان",
                links: [
                    { href: orderTrackingHref, label: "پیگیری سفارش" },
                    { href: supportHref, label: "پشتیبانی و ثبت درخواست" },
                    { href: "/faq", label: "پرسش‌های متداول و شرایط ارسال" },
                    { href: accountHref, label: isAuthenticated ? "پنل کاربری من" : "ورود / ثبت‌نام" },
                    { href: "/cart", label: "سبد خرید" },
                ],
            },
            {
                id: "company",
                title: "با ای‌کا‌جی کالا",
                links: [
                    { href: "/about", label: "درباره ما و داستان شکل‌گیری" },
                    { href: "/contact", label: "تماس با ما و نشانی ۳ شعبه" },
                    { href: "/about", label: "افتخارات و نمایندگی‌های رسمی" },
                    { href: "/compare", label: "مقایسه تخصصی تجهیزات" },
                    { href: "/terms", label: "قوانین و مقررات فروشگاه" },
                ],
            },
        ],
        [categoryLinks, orderTrackingHref, supportHref, accountHref, isAuthenticated]
    );

    const phoneItems = useMemo(() => {
        const rawAdminPhone = (storeInfo.storePhone || "").trim();
        if (!rawAdminPhone) {
            return [...DEFAULT_BRANCH_PHONES];
        }
        const normalizedAdmin = rawAdminPhone.replace(/\D/g, "");
        const alreadyListed = DEFAULT_BRANCH_PHONES.some(
            (item) => item.tel.replace(/\D/g, "") === normalizedAdmin
        );
        if (alreadyListed || !normalizedAdmin) {
            return [...DEFAULT_BRANCH_PHONES];
        }
        return [
            {
                label: "مرکز تماس فروشگاه",
                display: rawAdminPhone,
                tel: rawAdminPhone.replace(/\s+/g, ""),
            },
            DEFAULT_BRANCH_PHONES[0],
            DEFAULT_BRANCH_PHONES[1],
            DEFAULT_BRANCH_PHONES[3],
        ];
    }, [storeInfo.storePhone]);

    const handleNewsletterSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmedEmail = email.trim();
            if (!trimmedEmail) return;

            const emailRegex = /^\S+@\S+\.\S+$/;
            if (!emailRegex.test(trimmedEmail)) {
                setNewsletterStatus("error");
                setNewsletterMessage("فرمت ایمیل نامعتبر است");
                return;
            }

            setIsSubmitting(true);
            setNewsletterStatus("idle");

            try {
                const response = await api.post("/newsletter/subscribe", {
                    email: trimmedEmail,
                    source: "footer",
                });
                setNewsletterStatus("success");
                setNewsletterMessage(response.data?.message || "عضویت با موفقیت انجام شد");
                setEmail("");
            } catch (error: any) {
                setNewsletterStatus("error");
                setNewsletterMessage(error?.response?.data?.message || "خطا در عضویت");
            } finally {
                setIsSubmitting(false);
            }
        },
        [email]
    );

    const hasConfiguredSocials = Boolean(
        storeInfo.socialLinks?.telegram ||
            storeInfo.socialLinks?.instagram ||
            storeInfo.socialLinks?.aparat
    );

    const resolvedStoreName = (storeInfo.storeName || "").trim() || "ای‌کا‌جی کالا";
    const resolvedAddress =
        (storeInfo.storeAddress || "").trim() ||
        "مشهد — ۳ شعبه فعال: بلوار پیروزی ۷۵، میدان صاحب‌الزمان (پاساژ سبحان) و خین‌عرب";

    return (
        <footer className={styles.footerRoot} dir="rtl" aria-label="پاورقی سایت ای‌کا‌جی کالا">
            {/* ─── PRE-FOOTER: 4-Pillar Trust Strip + Expandable SEO Brand Story ─── */}
            <div className={styles.preFooter}>
                <ul className={styles.trustGrid} aria-label="مزایای خرید از ای‌کا‌جی کالا">
                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconAmber}`} aria-hidden>
                            <Truck size={20} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>ارسال سریع به سراسر کشور</p>
                            <p className={styles.trustDesc}>تحویل همان‌روز در مشهد و ارسال امن سراسری</p>
                        </div>
                    </li>

                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconBlue}`} aria-hidden>
                            <Wrench size={20} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>تیم تخصصی نصب و تعمیرات</p>
                            <p className={styles.trustDesc}>مشاوره مهندسی، اجرا و تعمیرات سخت‌افزاری</p>
                        </div>
                    </li>

                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconEmerald}`} aria-hidden>
                            <ShieldCheck size={20} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>ضمانت اصالت و گارانتی معتبر</p>
                            <p className={styles.trustDesc}>نماینده رسمی برندهای برتر در خراسان بزرگ</p>
                        </div>
                    </li>

                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconStone}`} aria-hidden>
                            <CreditCard size={20} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>پرداخت امن و تحویل حضوری</p>
                            <p className={styles.trustDesc}>درگاه زرین‌پال و سداد + ۳ شعبه فعال مشهد</p>
                        </div>
                    </li>
                </ul>

                <article className={styles.seoArticle}>
                    <div className={styles.seoHeaderRow}>
                        <span className={styles.seoBadge}>معرفی تخصصی</span>
                    </div>
                    <h2 className={styles.seoHeading}>
                        فروشگاه اینترنتی ای‌کا‌جی کالا (EKG KALA)؛ مرجع تخصصی دوربین مداربسته و تجهیزات امنیتی
                    </h2>

                    <div
                        id="footer-seo-story"
                        className={`${styles.seoBody} ${
                            isSeoExpanded ? styles.seoBodyExpanded : styles.seoBodyCollapsed
                        }`}
                    >
                        <p className={styles.seoParagraph}>
                            مجموعه <strong>ای‌کا‌جی کالا</strong> فعالیت تخصصی خود را از سال ۱۳۹۶ در کلان‌شهر مشهد با هدف
                            تأمین بی‌واسطه، طراحی و اجرای استاندارد سیستم‌های نظارت تصویری و حفاظتی آغاز کرد. امروز با
                            پشتوانه <strong>۳ شعبه حضوری فعال</strong> و دپارتمان تخصصی تعمیرات سخت‌افزار، امکان خرید
                            مطمئن{" "}
                            <Link href="/products" className={styles.seoInlineLink}>
                                انواع دوربین مداربسته و تجهیزات امنیتی
                            </Link>{" "}
                            با قیمت رقابتی و گارانتی معتبر شرکتی برای خریداران خانگی، سازمانی و همکاران سراسر کشور فراهم
                            شده است.
                        </p>

                        <h3 className={styles.seoSubheading}>
                            انتخاب هوشمندانه با راهنمای خرید و نمایندگی رسمی برندهای معتبر
                        </h3>
                        <p className={styles.seoParagraph}>
                            ای‌کا‌جی کالا به عنوان نماینده رسمی برند <strong>Dahua</strong> (با گارانتی ماد طلایی)،{" "}
                            <strong>Sailgis</strong>، <strong>Suzuki</strong>، <strong>Vekra &amp; Mover</strong> و{" "}
                            <strong>HSP</strong> در استان خراسان بزرگ، زنجیره کاملی از دوربین‌های تحت شبکه (IP) و
                            آنالوگ HD، دستگاه‌های ضبط DVR و NVR، سوئیچ‌های شبکه PoE، جک‌های پارکینگی و سیستم‌های کنترل
                            تردد را عرضه می‌کند. پیش از ثبت سفارش می‌توانید از{" "}
                            <Link
                                href="/guides/راهنمای-خرید-دوربین-مداربسته"
                                className={styles.seoInlineLink}
                            >
                                راهنمای جامع خرید دوربین مداربسته
                            </Link>
                            ،{" "}
                            <Link
                                href="/compare/داهوا-در-برابر-هایک-ویژن"
                                className={styles.seoInlineLink}
                            >
                                مقایسه تخصصی داهوا و هایک‌ویژن
                            </Link>{" "}
                            و{" "}
                            <Link href="/glossary" className={styles.seoInlineLink}>
                                دانشنامه اصطلاحات نظارت تصویری
                            </Link>{" "}
                            استفاده کنید یا با کارشناسان فنی ما در{" "}
                            <Link href="/contact" className={styles.seoInlineLink}>
                                شعب سه‌گانه مشهد
                            </Link>{" "}
                            مشاوره رایگان دریافت نمایید.
                        </p>

                        {!isSeoExpanded && <div className={styles.seoFadeMask} aria-hidden />}
                    </div>

                    <div className={styles.seoToggleWrap}>
                        <button
                            type="button"
                            onClick={() => setIsSeoExpanded((prev) => !prev)}
                            className={styles.seoToggleBtn}
                            aria-expanded={isSeoExpanded}
                            aria-controls="footer-seo-story"
                        >
                            <span>{isSeoExpanded ? "بستن توضیحات" : "مشاهده بیشتر"}</span>
                            <ChevronDown
                                size={15}
                                className={isSeoExpanded ? styles.seoToggleIconOpen : undefined}
                                aria-hidden
                            />
                        </button>
                    </div>
                </article>
            </div>

            {/* ─── FLOATING ARCHITECTURAL FOOTER ISLAND ─── */}
            <div className={styles.islandOuter}>
                <div className={styles.island}>
                    <div className={styles.crownBar} aria-hidden />

                    <div className={styles.islandInner}>
                        {/* ─── TIER 1: Brand Lockup + Inline Back-to-Top ─── */}
                        <div className={styles.tierTop}>
                            <div className={styles.brandActionRow}>
                                <div className={styles.brandCluster}>
                                    <Link
                                        href="/"
                                        className={styles.logoCapsule}
                                        aria-label="صفحه اصلی ای‌کا‌جی کالا"
                                    >
                                        <img
                                            src="/logo-text.png"
                                            alt="ای‌کا‌جی کالا | EKG KALA"
                                            width={168}
                                            height={60}
                                            className={styles.logoImg}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </Link>

                                    <div className={styles.brandMetaDesktop}>
                                        <div className={styles.brandNameRow}>
                                            <p className={styles.brandTitle}>{resolvedStoreName}</p>
                                            <span className={styles.brandSinceBadge}>از سال ۱۳۹۶</span>
                                        </div>
                                        <p className={styles.brandTagline}>
                                            هدف ما ارتقای امنیت و آرامش شما با اصالت کالا و پشتیبانی مهندسی است
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={scrollToTop}
                                    className={styles.backToTopBtn}
                                    aria-label="بازگشت به بالا"
                                >
                                    <span>بازگشت به بالا</span>
                                    <span className={styles.backToTopIconCircle} aria-hidden>
                                        <ChevronUp size={15} />
                                    </span>
                                </button>
                            </div>

                            <div className={styles.brandMetaMobile}>
                                <div className={styles.brandNameRow}>
                                    <p className={styles.brandTitle}>{resolvedStoreName}</p>
                                    <span className={styles.brandSinceBadge}>از سال ۱۳۹۶</span>
                                </div>
                                <p className={styles.brandTagline}>
                                    هدف ما ارتقای امنیت و آرامش شما با اصالت کالا و پشتیبانی مهندسی است
                                </p>
                            </div>
                        </div>

                        {/* ─── TIER 2: 5-Column Structured Navigation (Mobile Accordions / Desktop Grid) ─── */}
                        <nav className={styles.tierNav} aria-label="لینک‌های دسترسی پاورقی">
                            <div className={styles.navGrid}>
                                {navColumns.map((col) => {
                                    const isOpen = activeAccordion === col.id;
                                    const panelId = `footer-nav-panel-${col.id}`;
                                    return (
                                        <div key={col.id} className={styles.navSection}>
                                            <h3 className={styles.navHeading}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAccordion(col.id)}
                                                    className={styles.navToggle}
                                                    aria-expanded={isOpen}
                                                    aria-controls={panelId}
                                                >
                                                    <span className={styles.navTitleCluster}>
                                                        <span className={styles.navAccentBar} aria-hidden />
                                                        <span>{col.title}</span>
                                                    </span>
                                                    <span
                                                        className={`${styles.navChevron} ${
                                                            isOpen ? styles.navChevronOpen : ""
                                                        }`}
                                                        aria-hidden
                                                    >
                                                        <ChevronDown size={16} />
                                                    </span>
                                                </button>
                                            </h3>

                                            <ul
                                                id={panelId}
                                                className={`${styles.navList} ${
                                                    isOpen ? styles.navListExpanded : styles.navListCollapsed
                                                }`}
                                            >
                                                {col.links.map((link) => (
                                                    <li key={`${col.id}-${link.href}-${link.label}`} className={styles.navItem}>
                                                        <Link href={link.href} className={styles.navLink}>
                                                            {link.label}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        </nav>

                        {/* ─── TIER 3: Contact Hub + Direct Consultation/Social + Newsletter ─── */}
                        <div className={styles.tierHub}>
                            <div className={styles.hubGrid}>
                                {/* Card 1: Contact & Mashhad Branches */}
                                <div className={styles.hubCard}>
                                    <div className={styles.hubCardHeader}>
                                        <span className={styles.hubCardIcon} aria-hidden>
                                            <Phone size={18} />
                                        </span>
                                        <div>
                                            <h3 className={styles.hubCardTitle}>مرکز تماس و شعب حضوری</h3>
                                            <p className={styles.hubCardSub}>پاسخگویی مستقیم کارشناسان فروش و فنی</p>
                                        </div>
                                    </div>

                                    <div className={styles.phoneGrid}>
                                        {phoneItems.map((phone) => (
                                            <a
                                                key={`${phone.label}-${phone.tel}`}
                                                href={`tel:${phone.tel}`}
                                                className={styles.phoneChip}
                                            >
                                                <span className={styles.phoneBranchLabel}>{phone.label}</span>
                                                <span className={styles.phoneNumber} dir="ltr">
                                                    {phone.display}
                                                </span>
                                            </a>
                                        ))}
                                    </div>

                                    <ul className={styles.contactMetaList}>
                                        <li className={styles.contactMetaItem}>
                                            <Clock size={15} aria-hidden />
                                            <span>
                                                شنبه تا چهارشنبه ۹ صبح تا ۹ شب | پنج‌شنبه ۹ صبح تا ۲ عصر
                                            </span>
                                        </li>
                                        <li className={styles.contactMetaItem}>
                                            <MapPin size={15} aria-hidden />
                                            <span>{resolvedAddress}</span>
                                        </li>
                                        {storeInfo.storeEmail && (
                                            <li className={styles.contactMetaItem}>
                                                <Mail size={15} aria-hidden />
                                                <a
                                                    href={`mailto:${storeInfo.storeEmail}`}
                                                    className={styles.navLink}
                                                    dir="ltr"
                                                >
                                                    {storeInfo.storeEmail}
                                                </a>
                                            </li>
                                        )}
                                    </ul>

                                    <Link href="/contact" className={styles.branchesLink}>
                                        <span>مشاهده آدرس دقیق و مسیریابی شعب</span>
                                        <ChevronLeft size={15} aria-hidden />
                                    </Link>
                                </div>

                                {/* Card 2: Direct Engineering Consultation & Socials */}
                                <div className={styles.hubCard}>
                                    <div className={styles.hubCardHeader}>
                                        <span className={styles.hubCardIcon} aria-hidden>
                                            <Headphones size={18} />
                                        </span>
                                        <div>
                                            <h3 className={styles.hubCardTitle}>مشاوره رایگان و ارتباط سریع</h3>
                                            <p className={styles.hubCardSub}>راهنمایی انتخاب دوربین، نصب و تعمیرات</p>
                                        </div>
                                    </div>

                                    <div className={styles.consultActions}>
                                        <a
                                            href="https://wa.me/989154191788"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.whatsappBtn}
                                        >
                                            <MessageCircle size={18} aria-hidden />
                                            <span>مشاوره مستقیم در واتساپ</span>
                                        </a>

                                        <Link href={supportHref} className={styles.supportBtn}>
                                            <Sparkles size={16} aria-hidden />
                                            <span>
                                                {isAuthenticated
                                                    ? "ارسال تیکت به واحد پشتیبانی"
                                                    : "ارتباط با دپارتمان فروش و تعمیرات"}
                                            </span>
                                        </Link>
                                    </div>

                                    {hasConfiguredSocials && (
                                        <div className={styles.socialBlock}>
                                            <p className={styles.socialLabel}>ای‌کا‌جی کالا در شبکه‌های اجتماعی:</p>
                                            <div className={styles.socialRow}>
                                                {storeInfo.socialLinks?.telegram && (
                                                    <a
                                                        href={storeInfo.socialLinks.telegram}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${styles.socialPill} ${styles.socialPillTelegram}`}
                                                        title="تلگرام"
                                                    >
                                                        <Send size={15} aria-hidden />
                                                        <span>تلگرام</span>
                                                    </a>
                                                )}
                                                {storeInfo.socialLinks?.instagram && (
                                                    <a
                                                        href={storeInfo.socialLinks.instagram}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${styles.socialPill} ${styles.socialPillInstagram}`}
                                                        title="اینستاگرام"
                                                    >
                                                        <Instagram size={15} aria-hidden />
                                                        <span>اینستاگرام</span>
                                                    </a>
                                                )}
                                                {storeInfo.socialLinks?.aparat && (
                                                    <a
                                                        href={storeInfo.socialLinks.aparat}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${styles.socialPill} ${styles.socialPillAparat}`}
                                                        title="آپارات"
                                                    >
                                                        <Video size={15} aria-hidden />
                                                        <span>آپارات</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Card 3: Newsletter Subscription */}
                                <div className={`${styles.hubCard} ${styles.hubCardSpanTablet}`}>
                                    <div className={styles.hubCardHeader}>
                                        <span className={styles.hubCardIcon} aria-hidden>
                                            <Mail size={18} />
                                        </span>
                                        <div>
                                            <h3 className={styles.hubCardTitle}>عضویت در خبرنامه ای‌کا‌جی کالا</h3>
                                            <p className={styles.hubCardSub}>اطلاع از جشنواره‌ها و قیمت‌های همکاری</p>
                                        </div>
                                    </div>

                                    <p className={styles.newsletterDesc}>
                                        ایمیل خود را ثبت کنید تا از تخفیف‌های ویژه، موجودی جدیدترین تجهیزات نظارتی و
                                        راهنماهای فنی باخبر شوید.
                                    </p>

                                    {newsletterStatus === "success" ? (
                                        <div className={styles.newsletterSuccess} role="status">
                                            <CheckCircle size={17} aria-hidden />
                                            <span>{newsletterMessage}</span>
                                        </div>
                                    ) : (
                                        <form
                                            onSubmit={handleNewsletterSubmit}
                                            noValidate
                                            aria-label="فرم عضویت در خبرنامه"
                                        >
                                            <div className={styles.newsletterForm}>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => {
                                                        setEmail(e.target.value);
                                                        if (newsletterStatus === "error") {
                                                            setNewsletterStatus("idle");
                                                        }
                                                    }}
                                                    placeholder="example@email.com"
                                                    aria-label="آدرس ایمیل برای عضویت در خبرنامه"
                                                    className={`${styles.newsletterInput} ${
                                                        newsletterStatus === "error"
                                                            ? styles.newsletterInputError
                                                            : ""
                                                    }`}
                                                    dir="ltr"
                                                    disabled={isSubmitting}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isSubmitting || !email.trim()}
                                                    className={styles.newsletterSubmit}
                                                >
                                                    {isSubmitting ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Mail size={15} aria-hidden />
                                                            <span>ثبت ایمیل</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {newsletterStatus === "error" && (
                                                <div className={styles.newsletterError} role="alert">
                                                    <AlertCircle size={14} aria-hidden />
                                                    <span>{newsletterMessage}</span>
                                                </div>
                                            )}
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ─── TIER 4: Official Dealerships Showcase + Trust & Security Seals ─── */}
                        <div className={styles.tierCredentials}>
                            <div>
                                <p className={styles.partnerTitle}>
                                    <Award size={17} aria-hidden />
                                    <span>نمایندگی رسمی برندهای معتبر در استان خراسان بزرگ</span>
                                </p>
                                <ul className={styles.partnerGrid}>
                                    {OFFICIAL_PARTNERS.map((partner) => (
                                        <li key={partner.brand}>
                                            <Link href={partner.href} className={styles.partnerPill}>
                                                <span className={styles.partnerBrand} dir="ltr">
                                                    {partner.brand}
                                                </span>
                                                <span className={styles.partnerRole}>{partner.role}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className={styles.sealsWrap}>
                                <p className={styles.sealsLabel}>نمادهای اعتماد و امنیت خرید</p>
                                <div className={styles.sealsRow}>
                                    {/* Real Enamad Trust Seal with graceful loading/offline fallback */}
                                    <div className={styles.sealCard}>
                                        <div className={styles.enamadFallback} aria-hidden>
                                            <span className={`${styles.sealBadgeIcon} ${styles.sealBadgeAmber}`}>
                                                <Award size={18} />
                                            </span>
                                            <p className={styles.sealCaption}>اینماد</p>
                                            <p className={styles.sealSub}>نماد اعتماد</p>
                                        </div>
                                        <div
                                            className={styles.enamadLiveSlot}
                                            dangerouslySetInnerHTML={{ __html: ENAMAD_HTML }}
                                        />
                                    </div>

                                    {/* Shaparak Payment Security Card */}
                                    <Link href="/faq" className={styles.sealCard} title="پرداخت امن زرین‌پال و سداد">
                                        <span className={`${styles.sealBadgeIcon} ${styles.sealBadgeBlue}`} aria-hidden>
                                            <CreditCard size={18} />
                                        </span>
                                        <p className={styles.sealCaption}>پرداخت امن</p>
                                        <p className={styles.sealSub}>زرین‌پال و سداد</p>
                                    </Link>

                                    {/* Official Warranty Card */}
                                    <Link href="/about" className={styles.sealCard} title="ضمانت اصالت و گارانتی شرکتی">
                                        <span
                                            className={`${styles.sealBadgeIcon} ${styles.sealBadgeEmerald}`}
                                            aria-hidden
                                        >
                                            <ShieldCheck size={18} />
                                        </span>
                                        <p className={styles.sealCaption}>اصالت کالا</p>
                                        <p className={styles.sealSub}>گارانتی معتبر</p>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* ─── TIER 5: Copyright & Credits Bar ─── */}
                        <div className={styles.tierBottom}>
                            <p className={styles.copyrightText}>
                                © ۱۳۹۶–۱۴۰۵ تمامی حقوق مادی و معنوی این وب‌سایت متعلق به فروشگاه اینترنتی{" "}
                                <span className={styles.copyrightHighlight}>ای‌کا‌جی کالا (EKG KALA)</span> می‌باشد.
                            </p>

                            <div className={styles.bottomMetaLeft}>
                                <Link href="/terms" className={styles.bottomMiniLink}>
                                    قوانین و مقررات
                                </Link>
                                <Link href="/faq" className={styles.bottomMiniLink}>
                                    سوالات متداول
                                </Link>
                                <Link href="/contact" className={styles.bottomMiniLink}>
                                    شعب مشهد
                                </Link>
                                <p className={styles.devCredit}>
                                    طراحی و توسعه: <span className={styles.devName}>sadraSh</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default memo(Footer);
