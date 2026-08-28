import { Wrench, Truck, Store, ShieldCheck } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";

/**
 * What EKGKala does beyond selling boxes.
 * ============================================================================
 * WHY THIS REPLACED TWO SECTIONS
 *
 * The homepage previously ended with three separate trust-flavoured widgets:
 * `ServicesGrid` (3 services), `BrandsStrip` (logos) and `ValueProposition`
 * (5 bullet points on a dark panel). `ServicesGrid` and `ValueProposition`
 * overlapped substantially — both claimed the repair department, both claimed
 * the Mashhad branches — so the user read the same reassurance twice and
 * believed it less each time.
 *
 * This is now the single capability statement, built only from facts already
 * asserted elsewhere in the codebase and site content:
 *
 *   - on-site installation, Mashhad             (existing SERVICES mock)
 *   - courier pickup for repairs, Mashhad       (existing SERVICES mock)
 *   - in-person collection, 3 branches          (existing SERVICES mock)
 *   - authenticity and manufacturer warranty    (existing ValueProposition)
 *
 * Nothing was invented, and the geographic limit is stated on each item rather
 * than hidden in a footnote — a customer in Tabriz should not discover on the
 * checkout page that installation is Mashhad-only. Honest scoping is what makes
 * the rest of the claim credible.
 *
 * This is a server component: it renders static, non-interactive content and has
 * no reason to ship JavaScript. The old version was marked `"use client"` for a
 * `switch` statement that chose an icon.
 */

const CAPABILITIES = [
    {
        icon: Wrench,
        title: "نصب و راه‌اندازی در محل",
        description: "اعزام تکنسین برای نصب دوربین، دستگاه ضبط و تنظیم دسترسی از راه دور.",
        scope: "مشهد",
    },
    {
        icon: Truck,
        title: "تعمیرات با دریافت و تحویل",
        description: "دستگاه معیوب را با پیک تحویل می‌گیریم و پس از تعمیر بازمی‌گردانیم.",
        scope: "مشهد",
    },
    {
        icon: Store,
        title: "تحویل حضوری از شعبه",
        description: "امکان بررسی و دریافت کالا به‌صورت حضوری در سه شعبه فعال.",
        scope: "۳ شعبه",
    },
    {
        icon: ShieldCheck,
        title: "اصالت کالا و گارانتی",
        description: "تأمین از نمایندگی رسمی همراه با گارانتی معتبر شرکتی.",
        scope: "همه سفارش‌ها",
    },
] as const;

export default function ServicesGrid() {
    return (
        <div className="space-y-6">
            <SectionHeader
                id="home-capabilities"
                title="بیش از فروش؛ پشتیبانی فنی"
                description="خدماتی که پس از ثبت سفارش در اختیار شماست."
            />

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CAPABILITIES.map(({ icon: Icon, title, description, scope }) => (
                    <li
                        key={title}
                        className="flex flex-col gap-3 rounded-xl border border-line-soft bg-surface p-4"
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-kala-200 bg-kala-50 text-kala-700">
                            <Icon size={19} aria-hidden="true" />
                        </span>

                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[13.5px] font-bold text-ink">{title}</h3>
                                {/* Scope is stated on the item, not buried. */}
                                <span className="rounded border border-line bg-surface-sunken px-1.5 py-px text-[10px] font-medium text-ink-subtle">
                                    {scope}
                                </span>
                            </div>
                            <p className="text-[12px] leading-6 text-ink-subtle">{description}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
