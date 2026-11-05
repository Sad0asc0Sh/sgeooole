import Link from "next/link";
import {
    Award,
    BadgeCheck,
    Building2,
    CalendarDays,
    ChevronLeft,
    Headphones,
    Layers,
    Network,
    ShieldCheck,
    Smile,
    Store,
    Truck,
    Users,
    type LucideIcon,
} from "lucide-react";
import styles from "./About.module.css";

/*
 * Server component (no "use client" / framer-motion): the page content is
 * fully rendered in HTML and visible even if client JS never runs, which was
 * not the case before on old browsers (framer-motion's SSR output starts at
 * opacity: 0). Styling lives in About.module.css — see the note there about
 * legacy browser support.
 */

const pillars: { name: string; description: string; Icon: LucideIcon }[] = [
    {
        name: "تنوع بی‌مرز کالای تکنولوژی",
        description: "عرضه طیف گسترده‌ای از محصولات دیجیتال، الکترونیک و تجهیزات هوشمند بدون محدودیت کالایی",
        Icon: Layers,
    },
    {
        name: "شبکه تأمین‌کنندگان معتبر مشهد",
        description: "همکاری مستمر با تأمین‌کنندگان خوش‌نام و واردکنندگان اصلی برای قیمت‌گذاری شفاف و رقابتی",
        Icon: Network,
    },
    {
        name: "تضمین ۱۰۰٪ اصالت و سلامت کالا",
        description: "کنترل کیفی دقیق پیش از ارسال به همراه گارانتی معتبر و تعهد کامل به اصالت محصولات",
        Icon: BadgeCheck,
    },
    {
        name: "ارسال سریع و ایمن به سراسر کشور",
        description: "تحویل سریع سفارش‌ها در سطح شهر مشهد و بسته‌بندی استاندارد برای ارسال به تمامی استان‌ها",
        Icon: Truck,
    },
    {
        name: "پشتیبانی واقعی و آرامش خاطر",
        description: "همراهی گام‌به‌گام کارشناسان از لحظه ثبت سفارش تا تحویل نهایی و خدمات پس از فروش",
        Icon: Headphones,
    },
];

const stats: { number: string; label: string; Icon: LucideIcon }[] = [
    { number: "۱۳۹۶", label: "سال آغاز فعالیت", Icon: CalendarDays },
    { number: "۳", label: "پایگاه فعال در مشهد", Icon: Store },
    { number: "۱۰۰٪", label: "تضمین اصالت کالا", Icon: BadgeCheck },
    { number: "۱۰۰۰+", label: "همراه و مشتری راضی", Icon: Smile },
];

