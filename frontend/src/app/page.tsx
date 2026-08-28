import { Suspense } from "react";
import type { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import HomeSection from "@/components/home/HomeSection";
import CategoryRail from "@/components/home/CategoryRail";
import FlashOfferRail from "@/components/home/FlashOfferRail";
import SpecialOfferRail from "@/components/home/SpecialOfferRail";
import ProductRailContainer from "@/components/home/ProductRailContainer";
import ProductRailSkeleton from "@/components/home/ProductRailSkeleton";
import ServicesGrid from "@/components/home/ServicesGrid";
import BrandsStrip from "@/components/home/BrandsStrip";
import ValueProposition from "@/components/home/ValueProposition";
import type { Category } from "@/services/categoryService";
import type { Banner } from "@/services/bannerService";

/**
 * Homepage.
 * ============================================================================
 * COMPOSITION RATIONALE
 *
 * The previous order was:
 *   hero → flash → categories(featured) → categories(popular) → special
 *        → bestsellers → newest → services → brands → value-prop
 *
 * Three problems with it:
 *
 *   1. A promotion rail immediately after the hero, before the user had seen a
 *      single category or product. The store asked for a purchase decision
 *      before establishing what it sells.
 *   2. Two consecutive category rails, then two near-identical promotion rails,
 *      then three trailing trust widgets. Adjacent duplicates of the same intent.
 *   3. `py-0.5`–`py-2` spacing plus a `border-b` on almost every child, so the
 *      page was a run of hairlines with no grouping.
 *
 * The order below follows how someone actually buys security equipment:
 *
 *   1. WHERE AM I        hero — states the specialism without needing artwork
 *   2. WHAT EXISTS       categories — the primary way into a technical catalogue
 *   3. WHAT'S PROVEN     bestsellers — social proof from real purchase data
 *   4. WHAT'S URGENT     time-limited offers — now that context exists
 *   5. WHAT'S EXPERT     curated picks — separated from #4 so they don't merge
 *   6. WHAT'S NEW        newest arrivals — for returning visitors
 *   7. WHY TRUST US      capabilities, brands, track record
 *
 * Promotions sit in the middle rather than at the top: they are an accelerator
 * for someone already browsing, not the store's opening argument. That is the
 * difference between a specialist supplier and a sale festival.
 *
 * Tone alternation (plain / sunken) groups these into visual bands, so the page
 * has landmarks instead of an undifferentiated scroll.
 */

export const revalidate = 60;

const API_BASE = (
    typeof window === "undefined"
        ? process.env.INTERNAL_API_URL || "http://localhost:5000/api"
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const IS_BUILD_PHASE =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export";
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/.test(API_BASE);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "ای‌کاجی کالا";

/**
 * SEO description. Rewritten to state the actual specialism and service area.
 * The previous text ("خرید آنلاین کالاهای متنوع با بهترین قیمت") described a
 * general marketplace, which is both inaccurate and useless for ranking on the
 * queries this store can actually win.
 */
const SITE_DESCRIPTION =
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
    "فروشگاه تخصصی دوربین مداربسته، دزدگیر اماکن و تجهیزات شبکه؛ همراه با مشاوره فنی، نصب و گارانتی معتبر.";

const OG_IMAGE = process.env.NEXT_PUBLIC_OG_IMAGE || (SITE_URL ? `${SITE_URL}/og.png` : "/og.png");

type ApiResponse<T> = { data?: T };

const fetchJsonWithTimeout = async <T,>(
    url: string,
    init: RequestInit & { next?: { revalidate?: number } },
    timeoutMs: number,
): Promise<T | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as T | null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
};

const logBuildFetchWarning = (message: string) => {
    if (IS_BUILD_PHASE) return;
    console.warn(message);
};

const timeoutFor = () => (IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000);

/**
 * Featured and popular categories, merged.
 *
 * Both admin-managed lists still drive the homepage, but the customer sees one
 * category section instead of two adjacent rails asking the same question.
 * "Featured" ordering is preserved first because it is the more deliberate
 * editorial signal.
 *
 * Note: the `?_t=${Date.now()}` cache-buster the old code appended to these URLs
 * is removed. It made the URL unique on every render, which silently defeated
 * both `next: { revalidate }` and any upstream HTTP cache — every homepage
 * request went to the origin. The route's own `revalidate = 60` is the intended
 * freshness control.
 */
async function fetchHomeCategories(): Promise<Category[]> {
    const [featured, popular] = await Promise.all([
        fetchJsonWithTimeout<ApiResponse<Category[]>>(
            `${API_BASE}/categories/featured`,
            { next: { revalidate } },
            timeoutFor(),
        ).catch(() => null),
        fetchJsonWithTimeout<ApiResponse<Category[]>>(
            `${API_BASE}/categories/popular`,
            { next: { revalidate } },
            timeoutFor(),
        ).catch(() => null),
    ]);

    if (!featured?.data && !popular?.data) {
        logBuildFetchWarning("[home] Category lists unavailable");
    }

    const seen = new Set<string>();
    const merged: Category[] = [];

    for (const category of [
        ...(Array.isArray(featured?.data) ? featured.data : []),
        ...(Array.isArray(popular?.data) ? popular.data : []),
    ]) {
        const key = category?._id;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(category);
    }

    // Capped at 16: two full rows at the widest grid. Beyond that the section
    // becomes a directory, and `/categories` already does that job properly.
    return merged.slice(0, 16);
}

async function fetchBanners(): Promise<Banner[]> {
    const json = await fetchJsonWithTimeout<ApiResponse<Banner[]>>(
        `${API_BASE}/banners?isActive=true&sort=sortOrder`,
        { next: { revalidate } },
        timeoutFor(),
    ).catch(() => null);

    if (!json?.data) logBuildFetchWarning("[home] Banners unavailable");
    return Array.isArray(json?.data) ? json.data : [];
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: `${SITE_NAME} | تجهیزات دوربین مداربسته، دزدگیر و شبکه`,
        description: SITE_DESCRIPTION,
        openGraph: {
            title: SITE_NAME,
            description: SITE_DESCRIPTION,
            url: SITE_URL || "/",
            images: OG_IMAGE ? [{ url: OG_IMAGE }] : undefined,
        },
    };
}

