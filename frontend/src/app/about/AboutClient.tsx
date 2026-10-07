import Link from "next/link";
import {
    Award,
    BadgeCheck,
    Building2,
    CalendarDays,
    Car,
    ChevronLeft,
    Cog,
    KeyRound,
    RadioTower,
    ShieldCheck,
    Smile,
    Store,
    Users,
    Video,
    Wrench,
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

const brands: { name: string; description: string; Icon: LucideIcon }[] = [
    {
        name: "Dahua",
        description: "نمایندگی انحصاری محصولات با گارانتی معتبر ماد طلایی (Maad Talayi)",
        Icon: Video,
    },
    {
        name: "Sailgis",
        description: "نمایندگی رسمی سیستم‌های نظارتی",
        Icon: RadioTower,
    },
    {
        name: "Suzuki",
        description: "نمایندگی رسمی محصولات",
        Icon: Cog,
    },
    {
        name: "Vekra & Mover",
        description: "نماینده برتر جک‌های پارکینگی",
        Icon: Car,
    },
    {
        name: "HSP",
        description: "نماینده انحصاری ریموت‌های کنترل تردد",
        Icon: KeyRound,
    },
];

const stats: { number: string; label: string; Icon: LucideIcon }[] = [
    { number: "۱۳۹۶", label: "سال شروع فعالیت", Icon: CalendarDays },
    { number: "۳", label: "شعبه فعال", Icon: Store },
    { number: "۵+", label: "نمایندگی رسمی", Icon: BadgeCheck },
    { number: "۱۰۰۰+", label: "مشتری راضی", Icon: Smile },
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
                    <h1 className={styles.heroTitle}>شرکت ای‌کا‌جی کالا</h1>
                    <p className={styles.heroText}>
                        پیشرو در ارائه سیستم‌های حفاظتی و امنیتی در استان خراسان
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

                {/* Introduction + Technical team (side by side on desktop) */}
                <div className={`${styles.split} ${styles.reveal} ${styles.d2}`}>
                    <section className={styles.card}>
                        <div className={`${styles.cardHead} ${styles.headBlue}`}>
                            <div className={`${styles.cardHeadIcon} ${styles.iconBlue}`}>
                                <ShieldCheck size={22} aria-hidden />
                            </div>
                            <h2 className={styles.cardTitle}>معرفی شرکت</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.paragraph}>
                                با افتخار، شرکت <span className={styles.hlAmber}>ای‌کا‌جی کالا</span> به عنوان یکی از پیشگامان در زمینه ارائه و نصب سیستم‌های دوربین مداربسته و حفاظتی-امنیتی، از سال <span className={styles.strong}>۱۳۹۶</span> فعالیت خود را در شهر مشهد آغاز نموده است. در طول این سال‌ها، با تکیه بر تخصص، تعهد و ارائه محصولات با کیفیت، موفق به جلب رضایت و اعتماد گسترده مشتریان عزیز شده‌ایم.
                            </p>
                            <p className={styles.paragraph}>
                                این مجموعه با گسترش فعالیت‌های خود، هم اکنون دارای <span className={styles.hlAmber}>سه شعبه فعال</span> در سراسر کلان‌شهر مشهد می‌باشد تا دسترسی و ارائه خدمات به شما عزیزان با سهولت و سرعت بیشتری انجام پذیرد. رمز موفقیت ما در بازار رقابتی امروز، ارائه قیمت‌های بی‌واسطه و منصفانه در کنار حفظ بالاترین سطح کیفی محصولات و خدمات بوده است.
                            </p>
                        </div>
                    </section>

                    <section className={styles.card}>
                        <div className={`${styles.cardHead} ${styles.headGreen}`}>
                            <div className={`${styles.cardHeadIcon} ${styles.iconGreen}`}>
                                <Wrench size={22} aria-hidden />
                            </div>
                            <h2 className={styles.cardTitle}>تیم تخصصی تعمیرات</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.paragraph}>
                                علاوه بر فروش و نصب، این شرکت دارای یکی از <span className={styles.hlGreen}>مجرب‌ترین و ماهرترین تیم‌های فنی</span> در حوزه تعمیرات تخصصی انواع سیستم‌های حفاظتی و امنیتی می‌باشد. این تیم متخصص، آماده ارائه خدمات پشتیبانی و رفع هرگونه مشکل در <span className={styles.strong}>کوتاه‌ترین زمان ممکن</span> است.
                            </p>
                        </div>
                    </section>
                </div>

                {/* Brands */}
                <section className={`${styles.card} ${styles.reveal} ${styles.d3}`}>
                    <div className={`${styles.cardHead} ${styles.headAmber}`}>
                        <div className={`${styles.cardHeadIcon} ${styles.iconAmber}`}>
                            <Award size={22} aria-hidden />
                        </div>
                        <h2 className={styles.cardTitle}>افتخارات و نمایندگی‌ها</h2>
                    </div>
                    <div className={styles.cardBody}>
                        <p className={styles.brandLead}>
                            ما با افتخار اعلام می‌داریم که به عنوان نماینده رسمی برندهای معتبر بین‌المللی در استان <span className={styles.hlAmber}>خراسان بزرگ</span> فعالیت می‌کنیم:
                        </p>
                        <ul className={styles.brandGrid}>
                            {brands.map(({ name, description, Icon }) => (
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
                        ما در <strong>ای‌کا‌جی کالا</strong>، امنیت و آرامش شما را اولویت اصلی خود می‌دانیم و همواره در تلاشیم تا با ارائه راهکارهای نوین و خدماتی متمایز، بهترین تجربه را برای شما به ارمغان آوریم.
                    </p>
                </section>

                {/* Contact CTA */}
                <section className={styles.cta}>
                    <div>
                        <h2 className={styles.ctaTitle}>آماده همکاری با شما هستیم</h2>
                        <p className={styles.ctaText}>
                            برای مشاوره رایگان و کسب اطلاعات بیشتر با ما تماس بگیرید
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
