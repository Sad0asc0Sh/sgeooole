"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, ShieldCheck, Wrench, MapPin } from "lucide-react";
import ResilientImage from "@/components/ui/ResilientImage";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl, generateBannerBlurPlaceholder } from "@/lib/image";
import { canNavigateToHref, navigateHref } from "@/lib/navigateHref";
import { useRouter } from "next/navigation";

const SwiperSlider = dynamic(() => import("./SwiperSlider"), {
    ssr: false,
    loading: () => <div className="skeleton h-full w-full" />,
});

type HeroSectionProps = {
    initialBanners?: Banner[];
};

/**
 * First screen.
 * ============================================================================
 * THE PROBLEM THIS SOLVES
 *
 * The previous hero was `return null` when no `main-slider` banner existed. So
 * the entire first screen of the storefront was empty whenever an admin had not
 * uploaded artwork, a banner image 404'd, or the banners API was slow. The
 * store's identity was fully outsourced to campaign JPEGs.
 *
 * Now identity lives in the markup and campaign artwork is an *enhancement*:
 *
 *   - a permanent brand statement panel that states, in Persian, what EKGKala
 *     specialises in and what it does beyond selling boxes
 *   - the admin-managed banner slider beside it, which simply does not render
 *     when there is nothing to show
 *
 * The admin workflow is untouched: same `bannerService`, same `main-slider` and
 * `middle-banner` positions, same `sortOrder`, same link behaviour.
 *
 * WHY A SPLIT PANEL RATHER THAN A FULL-WIDTH BANNER
 * A 4:1 full-bleed banner is what every marketplace does, and it forces the
 * store's own voice to live inside an image nobody controls at render time.
 * Giving the statement its own permanent column means the first screen always
 * says something true, and the banner earns attention instead of monopolising
 * it.
 *
 * The three capability items are real, verifiable business facts drawn from the
 * existing site content (authenticity/warranty, in-house repair, physical
 * branches in Mashhad) — not generic trust-badge filler.
 */

const CAPABILITIES = [
    { icon: ShieldCheck, label: "اصالت و گارانتی شرکتی" },
    { icon: Wrench, label: "تعمیر و راه‌اندازی تخصصی" },
    { icon: MapPin, label: "۳ شعبه فعال در مشهد" },
] as const;