export default async function Home() {
    const [categories, banners] = await Promise.all([fetchHomeCategories(), fetchBanners()]);

    // Structured data preserved as-is. `Organization` + `WebSite` with
    // `SearchAction` is correct and working; there is no frontend reason to
    // change it.
    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                name: SITE_NAME,
                url: SITE_URL || "/",
                logo: SITE_URL ? `${SITE_URL}/logo.png` : "/logo.png",
                contactPoint: {
                    "@type": "ContactPoint",
                    contactType: "customer service",
                    telephone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+98-21-00000000",
                    areaServed: "IR",
                    availableLanguage: ["fa", "en"],
                },
                sameAs: (process.env.NEXT_PUBLIC_SOCIAL_LINKS || "")
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
            },
            {
                "@type": "WebSite",
                name: SITE_NAME,
                url: SITE_URL || "/",
                potentialAction: {
                    "@type": "SearchAction",
                    target: `${SITE_URL || ""}/products?search={search_term_string}`,
                    "query-input": "required name=search_term_string",
                },
            },
        ],
    };

    return (
        <div className="flex flex-col">
            <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />

            {/* 1. WHERE AM I --------------------------------------------------
                Server-rendered banners are passed in, so the hero needs no
                Suspense boundary and no skeleton: the brand panel is static
                markup and paints with the document. */}
            <HomeSection bleed compact label="معرفی فروشگاه">
                <HeroSection initialBanners={banners} />
            </HomeSection>

            {/* 2. WHAT EXISTS ------------------------------------------------ */}
            <HomeSection tone="sunken" labelledBy="home-categories">
                <CategoryRail
                    title="خرید بر اساس دسته‌بندی"
                    description="اگر می‌دانید به چه نوع تجهیزاتی نیاز دارید، از اینجا شروع کنید."
                    data={categories}
                />
            </HomeSection>

            {/* 3. WHAT'S PROVEN ---------------------------------------------- */}
            <HomeSection>
                <Suspense fallback={<ProductRailSkeleton title="پرفروش‌ترین‌ها" />}>
                    <ProductRailContainer
                        title="پرفروش‌ترین‌ها"
                        description="پرتکرارترین انتخاب مشتریان در ماه‌های گذشته."
                        fetchType="bestSellers"
                        limit={10}
                    />
                </Suspense>
            </HomeSection>

            {/* 4. WHAT'S URGENT ----------------------------------------------
                Sunken tone sets the promotion band apart from the neutral
                product bands around it — without a coloured gradient. */}
            <HomeSection tone="sunken" labelledBy="home-timed-offers">
                <Suspense fallback={null}>
                    <FlashOfferRail />
                </Suspense>
            </HomeSection>

            {/* 5. WHAT'S EXPERT --------------------------------------------- */}
            <HomeSection labelledBy="home-curated-offers">
                <Suspense fallback={null}>
                    <SpecialOfferRail />
                </Suspense>
            </HomeSection>

            {/* 6. WHAT'S NEW ------------------------------------------------ */}
            <HomeSection tone="sunken">
                <Suspense fallback={<ProductRailSkeleton title="جدیدترین‌ها" />}>
                    <ProductRailContainer
                        title="جدیدترین‌ها"
                        description="تازه‌ترین تجهیزاتی که به انبار اضافه شده‌اند."
                        fetchType="newest"
                        limit={10}
                    />
                </Suspense>
            </HomeSection>

            {/* 7. WHY TRUST US ---------------------------------------------- */}
            <HomeSection labelledBy="home-capabilities">
                <ServicesGrid />
            </HomeSection>

            <HomeSection tone="sunken" compact labelledBy="home-brands">
                <Suspense fallback={null}>
                    <BrandsStrip />
                </Suspense>
            </HomeSection>

            {/* Closing statement. One inverse band ends the page deliberately. */}
            <HomeSection tone="inverse" label="درباره ای‌کاجی کالا">
                <ValueProposition />
            </HomeSection>
        </div>
    );
}
