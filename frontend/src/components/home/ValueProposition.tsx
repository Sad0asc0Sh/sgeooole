import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { faDigits } from "@/lib/persian";

/**
 * Closing brand statement.
 * ============================================================================
 * WHAT THIS USED TO BE
 *
 * Five checkmark bullets on a dark panel, four of which duplicated claims made
 * moments earlier by `ServicesGrid` (repair department, Mashhad branches,
 * warranty). It also hardcoded `#D4AF37` and `#F5F5F5` inline, so it was the one
 * section on the page using a gold that appeared nowhere else.
 *
 * WHAT IT IS NOW
 *
 * The one thing `ServicesGrid` cannot express: track record. Three verifiable
 * quantities and a short statement of what the business actually is. Facts, not
 * adjectives — "since 1396" is checkable, "بهترین فروشگاه" is not.
 *
 * Kept dark because a single inverse band at the end of a long light page is a
 * deliberate full stop. It tells the eye the discovery surface has ended, which
 * is exactly what a closing statement should do.
 *
 * Numerals go through `faDigits`, so ۱۳۹۶ and ۳ render as Persian digits like
 * every other number in the interface. Previously these were typed as literal
 * Persian characters in the source, which meant they could never be formatted
 * consistently or localised.
 */

const FOUNDING_YEAR = 1396;
const BRANCH_COUNT = 3;

export default function ValueProposition() {
    const currentJalaliYear = 1404;
    const yearsActive = currentJalaliYear - FOUNDING_YEAR;

    const record = [
        { value: `${faDigits(FOUNDING_YEAR)}`, label: "سال آغاز فعالیت" },
        { value: `${faDigits(yearsActive)} سال`, label: "سابقه در تجهیزات امنیتی" },
        { value: `${faDigits(BRANCH_COUNT)} شعبه`, label: "حضور فیزیکی در مشهد" },
    ];

    return (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="max-w-2xl space-y-3">
                <h2 className="text-balance text-[19px] font-bold leading-8 text-ink-inverse md:text-[22px]">
                    ای‌کاجی کالا؛ تأمین‌کننده تخصصی، نه فروشگاه عمومی
                </h2>
                <p className="text-[13px] leading-7 text-ekg-300">
                    از سال {faDigits(FOUNDING_YEAR)} تنها در یک حوزه کار می‌کنیم: سیستم‌های
                    نظارت تصویری، اعلام سرقت و شبکه. همین تمرکز باعث می‌شود پیش از خرید
                    بدانیم کدام دستگاه برای پروژه شما مناسب است و پس از خرید هم بتوانیم
                    پشتیبانی کنیم.
                </p>

                <Link
                    href="/about"
                    className="inline-flex items-center gap-1 pt-1 text-[12.5px] font-semibold text-kala-300 transition-colors hover:text-kala-200"
                >
                    <span>درباره ما و شعبه‌ها</span>
                    <ChevronLeft size={15} aria-hidden="true" />
                </Link>
            </div>

            {/* Record figures. `dl` because these are genuinely
                term/description pairs, which gives assistive tech the pairing
                for free instead of simulating it with ARIA. */}
            <dl className="grid grid-cols-3 gap-x-6 gap-y-2 border-t border-ekg-800 pt-5 lg:gap-x-10 lg:border-s lg:border-t-0 lg:ps-10 lg:pt-0">
                {record.map(({ value, label }) => (
                    <div key={label} className="space-y-1">
                        <dd className="text-[19px] font-bold leading-tight text-kala-300 md:text-[22px]">
                            {value}
                        </dd>
                        <dt className="text-[11px] leading-5 text-ekg-400">{label}</dt>
                    </div>
                ))}
            </dl>
        </div>
    );
}