export default function HeroSection({ initialBanners = [] }: HeroSectionProps) {
    const [banners, setBanners] = useState<Banner[]>(initialBanners);
    const router = useRouter();

    // Server-rendered banners are the normal path. This client fetch is only a
    // fallback for the case where SSR could not reach the API. Unlike the old
    // implementation there is no `loading` state gating the whole hero, because
    // the brand panel must paint immediately either way.
    useEffect(() => {
        if (initialBanners.length > 0) {
            setBanners(initialBanners);
            return;
        }

        let isMounted = true;
        bannerService
            .getAll()
            .then((data) => {
                if (isMounted) setBanners(data);
            })
            .catch(() => {
                // Silent by design: a missing banner is not a user-facing error.
                // The hero is already complete without it.
            });

        return () => {
            isMounted = false;
        };
    }, [initialBanners]);

    const mainBanners = banners
        .filter((banner) => banner.position === "main-slider")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const middleBanners = banners.filter((banner) => banner.position === "middle-banner").slice(0, 3);

    const hasCampaignArtwork = mainBanners.length > 0;
    const firstBanner = mainBanners[0];

    return (
        <div className="page-shell pt-5 md:pt-7">
            <div
                className={`grid gap-4 ${
                    hasCampaignArtwork ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)]" : "lg:grid-cols-1"
                }`}
            >
                {/* --- Brand statement -------------------------------------------
                    Always present. This is the part that makes the store legible
                    without a logo or a campaign image. */}
                <div className="relative overflow-hidden rounded-2xl bg-surface-inverse px-6 py-8 md:px-8 md:py-10">
                    {/* Restrained depth: two very low-opacity radial washes.
                        No neon, no glow, no circuit-board texture — the
                        "precision" feeling comes from the type and spacing. */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-[0.5]"
                        style={{
                            backgroundImage:
                                "radial-gradient(1000px 380px at 100% 0%, rgb(201 150 42 / 0.16), transparent 62%), radial-gradient(760px 420px at 0% 100%, rgb(31 45 68 / 0.85), transparent 68%)",
                        }}
                    />

                    <div className="relative flex h-full flex-col justify-between gap-7">
                        <div className="space-y-3.5">
                            <p className="inline-flex items-center rounded-full border border-kala-400/30 bg-kala-400/10 px-3 py-1 text-[11px] font-semibold text-kala-200">
                                تأمین تخصصی تجهیزات امنیتی
                            </p>

                            {/* The store's one-sentence claim. Authored in
                                Persian, not translated: «سیستم» and «راه‌اندازی»
                                are the words an Iranian installer actually uses. */}
                            <h1 className="text-balance text-[22px] font-bold leading-[1.5] text-ink-inverse md:text-[28px] md:leading-[1.45]">
                                دوربین مداربسته، دزدگیر و تجهیزات شبکه
                                <span className="mt-1 block text-kala-300">
                                    با مشاوره فنی پیش از خرید
                                </span>
                            </h1>

                            <p className="max-w-md text-[13px] leading-7 text-ekg-300">
                                از انتخاب دستگاه ضبط و دوربین متناسب با پروژه تا نصب، پیکربندی و
                                پشتیبانی پس از فروش — کنار شما هستیم.
                            </p>
                        </div>

                        <div className="space-y-5">
                            {/* Capability strip: three facts, not three slogans. */}
                            <ul className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
                                {CAPABILITIES.map(({ icon: Icon, label }) => (
                                    <li
                                        key={label}
                                        className="flex items-center gap-2 text-[12px] font-medium text-ekg-200"
                                    >
                                        <Icon
                                            size={15}
                                            className="shrink-0 text-kala-400"
                                            aria-hidden="true"
                                        />
                                        <span>{label}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="flex flex-wrap gap-2.5">
                                <Link
                                    href="/categories"
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-kala-500 px-4 py-2.5 text-[13px] font-bold text-ekg-950 transition-colors hover:bg-kala-400"
                                >
                                    <span>انتخاب بر اساس دسته‌بندی</span>
                                    <ChevronLeft size={16} aria-hidden="true" />
                                </Link>
                                <Link
                                    href="/products?sort=bestSelling"
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-ekg-700 bg-ekg-800/60 px-4 py-2.5 text-[13px] font-semibold text-ekg-100 transition-colors hover:border-ekg-600 hover:bg-ekg-800"
                                >
                                    <span>پرفروش‌ترین تجهیزات</span>
                                    <ChevronLeft size={16} aria-hidden="true" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Campaign artwork ------------------------------------------
                    Renders only when the admin has published a main-slider
                    banner. Aspect ratio is fixed so there is no layout shift
                    while the image decodes. */}
                {hasCampaignArtwork ? (
                    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface-sunken lg:aspect-auto lg:min-h-[300px]">
                        {mainBanners.length === 1 && firstBanner ? (
                            <BannerFrame banner={firstBanner} priority />
                        ) : (
                            <SwiperSlider banners={mainBanners} />
                        )}
                    </div>
                ) : null}
            </div>

            {/* --- Secondary banners --------------------------------------------
                Preserved admin capability. Now a real grid rather than a
                `flex-wrap` with `md:w-[31%]`, so two banners fill the row
                cleanly instead of leaving an orphan gap. */}
            {middleBanners.length > 0 ? (
                <div
                    className={`mt-4 grid gap-4 ${
                        middleBanners.length === 1
                            ? "grid-cols-1"
                            : middleBanners.length === 2
                              ? "grid-cols-1 sm:grid-cols-2"
                              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    }`}
                >
                    {middleBanners.map((banner) => {
                        const href = banner.link?.trim();
                        const imageUrl = resolveImageUrl(
                            (banner as unknown as { image?: unknown }).image,
                            "/placeholder-banner.png",
                        );

                        const inner = (
                            <ResilientImage
                                src={imageUrl}
                                alt={banner.title || "بنر"}
                                fill
                                className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                                loading="lazy"
                                placeholder="blur"
                                blurDataURL={generateBannerBlurPlaceholder(800, 250)}
                                fallbackSrc="/placeholder-banner.png"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                        );

                        // A real `<Link>` when there is a destination, a plain
                        // `<div>` when there is not. The old version put
                        // `role="button"` + `tabIndex` on a div and hand-rolled
                        // Enter/Space, which put unreachable stops in the tab
                        // order for non-interactive banners.
                        return href ? (
                            <Link
                                key={banner._id}
                                href={href}
                                onClick={(event) => {
                                    if (!canNavigateToHref(href)) return;
                                    event.preventDefault();
                                    navigateHref(router, href);
                                }}
                                className="group relative block aspect-[16/5] overflow-hidden rounded-xl bg-surface-sunken shadow-e1 transition-shadow hover:shadow-e2"
                            >
                                {inner}
                            </Link>
                        ) : (
                            <div
                                key={banner._id}
                                className="group relative aspect-[16/5] overflow-hidden rounded-xl bg-surface-sunken shadow-e1"
                            >
                                {inner}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

/** Single non-slider banner. Split out so the LCP path stays readable. */
function BannerFrame({ banner, priority }: { banner: Banner; priority?: boolean }) {
    const router = useRouter();
    const href = banner.link;
    const imageUrl = resolveImageUrl(
        (banner as unknown as { image?: unknown }).image,
        "/placeholder-banner.png",
    );

    const image = (
        <ResilientImage
            src={imageUrl}
            alt={banner.title || "بنر اصلی"}
            fill
            className="object-cover object-center"
            priority={priority}
            fetchPriority={priority ? "high" : "auto"}
            loading={priority ? "eager" : "lazy"}
            placeholder="blur"
            blurDataURL={generateBannerBlurPlaceholder(1200, 500)}
            fallbackSrc="/placeholder-banner.png"
            sizes="(max-width: 1024px) 100vw, 60vw"
        />
    );

    if (!canNavigateToHref(href)) {
        return <div className="absolute inset-0">{image}</div>;
    }

    return (
        <Link
            href={href as string}
            onClick={(event) => {
                event.preventDefault();
                navigateHref(router, href);
            }}
            aria-label={banner.title || "مشاهده کمپین"}
            className="absolute inset-0 block"
        >
            {image}
        </Link>
    );
}
