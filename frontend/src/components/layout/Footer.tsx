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
    Layers,
    ShieldCheck,
    CreditCard,
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
const ENAMAD_HTML = `<a referrerpolicy='origin' target='_blank' rel='noopener noreferrer' href='https://trustseal.enamad.ir/?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' style='display:flex;align-items:center;justify-content:center;width:100%;height:100%;'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' alt='نماد اعتماد الکترونیکی ای‌کا‌جی کالا' onload="this.parentElement.style.backgroundColor='#ffffff';this.style.opacity='1';" onerror="this.style.opacity='0';" style='cursor:pointer;width:58px;height:58px;object-fit:contain;opacity:0;transition:opacity 0.2s ease;' code='VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6'></a>`;

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
    { href: "/products", label: "مشاهده همه کالاهای فروشگاه" },
    { href: CATEGORY_FILTER_HREF, label: "مرور دسته‌بندی‌های کالا" },
    { href: "/products?sort=newest", label: "جدیدترین محصولات تکنولوژی" },
    { href: "/products?sort=popular", label: "پرفروش‌ترین کالاها" },
    { href: "/products?onSale=true", label: "پیشنهادهای ویژه و تخفیف‌دار" },
];

const BRAND_PILLARS = [
    {
        title: "اصالت ۱۰۰٪ کالاها",
        subtitle: "کنترل سلامت فیزیکی و گارانتی معتبر",
        href: "/about",
        icon: "shield",
    },
    {
        title: "شبکه تأمین گسترده مشهد",
        subtitle: "همکاری مستقیم با تأمین‌کنندگان منتخب",
        href: "/contact",
        icon: "layers",
    },
    {
        title: "تنوع بی‌مرز تکنولوژی",
        subtitle: "عرضه انواع کالای دیجیتال و هوشمند",
        href: "/products",
        icon: "sparkles",
    },
    {
        title: "تحویل سریع و مطمئن",
        subtitle: "ارسال روزانه مشهد و سراسر کشور",
        href: "/faq",
        icon: "truck",
    },
] as const;

