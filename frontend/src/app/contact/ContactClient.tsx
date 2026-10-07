import Link from "next/link";
import { Building2, ChevronLeft, Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import shared from "../about/About.module.css";
import styles from "./Contact.module.css";

/*
 * Server component (no framer-motion): content is plain HTML and always
 * visible, and the styling is legacy-browser safe (see About.module.css).
 */

const branches = [
    {
        id: 1,
        name: "شعبه ۱",
        address: "پیروزی 75 بین ولایتی 9و11",
        phones: ["05135021720"],
        theme: styles.tBlue,
    },
    {
        id: 2,
        name: "شعبه ۲",
        address: "میدان صاحب الزمان پاساژ سبحان طبقه +۱ واحد ۱۶",
        phones: ["05137136355", "05137136356"],
        theme: styles.tGreen,
    },
    {
        id: 3,
        name: "شعبه ۳",
        address: "خین عرب طرح چی6 - پ63",
        phones: ["09154191788"],
        theme: styles.tAmber,
    },
];

export default function ContactPage() {
    return (
        <div className={shared.page} dir="rtl">
            {/* Mobile standalone header (global header is hidden on mobile for /contact) */}
            <div className={shared.mobileBar}>
                <div className={shared.mobileBarInner}>
                    <p className={shared.mobileBarTitle}>تماس با ما</p>
                    <Link href="/" className={shared.backLink}>
                        <span>بازگشت</span>
                        <ChevronLeft size={20} aria-hidden />
                    </Link>
                </div>
            </div>

            {/* Hero */}
            <section className={shared.hero}>
                <div className={`${shared.heroInner} ${shared.reveal}`}>
                    <div className={shared.heroIcon}>
                        <Building2 size={36} aria-hidden />
                    </div>
                    <h1 className={shared.heroTitle}>ای‌کا‌جی کالا</h1>
                    <p className={shared.heroText}>فروش و پخش انواع سیستم‌های حفاظتی امنیتی</p>
                    <span className={shared.heroBadge} style={{ marginTop: 18, marginBottom: 0 }}>
                        مشهد · ۳ شعبه فعال
                    </span>
                </div>
            </section>

            <div className={`${shared.container} ${shared.stack}`}>
                {/* Branches — overlap the hero */}
                <ul className={`${styles.branches} ${shared.reveal} ${shared.d1}`}>
                    {branches.map((branch) => (
                        <li key={branch.id}>
                            <section className={`${shared.card} ${styles.branchCard} ${branch.theme}`}>
                                <div className={styles.head}>
                                    <div className={styles.badge}>{branch.id}</div>
                                    <div>
                                        <h2 className={styles.branchTitle}>{branch.name}</h2>
                                        <p className={styles.branchSub}>گروه مهندسی کیان</p>
                                    </div>
                                </div>

                                <div className={styles.branchBody}>
                                    <div className={styles.row}>
                                        <div className={styles.rowIcon}>
                                            <MapPin size={18} aria-hidden />
                                        </div>
                                        <div className={styles.rowBody}>
                                            <p className={styles.label}>آدرس</p>
                                            <p className={styles.address}>{branch.address}</p>
                                        </div>
                                    </div>

                                    <div className={styles.row}>
                                        <div className={styles.rowIcon}>
                                            <Phone size={18} aria-hidden />
                                        </div>
                                        <div className={styles.rowBody}>
                                            <p className={styles.label}>شماره تماس</p>
                                            <div className={styles.phones}>
                                                {branch.phones.map((phone) => (
                                                    <a key={phone} href={`tel:${phone}`} className={styles.chip}>
                                                        <Phone size={16} aria-hidden />
                                                        <span className={styles.phone} dir="ltr">
                                                            {phone}
                                                        </span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </li>
                    ))}
                </ul>

                {/* Working hours + quick contact (side by side on desktop) */}
                <div className={`${styles.lower} ${shared.reveal} ${shared.d2}`}>
                    <section className={shared.card}>
                        <div className={`${shared.cardHead} ${styles.headPurple}`}>
                            <div className={`${shared.cardHeadIcon} ${styles.iconPurple}`}>
                                <Clock size={22} aria-hidden />
                            </div>
                            <h2 className={shared.cardTitle}>ساعات کاری</h2>
                        </div>
                        <div className={shared.cardBody}>
                            <ul className={styles.hoursGrid}>
                                <li className={styles.hour}>
                                    <p className={styles.hourDay}>شنبه تا چهارشنبه</p>
                                    <p className={styles.hourTime}>۹ صبح - ۹ شب</p>
                                </li>
                                <li className={styles.hour}>
                                    <p className={styles.hourDay}>پنج‌شنبه</p>
                                    <p className={styles.hourTime}>۹ صبح - ۲ عصر</p>
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section className={shared.mission}>
                        <div className={shared.missionIcon}>
                            <MessageCircle size={28} aria-hidden />
                        </div>
                        <h2 className={styles.missionTitle}>نیاز به مشاوره دارید؟</h2>
                        <p className={styles.missionSub}>کارشناسان ما آماده پاسخگویی به سوالات شما هستند</p>
                        <div className={styles.actions}>
                            <a href="tel:05135021720" className={`${styles.btn} ${styles.btnLight}`}>
                                <Phone size={18} aria-hidden />
                                <span dir="ltr">051-35021720</span>
                            </a>
                            <a
                                href="https://wa.me/989154191788"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${styles.btn} ${styles.btnGreen}`}
                            >
                                <MessageCircle size={18} aria-hidden />
                                <span>واتساپ</span>
                            </a>
                        </div>
                    </section>
                </div>

                {/* Back to About */}
                <div className={styles.about}>
                    <Link href="/about" className={styles.aboutLink}>
                        <span>درباره ما بیشتر بدانید</span>
                        <ChevronLeft size={18} aria-hidden />
                    </Link>
                </div>
            </div>
        </div>
    );
}
