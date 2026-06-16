import { Suspense } from "react";
import type { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import CategoryRail from "@/components/home/CategoryRail";
import FlashOfferRail from "@/components/home/FlashOfferRail";
import SpecialOfferRail from "@/components/home/SpecialOfferRail";
import ProductRailContainer from "@/components/home/ProductRailContainer";
import ServicesGrid from "@/components/home/ServicesGrid";
import BrandsStrip from "@/components/home/BrandsStrip";
import ValueProposition from "@/components/home/ValueProposition";
import type { Category } from "@/services/categoryService";
import type { Banner } from "@/services/bannerService";

export const revalidate = 60;

const API_BASE = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://localhost:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")).replace(/\/$/, "");
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/.test(API_BASE);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "ای‌کا‌جی کالا";
const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION || "خرید آنلاین کالاهای متنوع با بهترین قیمت و ارسال سریع.";
const OG_IMAGE = process.env.NEXT_PUBLIC_OG_IMAGE || (SITE_URL ? `${SITE_URL}/og.png` : "/og.png");

type ApiResponse<T> = { data?: T };

const fetchJsonWithTimeout = async <T,>(url: string, init: RequestInit & { next?: any }, timeoutMs: number): Promise<T | null> => {
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

async function fetchFeaturedCategories(): Promise<Category[]> {
  try {
    const json = await fetchJsonWithTimeout<ApiResponse<Category[]>>(
      `${API_BASE}/categories/featured?_t=${Date.now()}`,
      { next: { revalidate } },
      IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
    );
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    logBuildFetchWarning("[home] Failed to fetch featured categories", error);
    return [];
  }
}

async function fetchPopularCategories(): Promise<Category[]> {
  try {
    const json = await fetchJsonWithTimeout<ApiResponse<Category[]>>(
      `${API_BASE}/categories/popular?_t=${Date.now()}`,
      { next: { revalidate } },
      IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
    );
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    logBuildFetchWarning("[home] Failed to fetch popular categories", error);
    return [];
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

const SkeletonRail = ({ title }: { title: string }) => (
  <div className="py-4 bg-white border-b border-gray-100 animate-pulse">
    <div className="h-4 w-32 bg-gray-200 rounded mx-4 mb-4" aria-label={`${title} loading`} />
    <div className="flex gap-3 px-4 overflow-x-auto">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0" />
      ))}
    </div>
  </div>
);

const SkeletonHero = () => (
  <section className="w-[96%] md:w-[98%] max-w-screen-2xl mx-auto px-2 md:px-4 animate-pulse">
    <div className="mb-4">
      <div className="relative w-full aspect-[21/9] md:aspect-[4/1] rounded-2xl overflow-hidden mt-4">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
      </div>
    </div>
    <div className="flex flex-wrap justify-center gap-4">
      <div className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] aspect-[16/5] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl" />
      <div className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] aspect-[16/5] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl hidden sm:block" />
      <div className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] aspect-[16/5] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl hidden lg:block" />
    </div>
  </section>
);

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: SITE_NAME,
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
  const [featuredCats, popularCats, banners] = await Promise.all([
    fetchFeaturedCategories(),
    fetchPopularCategories(),
    fetchBanners(),
  ]);

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
          .map((s) => s.trim())
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
    <div className="flex flex-col gap-y-2 pb-4">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Suspense fallback={<SkeletonHero />}>
        <HeroSection initialBanners={banners} />
      </Suspense>

      <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
        <FlashOfferRail />
      </Suspense>

      <Suspense fallback={<SkeletonRail title="دسته‌های ویژه" />}>
        <CategoryRail title="دسته‌های ویژه" variant="circle" data={featuredCats} />
      </Suspense>

      <Suspense fallback={<SkeletonRail title="دسته‌های محبوب" />}>
        <CategoryRail title="دسته‌های محبوب" variant="card" data={popularCats} />
      </Suspense>

      <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
        <SpecialOfferRail />
      </Suspense>

      <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
        <ProductRailContainer title="پرفروش‌ترین‌ها" fetchType="bestSellers" limit={10} />
      </Suspense>

      <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
        <ProductRailContainer title="جدیدترین‌ها" fetchType="newest" limit={10} />
      </Suspense>

      <Suspense fallback={<div className="p-4 animate-pulse h-24 bg-white rounded-xl mx-4" />}>
        <ServicesGrid />
      </Suspense>

      <Suspense fallback={<div className="p-4 animate-pulse h-24 bg-white rounded-xl mx-4" />}>
        <BrandsStrip />
      </Suspense>

      <Suspense fallback={<div className="p-4 animate-pulse h-24 bg-white rounded-xl mx-4" />}>
        <ValueProposition />
      </Suspense>
    </div>
  );
}