const DEFAULT_BRANCH_PHONES = [
    { label: "شعبه ۱ (پیروزی)", display: "051-35013383", tel: "05135013383" },
    { label: "شعبه ۲ (سبحان)", display: "051-37136355", tel: "05137136355" },
    { label: "واحد فروش و تأمین", display: "051-37136356", tel: "05137136356" },
    { label: "شعبه ۳ و پشتیبانی", display: "09154191788", tel: "09154191788" },
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
            { href: "/products", label: "مشاهده همه کالاها" },
            { href: CATEGORY_FILTER_HREF, label: "همه دسته‌بندی‌های فروشگاه" },
        ];
    }, [categoryTree]);

    const navColumns = useMemo<NavColumn[]>(
        () => [
            {
                id: "categories",
                title: "ویترین محصولات",
                links: categoryLinks,
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
                    { href: "/blog", label: "مجله و بلاگ تکنولوژی" },
                    { href: "/contact", label: "مراکز و پایگاه‌های مشهد" },
                    { href: "/contact", label: "همکاری با تأمین‌کنندگان کالا" },
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

    const primaryPhone = phoneItems[0];

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
        "مشهد — ۳ پایگاه فعال: بلوار پیروزی ۷۵، میدان صاحب‌الزمان (پاساژ سبحان) و خین‌عرب";

    const brandTaglineText =
        "مرجع خرید آنلاین کالای تکنولوژی و دیجیتال؛ گسترش‌یافته بر پایه امنیت، اصالت و آرامش خاطر";

    return (
        <footer className={styles.footerRoot} dir="rtl" aria-label="پاورقی سایت ای‌کا‌جی کالا">
            {/* ─── PRE-FOOTER: 4-Pillar Trust Strip + Expandable Brand & Marketplace Story ─── */}
            <div className={styles.preFooter}>
                <ul className={styles.trustGrid} aria-label="مزایای خرید از ای‌کا‌جی کالا">
                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconAmber}`} aria-hidden>
                            <Layers size={19} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>تنوع گسترده کالای تکنولوژی</p>
                            <p className={styles.trustDesc}>عرضه انواع محصولات دیجیتال، الکترونیک و هوشمند</p>
                        </div>
                    </li>

                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconEmerald}`} aria-hidden>
                            <ShieldCheck size={19} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>تضمین اصالت و سلامت کالا</p>
                            <p className={styles.trustDesc}>کنترل کیفی دقیق، اصالت ۱۰۰٪ و گارانتی معتبر</p>
                        </div>
                    </li>

                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconBlue}`} aria-hidden>
                            <Truck size={19} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>ارسال سریع به سراسر کشور</p>
                            <p className={styles.trustDesc}>تحویل فوری در مشهد و ارسال ایمن به تمام شهرها</p>
                        </div>
                    </li>

                    <li className={styles.trustCard}>
                        <div className={`${styles.trustIconBox} ${styles.trustIconStone}`} aria-hidden>
                            <CreditCard size={19} />
                        </div>
                        <div className={styles.trustTextWrap}>
                            <p className={styles.trustTitle}>پرداخت امن و تحویل حضوری</p>
                            <p className={styles.trustDesc}>درگاه زرین‌پال و سداد + ۳ پایگاه فعال در مشهد</p>
                        </div>
                    </li>
                </ul>

                <article className={styles.seoArticle}>
                    <div className={styles.seoHeaderRow}>
                        <div className={styles.seoTitleGroup}>
                            <span className={styles.seoBadge}>اصالت، امنیت و آرامش</span>
                            <h2 className={styles.seoHeading}>
                                فروشگاه اینترنتی ای‌کا‌جی کالا (EKG KALA)؛ تجربه‌ای مطمئن در خرید آنلاین دنیای تکنولوژی
                            </h2>
                        </div>
                    </div>

                    <div
                        id="footer-seo-story"
                        className={`${styles.seoBody} ${
                            isSeoExpanded ? styles.seoBodyExpanded : styles.seoBodyCollapsed
                        }`}
                    >
                        <p className={styles.seoParagraph}>
                            فروشگاه اینترنتی <strong>ای‌کا‌جی کالا (EKG KALA)</strong> مسیر خود را از سال{" "}
                            <strong>۱۳۹۶</strong> در کلان‌شهر مشهد با تکیه بر ارزش‌های بنیادین{" "}
                            <strong>امنیت، اعتماد و آرامش خاطر مشتریان</strong> آغاز کرد. پشتوانه‌ای که با تعهد به
                            اصالت کالا و صداقت در خدمات شکل گرفت، امروز به یک پلتفرم جامع خرید آنلاین برای{" "}
                            <Link href="/products" className={styles.seoInlineLink}>
                                طیف گسترده‌ای از کالاهای تکنولوژی، دیجیتال، لوازم الکترونیک و تجهیزات هوشمند
                            </Link>{" "}
                            تبدیل شده است تا خانواده‌ها و کسب‌وکارها در سراسر ایران بدون هیچ محدودیتی به سبدی متنوع از
                            محصولات استاندارد و منتخب دسترسی داشته باشند.
                        </p>

                        <h3 className={styles.seoSubheading}>
                            شبکه تأمین گسترده در سراسر مشهد، تنوع بی‌مرز کالاها و قیمت رقابتی
                        </h3>
                        <p className={styles.seoParagraph}>
                            رویکرد ما در ای‌کا‌جی کالا، ایجاد پلی مستقیم و قابل اعتماد میان خریداران سراسر کشور و{" "}
                            <strong>شبکه‌ای از تأمین‌کنندگان معتبر، واردکنندگان اصلی و بازرگانان خوش‌نام در سراسر مشهد</strong>{" "}
                            است. این هم‌افزایی در زنجیره تأمین، امکان عرضه بی‌واسطه، گسترش پیوسته{" "}
                            <Link href={CATEGORY_FILTER_HREF} className={styles.seoInlineLink}>
                                دسته‌بندی‌های متنوع کالا
                            </Link>{" "}
                            و قیمت‌گذاری منصفانه را فراهم ساخته است. تمامی سفارش‌ها پیش از ارسال از نظر سلامت و اصالت
                            بررسی شده و از طریق درگاه‌های رسمی بانکی (زرین‌پال و سداد)، با تحویل سریع روزانه در مشهد
                            (یا دریافت از{" "}
                            <Link href="/contact" className={styles.seoInlineLink}>
                                سه پایگاه فعال مشهد
                            </Link>
                            ) و ارسال ایمن به تمامی استان‌های کشور به دست شما می‌رسد. همچنین در{" "}
                            <Link href="/blog" className={styles.seoInlineLink}>
                                مجله و بلاگ ای‌کا‌جی کالا
                            </Link>{" "}
                            تازه‌ترین روایت‌ها و دانستنی‌های دنیای فناوری را دنبال کنید.
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
                                size={14}
                                className={isSeoExpanded ? styles.seoToggleIconOpen : undefined}
                                aria-hidden
                            />
                        </button>
                    </div>
                </article>
            </div>

            {/* ─── FLOATING WIDESCREEN ARCHITECTURAL FOOTER ISLAND ─── */}
            <div className={styles.islandOuter}>
                <div className={styles.island}>
                    <div className={styles.crownBar} aria-hidden />

                    <div className={styles.islandInner}>
                        {/* ─── ROW 1: Brand Lockup + Quick Support Phone + Back-to-Top ─── */}
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
                                        <p className={styles.brandTagline}>{brandTaglineText}</p>
                                    </div>
                                </div>

                                <div className={styles.topActionsCluster}>
                                    <a
                                        href={`tel:${primaryPhone.tel}`}
                                        className={styles.quickCallPill}
                                        aria-label={`تماس سریع با پشتیبانی ${primaryPhone.display}`}
                                    >
                                        <Phone size={15} aria-hidden />
                                        <span className={styles.quickCallLabel}>پشتیبانی سریع:</span>
                                        <span className={styles.quickCallNum} dir="ltr">
                                            {primaryPhone.display}
                                        </span>
                                    </a>

                                    <button
                                        type="button"
                                        onClick={scrollToTop}
                                        className={styles.backToTopBtn}
                                        aria-label="بازگشت به بالا"
                                    >
                                        <span>بازگشت به بالا</span>
                                        <span className={styles.backToTopIconCircle} aria-hidden>
                                            <ChevronUp size={14} />
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className={styles.brandMetaMobile}>
                                <div className={styles.brandNameRow}>
                                    <p className={styles.brandTitle}>{resolvedStoreName}</p>
                                    <span className={styles.brandSinceBadge}>از سال ۱۳۹۶</span>
                                </div>
                                <p className={styles.brandTagline}>{brandTaglineText}</p>
                            </div>
                        </div>

                        {/* ─── ROW 2: UNIFIED WIDESCREEN BODY (3 Nav Columns + 2 Equal-Height Action Cards) ─── */}
                        <div className={styles.tierMain}>
                            {/* Zone A: 3 Structured Navigation Columns */}
                            <nav className={styles.navZone} aria-label="لینک‌های دسترسی پاورقی">
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
                                                            <ChevronDown size={15} />
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
                                                        <li
                                                            key={`${col.id}-${link.href}-${link.label}`}
                                                            className={styles.navItem}
                                                        >
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

                                <div className={styles.supplierBanner}>
                                    <div className={styles.supplierBannerMain}>
                                        <span className={styles.supplierBannerIcon} aria-hidden>
                                            <Layers size={16} />
                                        </span>
                                        <div className={styles.supplierBannerText}>
                                            <p className={styles.supplierBannerTitle}>
                                                شبکه تأمین‌کنندگان معتبر سراسر مشهد
                                            </p>
                                            <p className={styles.supplierBannerSub}>
                                                پذیرش تأمین‌کنندگان و بازرگانان انواع کالای تکنولوژی و دیجیتال
                                            </p>
                                        </div>
                                    </div>
                                    <Link href="/contact" className={styles.supplierBannerCta}>
                                        <span>درخواست همکاری</span>
                                        <ChevronLeft size={14} aria-hidden />
                                    </Link>
                                </div>
                            </nav>

                            {/* Zone B: 2 Equal-Height Action Cards (Contact Hub + Newsletter & Online Channels) */}
                            <div className={styles.hubZone}>
                                {/* Card 1: Contact & Mashhad Hubs */}
                                <div className={styles.hubCard}>
                                    <div className={styles.hubCardTop}>
                                        <div className={styles.hubCardHeader}>
                                            <span className={styles.hubCardIcon} aria-hidden>
                                                <Phone size={17} />
                                            </span>
                                            <div>
                                                <h3 className={styles.hubCardTitle}>مرکز تماس و پایگاه‌های مشهد</h3>
                                                <p className={styles.hubCardSub}>
                                                    پشتیبانی مشتریان، فروش و هماهنگی تأمین کالا
                                                </p>
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
                                                <Clock size={14} aria-hidden />
                                                <span>
                                                    شنبه تا چهارشنبه ۹ صبح تا ۹ شب | پنج‌شنبه ۹ صبح تا ۲ عصر
                                                </span>
                                            </li>
                                            <li className={styles.contactMetaItem}>
                                                <MapPin size={14} aria-hidden />
                                                <span>{resolvedAddress}</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className={styles.hubCardBottom}>
                                        <div className={styles.contactFooterRow}>
                                            <Link href="/contact" className={styles.branchesLink}>
                                                <span>مشاهده نشانی دقیق و مسیریابی شعب</span>
                                                <ChevronLeft size={14} aria-hidden />
                                            </Link>

                                            {storeInfo.storeEmail && (
                                                <a
                                                    href={`mailto:${storeInfo.storeEmail}`}
                                                    className={styles.emailLink}
                                                    dir="ltr"
                                                >
                                                    {storeInfo.storeEmail}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Newsletter + Direct Online Support & Socials */}
                                <div className={styles.hubCard}>
                                    <div className={styles.hubCardTop}>
                                        <div className={styles.hubCardHeader}>
                                            <span className={styles.hubCardIcon} aria-hidden>
                                                <Mail size={17} />
                                            </span>
                                            <div>
                                                <h3 className={styles.hubCardTitle}>خبرنامه و ارتباط مستقیم آنلاین</h3>
                                                <p className={styles.hubCardSub}>
                                                    اطلاع از جشنواره‌های فروش، تخفیف‌ها و محصولات جدید
                                                </p>
                                            </div>
                                        </div>

                                        <p className={styles.newsletterDesc}>
                                            با ثبت ایمیل خود، زودتر از دیگران از پیشنهادهای ویژه و کالاهای جدید دنیای
                                            تکنولوژی در ای‌کا‌جی کالا مطلع شوید.
                                        </p>

                                        {newsletterStatus === "success" ? (
                                            <div className={styles.newsletterSuccess} role="status">
                                                <CheckCircle size={16} aria-hidden />
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
                                                            <Loader2 size={15} className="animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Mail size={14} aria-hidden />
                                                                <span>ثبت عضویت</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>

                                                {newsletterStatus === "error" && (
                                                    <div className={styles.newsletterError} role="alert">
                                                        <AlertCircle size={13} aria-hidden />
                                                        <span>{newsletterMessage}</span>
                                                    </div>
                                                )}
                                            </form>
                                        )}
                                    </div>

                                    <div className={styles.hubCardBottom}>
                                        <div className={styles.consultActions}>
                                            <Link
                                                href="/profile/tickets"
                                                className={styles.supportOnlineBtn}
                                                aria-label="گفت‌وگو با پشتیبانی آنلاین سایت"
                                            >
                                                <Headphones size={16} aria-hidden />
                                                <span>گفت‌وگو با پشتیبانی سایت</span>
                                            </Link>

                                            <Link href="/contact" className={styles.supportBtn}>
                                                <Sparkles size={15} aria-hidden />
                                                <span>ارتباط با واحد فروش و شعب</span>
                                            </Link>
                                        </div>

                                        {hasConfiguredSocials && (
                                            <div className={styles.socialRow}>
                                                <span className={styles.socialLabelInline}>شبکه‌های اجتماعی:</span>
                                                {storeInfo.socialLinks?.telegram && (
                                                    <a
                                                        href={storeInfo.socialLinks.telegram}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${styles.socialPill} ${styles.socialPillTelegram}`}
                                                        title="تلگرام"
                                                    >
                                                        <Send size={13} aria-hidden />
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
                                                        <Instagram size={13} aria-hidden />
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
                                                        <Video size={13} aria-hidden />
                                                        <span>آپارات</span>
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ─── ROW 3: Brand & Multi-Supplier Ecosystem Pillars + White Trust Seals ─── */}
                        <div className={styles.tierCredentials}>
                            <div>
                                <p className={styles.partnerTitle}>
                                    <Award size={16} aria-hidden />
                                    <span>ارکان اصالت، کیفیت و شبکه تأمین ای‌کا‌جی کالا</span>
                                </p>
                                <ul className={styles.partnerGrid}>
                                    {BRAND_PILLARS.map((pillar) => (
                                        <li key={pillar.title}>
                                            <Link href={pillar.href} className={styles.partnerPill}>
                                                <span className={styles.partnerPillMain}>
                                                    <span className={styles.partnerPillIcon} aria-hidden>
                                                        {pillar.icon === "shield" && <ShieldCheck size={16} />}
                                                        {pillar.icon === "layers" && <Layers size={16} />}
                                                        {pillar.icon === "sparkles" && <Sparkles size={16} />}
                                                        {pillar.icon === "truck" && <Truck size={16} />}
                                                    </span>
                                                    <span className={styles.partnerPillBody}>
                                                        <span className={styles.partnerBrand}>{pillar.title}</span>
                                                        <span className={styles.partnerRole}>{pillar.subtitle}</span>
                                                    </span>
                                                </span>
                                                <span className={styles.partnerPillArrow} aria-hidden>
                                                    <ChevronLeft size={14} />
                                                </span>
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
                                                <Award size={16} />
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
                                            <CreditCard size={16} />
                                        </span>
                                        <p className={styles.sealCaption}>پرداخت امن</p>
                                        <p className={styles.sealSub}>زرین‌پال و سداد</p>
                                    </Link>

                                    {/* Authenticity & Quality Guarantee Card */}
                                    <Link href="/about" className={styles.sealCard} title="تضمین اصالت و سلامت کالا">
                                        <span
                                            className={`${styles.sealBadgeIcon} ${styles.sealBadgeEmerald}`}
                                            aria-hidden
                                        >
                                            <ShieldCheck size={16} />
                                        </span>
                                        <p className={styles.sealCaption}>اصالت کالا</p>
                                        <p className={styles.sealSub}>تضمین سلامت</p>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* ─── ROW 4: Copyright & Quick Links Bar ─── */}
                        <div className={styles.tierBottom}>
                            <p className={styles.copyrightText}>
                                © ۱۳۹۶–۱۴۰۵ تمامی حقوق مادی و معنوی این وب‌سایت متعلق به فروشگاه اینترنتی{" "}
                                <span className={styles.copyrightHighlight}>ای‌کا‌جی کالا (EKG KALA)</span> می‌باشد.
                            </p>

                            <div className={styles.bottomMetaLeft}>
                                <Link href="/contact" className={styles.bottomMiniLink}>
                                    همکاری با تأمین‌کنندگان
                                </Link>
                                <Link href="/blog" className={styles.bottomMiniLink}>
                                    بلاگ تکنولوژی
                                </Link>
                                <Link href="/faq" className={styles.bottomMiniLink}>
                                    سوالات متداول
                                </Link>
                                <Link href="/terms" className={styles.bottomMiniLink}>
                                    قوانین و مقررات
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
