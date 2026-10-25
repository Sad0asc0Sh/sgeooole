import { Suspense } from "react";
import type { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import HomeCategoryShowcase from "@/components/home/HomeCategoryShowcase";
import MiddleBannerRail from "@/components/home/MiddleBannerRail";
import FlashOfferRail from "@/components/home/FlashOfferRail";
import SpecialOfferRail from "@/components/home/SpecialOfferRail";
import ProductRailContainer from "@/components/home/ProductRailContainer";
import ServicesGrid from "@/components/home/ServicesGrid";
import BrandsStrip from "@/components/home/BrandsStrip";
import ValueProposition from "@/components/home/ValueProposition";
import HomeSection from "@/components/home/HomeSection";
import type { Category } from "@/services/categoryService";
import type { Banner } from "@/services/bannerService";

export const revalidate = 60;

const API_BASE = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://localhost:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")).replace(/\/$/, "");
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/.test(API_BASE);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "ای‌کا‌جی کالا";

type ApiResponse<T> = { data?: T };

const fetchJsonWithTimeout = async <T,>(url: string, init: RequestInit & { next?: { revalidate: number } }, timeoutMs: number): Promise<T | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as T | null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const logBuildFetchWarning = (message: string, error?: unknown) => {
  if (IS_BUILD_PHASE) return;
  if (process.env.NODE_ENV !== "production") {
    console.warn(message, error);
  } else {
    console.warn(message);
  }
};

async function fetchHomeCategories(): Promise<Category[] | null> {
  try {
    const json = await fetchJsonWithTimeout<ApiResponse<Category[]> & { success?: boolean }>(
      `${API_BASE}/categories/homepage`,
      { next: { revalidate } },
      IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
    );
    if (json?.success !== true || !Array.isArray(json.data)) {
      throw new Error("Invalid homepage categories response");
    }
    return json.data;
  } catch (error) {
    logBuildFetchWarning("[home] Failed to fetch homepage categories", error);
    return null;
  }
}

async function fetchBanners(): Promise<Banner[]> {
  try {
    const json = await fetchJsonWithTimeout<ApiResponse<Banner[]>>(
      `${API_BASE}/banners?isActive=true&sort=sortOrder`,
      { next: { revalidate } },
      IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
    );
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    logBuildFetchWarning("[home] Failed to fetch banners", error);
    return [];
  }
}

const SkeletonHero = () => (
  <section className="w-full max-w-[1920px] mx-auto animate-pulse">
    <div className="relative mt-2 mb-3 h-[180px] md:mb-0 md:h-auto md:aspect-[1911/430]">
      <div className="mx-5 h-full md:mx-0">
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-ekg-950 md:rounded-none">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </div>
      </div>
    </div>
  </section>
);

export async function generateMetadata(): Promise<Metadata> {
  // Phase 2 SEO #14: title/description focused on the store's core category
  // (CCTV), matching the brand-keyword strategy from earlier phases.
  const title = "فروشگاه دوربین مداربسته | ای کا جی کالا (ekgkala)";
  const description =
    "ای کا جی کالا (ekgkala)؛ فروشگاه تخصصی دوربین مداربسته، دستگاه DVR و NVR و تجهیزات امنیتی با گارانتی معتبر، قیمت مناسب و ارسال سریع به سراسر کشور.";
  const canonicalUrl = SITE_URL ? `${SITE_URL}/` : "/";
  // Brand OG image: prefer the explicit env override; otherwise point at the
  // /opengraph-image route (opengraph-image.tsx). Emitted explicitly because
  // the live homepage was observed without any og:image / twitter:image meta.
  const ogImageUrl =
    process.env.NEXT_PUBLIC_OG_IMAGE ||
    (SITE_URL ? `${SITE_URL}/opengraph-image` : "/opengraph-image");
  return {
    title: { absolute: title },
    description,
    keywords: [
      "ای کا جی کالا",
      "ekgkala",
      "ای‌کا‌جی‌کالا",
      "EKG KALA",
      "فروشگاه دوربین مداربسته",
      "دوربین مداربسته",
      "قیمت دوربین مداربسته",
      "دستگاه DVR",
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "ای کا جی کالا",
      locale: "fa_IR",
      type: "website",
      images: [
        { url: ogImageUrl, width: 1200, height: 630, alt: title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function Home() {
  const [homepageCats, banners] = await Promise.all([
    fetchHomeCategories(),
    fetchBanners(),
  ]);

  // Never publish a fabricated phone number as factual data: contactPoint
  // uses NEXT_PUBLIC_CONTACT_PHONE when configured, and otherwise falls back
  // to the branch-1 landline already published on the site's own /contact
  // page (ContactClient branches) — a real, publicly listed number.
  const contactPhone =
    (process.env.NEXT_PUBLIC_CONTACT_PHONE || "").trim() || "05135013383";

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "ای کا جی کالا",
        alternateName: ["ekgkala", "ای‌کا‌جی‌کالا", "EKG KALA", SITE_NAME],
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        description:
          "ای کا جی کالا (ekgkala)؛ فروشگاه تخصصی دوربین مداربسته، دستگاه DVR و NVR و تجهیزات امنیتی با گارانتی معتبر و ارسال سریع.",
        ...(contactPhone
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                telephone: contactPhone,
                areaServed: "IR",
                availableLanguage: ["fa", "en"],
              },
            }
          : {}),
        // Postal address of branch 1, exactly as published on /contact —
        // completes the Organization entity for AI assistants verifying
        // the business (agent-readiness: contactPoint + address).
        address: {
          "@type": "PostalAddress",
          addressCountry: "IR",
          addressLocality: "مشهد",
          streetAddress: "پیروزی 75 بین ولایتی 9و11",
        },

        sameAs: (process.env.NEXT_PUBLIC_SOCIAL_LINKS || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      {
        "@type": "WebSite",
        name: "ای کا جی کالا",
        alternateName: ["ekgkala", "ای‌کا‌جی‌کالا"],
        url: SITE_URL,
        inLanguage: "fa",
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/products?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <div className="flex flex-col pb-4">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Brand H1 for SEO: visually hidden, keeps the visual design untouched */}
      <h1 className="sr-only">
        فروشگاه دوربین مداربسته | ای کا جی کالا (ekgkala)
      </h1>
      <HomeSection variant="hero">
        <Suspense fallback={<SkeletonHero />}>
          <HeroSection initialBanners={banners} />
        </Suspense>
      </HomeSection>

      <HomeSection variant="discovery">
        <HomeCategoryShowcase categories={homepageCats} />
      </HomeSection>

      <HomeSection variant="promotion">
        <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
          <FlashOfferRail />
        </Suspense>
      </HomeSection>

      <HomeSection variant="promotion">
        <MiddleBannerRail initialBanners={banners} />
      </HomeSection>

      <HomeSection variant="promotion">
        <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
          <SpecialOfferRail />
        </Suspense>
      </HomeSection>

      <HomeSection variant="products">
        <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
          <ProductRailContainer title="پرفروش‌ترین‌ها" fetchType="bestSellers" limit={10} />
        </Suspense>
      </HomeSection>

      <HomeSection variant="products">
        <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
          <ProductRailContainer title="جدیدترین‌ها" fetchType="newest" limit={10} />
        </Suspense>
      </HomeSection>

      <HomeSection variant="trust">
        <Suspense fallback={<div className="p-4 animate-pulse h-24 bg-white rounded-xl mx-4" />}>
          <ServicesGrid />
        </Suspense>
      </HomeSection>

      <HomeSection variant="trust">
        <Suspense fallback={<div className="p-4 animate-pulse h-24 bg-white rounded-xl mx-4" />}>
          <BrandsStrip />
        </Suspense>
      </HomeSection>

      <HomeSection variant="trust">
        <Suspense fallback={<div className="p-4 animate-pulse h-24 bg-white rounded-xl mx-4" />}>
          <ValueProposition />
        </Suspense>
      </HomeSection>
    </div>
  );
}
