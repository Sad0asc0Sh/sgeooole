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
import HomeSection from "@/components/home/HomeSection";
import type { Category } from "@/services/categoryService";
import type { Banner } from "@/services/bannerService";

export const revalidate = 60;

const API_BASE = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://localhost:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")).replace(/\/$/, "");
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/.test(API_BASE);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
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

async function fetchHomeCategories(kind: "featured" | "popular"): Promise<Category[] | null> {
  try {
    const json = await fetchJsonWithTimeout<ApiResponse<Category[]> & { success?: boolean }>(
      `${API_BASE}/categories/${kind}`,
      { next: { revalidate } },
      IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
    );
    if (json?.success !== true || !Array.isArray(json.data)) {
      throw new Error(`Invalid ${kind} categories response`);
    }
    return json.data;
  } catch (error) {
    logBuildFetchWarning(`[home] Failed to fetch ${kind} categories`, error);
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
    <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-4">
      <div className="w-full md:w-[31%] xl:w-[32%] aspect-[16/5] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl" />
      <div className="w-full md:w-[31%] xl:w-[32%] aspect-[16/5] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl hidden md:block" />
      <div className="w-full md:w-[31%] xl:w-[32%] aspect-[16/5] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl hidden xl:block" />
    </div>
  </section>
);

export async function generateMetadata(): Promise<Metadata> {
  const title = "ای کا جی کالا | ekgkala | فروشگاه اینترنتی";
  const description =
    "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب، تحویل سریع و تجربه خرید روان.";
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
      "فروشگاه اینترنتی ای کا جی کالا",
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
  const [featuredCats, popularCats, banners] = await Promise.all([
    fetchHomeCategories("featured"),
    fetchHomeCategories("popular"),
    fetchBanners(),
  ]);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "ای کا جی کالا",
        alternateName: ["ekgkala", "ای‌کا‌جی‌کالا", "EKG KALA", SITE_NAME],
        url: SITE_URL || "/",
        logo: SITE_URL ? `${SITE_URL}/logo.png` : "/logo.png",
        description:
          "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب و تحویل سریع.",
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
        name: "ای کا جی کالا",
        alternateName: ["ekgkala", "ای‌کا‌جی‌کالا"],
        url: SITE_URL || "/",
        inLanguage: "fa",
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL || ""}/products?search={search_term_string}`,
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
        ای کا جی کالا (ekgkala) | فروشگاه اینترنتی
      </h1>
      <HomeSection variant="hero">
        <Suspense fallback={<SkeletonHero />}>
          <HeroSection initialBanners={banners} />
        </Suspense>
      </HomeSection>

      <HomeSection variant="promotion">
        <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
          <FlashOfferRail />
        </Suspense>
      </HomeSection>

      <HomeSection variant="discovery">
        <Suspense fallback={<SkeletonRail title="دسته‌های ویژه" />}>
          <CategoryRail title="دسته‌های ویژه" variant="circle" data={featuredCats} />
        </Suspense>
      </HomeSection>

      <HomeSection variant="discovery">
        <Suspense fallback={<SkeletonRail title="دسته‌های محبوب" />}>
          <CategoryRail title="دسته‌های محبوب" variant="card" data={popularCats} />
        </Suspense>
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