export default function AboutPage() {
    return (
        <div className={styles.page} dir="rtl">
            {/* Mobile standalone header (global header is hidden on mobile for /about) */}
            <div className={styles.mobileBar}>
                <div className={styles.mobileBarInner}>
                    <p className={styles.mobileBarTitle}>درباره ما</p>
                    <Link href="/" className={styles.backLink}>
                        <span>بازگشت</span>
                        <ChevronLeft size={20} aria-hidden />
                    </Link>
                </div>
            </div>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={`${styles.heroInner} ${styles.reveal}`}>
                    <div className={styles.heroIcon}>
                        <Building2 size={36} aria-hidden />
                    </div>
                    <span className={styles.heroBadge}>از سال ۱۳۹۶ در کنار شما</span>
                    <h1 className={styles.heroTitle}>فروشگاه اینترنتی ای کا جی کالا (ekgkala)</h1>
                    <p className={styles.heroText}>
                        مرجعی اصیل برای خرید آنلاین کالای تکنولوژی؛ شکل‌گرفته بر پایه امنیت، اعتماد و آرامش خاطر
                    </p>
                </div>
            </section>

            <div className={`${styles.container} ${styles.stack}`}>
                {/* Stats — overlaps the hero */}
                <ul className={`${styles.stats} ${styles.reveal} ${styles.d1}`} aria-label="ای‌کا‌جی کالا در یک نگاه">
                    {stats.map(({ number, label, Icon }) => (
                        <li key={label} className={styles.stat}>
                            <div className={styles.statIcon}>
                                <Icon size={22} aria-hidden />
                            </div>
                            <div className={styles.statNumber}>{number}</div>
                            <div className={styles.statLabel}>{label}</div>
                        </li>
                    ))}
                </ul>

                {/* Introduction + Customer Commitment (side by side on desktop) */}
                <div className={`${styles.split} ${styles.reveal} ${styles.d2}`}>
                    <section className={styles.card}>
                        <div className={`${styles.cardHead} ${styles.headBlue}`}>
                            <div className={`${styles.cardHeadIcon} ${styles.iconBlue}`}>
                                <ShieldCheck size={22} aria-hidden />
                            </div>
                            <h2 className={styles.cardTitle}>داستان شکل‌گیری و گسترش ما</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.paragraph}>
                                مجموعه <span className={styles.hlAmber}>ای کا جی کالا</span> (با نام <span className={styles.strong}>EKG KALA</span> که در فارسی به صورت <span className={styles.strong}>ای‌کا‌جی کالا</span> یا <span className={styles.strong}>ای کی جی کالا</span> نیز شناخته می‌شود و تنها وب‌سایت رسمی آن <span className={styles.strong}>ekgkala.ir</span> است) فعالیت خود را از سال <span className={styles.strong}>۱۳۹۶</span> در کلان‌شهر مشهد با دغدغه و رسالت اصلیِ ایجاد <span className={styles.strong}>امنیت و آرامش خاطر</span> برای خانواده‌ها و کسب‌وکارها آغاز نمود. صداقت در عرضه، احترام به اعتماد خریداران و تعهد بی‌قیدوشرط به اصالت کالا، سنگ‌بنای هویت این مجموعه را شکل داد.
                            </p>
                            <p className={styles.paragraph}>
                                امروز با پشتوانه سال‌ها تجربه، اعتماد مشتریان وفادار و فعالیت <span className={styles.hlAmber}>سه پایگاه حضوری در مشهد</span>، ای‌کا‌جی کالا به یک فروشگاه اینترنتی جامع و پویا برای عرضه <span className={styles.strong}>طیف گسترده‌ای از کالاهای تکنولوژی، دیجیتال، الکترونیک و هوشمند</span> تبدیل شده است تا با همکاری شبکه‌ای از تأمین‌کنندگان معتبر در سراسر مشهد، بهترین محصولات روز را با قیمت منصفانه و بدون واسطه به دست خریداران سراسر کشور برساند.
                            </p>
                        </div>
                    </section>

                    <section className={styles.card}>
                        <div className={`${styles.cardHead} ${styles.headGreen}`}>
                            <div className={`${styles.cardHeadIcon} ${styles.iconGreen}`}>
                                <Headphones size={22} aria-hidden />
                            </div>
                            <h2 className={styles.cardTitle}>تعهد به اصالت و پشتیبانی واقعی</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.paragraph}>
                                ما باور داریم خرید آنلاین زمانی ارزشمند است که با <span className={styles.hlGreen}>آرامش خیال کامل</span> همراه باشد. به همین دلیل در ای‌کا‌جی کالا، نظارت دقیق بر سلامت فیزیکی کالاها، شفافیت در مشخصات، گارانتی معتبر و پاسخگویی مستمر کارشناسان در <span className={styles.strong}>تمامی مراحل پیش و پس از خرید</span> در اولویت قرار دارد.
                            </p>
                        </div>
                    </section>
                </div>

                {/* Core Values & Ecosystem */}
                <section className={`${styles.card} ${styles.reveal} ${styles.d3}`}>
                    <div className={`${styles.cardHead} ${styles.headAmber}`}>
                        <div className={`${styles.cardHeadIcon} ${styles.iconAmber}`}>
                            <Award size={22} aria-hidden />
                        </div>
                        <h2 className={styles.cardTitle}>ارکان اصالت و شبکه تأمین ای‌کا‌جی کالا</h2>
                    </div>
                    <div className={styles.cardBody}>
                        <p className={styles.brandLead}>
                            چشم‌انداز ما ساختن اکوسیستمی گسترده و قابل اعتماد میان خریداران سراسر ایران و برترین تأمین‌کنندگان کالای تکنولوژی در <span className={styles.hlAmber}>مشهد و خراسان بزرگ</span> است:
                        </p>
                        <ul className={styles.brandGrid}>
                            {pillars.map(({ name, description, Icon }) => (
                                <li key={name}>
                                    <div className={styles.brand}>
                                        <div className={styles.brandIcon}>
                                            <Icon size={24} aria-hidden />
                                        </div>
                                        <div className={styles.brandBody}>
                                            <h3 className={styles.brandName}>{name}</h3>
                                            <p className={styles.brandDesc}>{description}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Mission statement */}
                <section className={`${styles.mission} ${styles.reveal} ${styles.d4}`}>
                    <div className={styles.missionIcon}>
                        <Users size={28} aria-hidden />
                    </div>
                    <p className={styles.missionText}>
                        ما در <strong>ای‌کا‌جی کالا</strong>، امنیت خرید، اصالت کالا و آرامش خاطر شما را سرمایه اصلی خود می‌دانیم و همواره در تلاشیم تا تجربه‌ای استاندارد، متنوع و ماندگار از خرید آنلاین دنیای تکنولوژی را رقم بزنیم.
                    </p>
                </section>

                {/* Contact CTA */}
                <section className={styles.cta}>
                    <div>
                        <h2 className={styles.ctaTitle}>آماده همراهی و همکاری با شما هستیم</h2>
                        <p className={styles.ctaText}>
                            برای راهنمایی خرید یا همکاری در تأمین و عرضه کالا با ما در ارتباط باشید
                        </p>
                    </div>
                    <div className={styles.ctaActions}>
                        <Link href="/contact" className={styles.ctaBtn}>
                            <span>تماس با ما</span>
                            <ChevronLeft size={18} aria-hidden />
                        </Link>
                        <Link href="/products" className={`${styles.ctaBtn} ${styles.ctaBtnGhost}`}>
                            <span>مشاهده محصولات</span>
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}
