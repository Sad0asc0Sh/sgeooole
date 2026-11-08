import { Suspense } from "react";
import Link from "next/link";
import { buildProductUrl } from "@/lib/paths";
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
import { resolveImageUrl } from "@/lib/image";
import { mapBackendProduct } from "@/lib/productData";
import type { Product } from "@/types/product";

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


type HomeRailsData = {
  newest: Product[];
  bestSellers: Product[];
  merged: Product[];
};

// ─── Server-rendered homepage product rails + crawlable links/images (SEO) ───
// Mirror the rails' own data sources on the server so ProductRailContainer
// renders real product cards and <img> tags directly in the initial SSR HTML
// (just like HeroSection does for banners).
async function fetchHomeRailProducts(): Promise<HomeRailsData> {
  const timeout = IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000;
  try {
    const [newestJson, bestJson] = await Promise.all([
      fetchJsonWithTimeout<ApiResponse<any[]> & { success?: boolean }>(
        `${API_BASE}/products?sort=-createdAt&limit=10&facets=false`,
        { next: { revalidate } },
        timeout
      ),
      fetchJsonWithTimeout<ApiResponse<any[]> & { success?: boolean }>(
        `${API_BASE}/bestsellers?limit=10&in_stock=true`,
        { next: { revalidate } },
        timeout
      ),
    ]);
    const newest = Array.isArray(newestJson?.data)
      ? newestJson.data.map((item) => mapBackendProduct(item, API_BASE))
      : [];
    const bestSellers = Array.isArray(bestJson?.data)
      ? bestJson.data.map((item) => mapBackendProduct(item, API_BASE))
      : [];
    const seen = new Set<string>();
    const merged: Product[] = [];
    for (const list of [newest, bestSellers]) {
      for (const item of list) {
        const key = item.productCode || item.slug || item.id || "";
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    }
    return { newest, bestSellers, merged };
  } catch (error) {
    logBuildFetchWarning("[home] Failed to fetch rail products", error);
    return { newest: [], bestSellers: [], merged: [] };
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
  // Title starts with the exact brand query «ای کا جی کالا» itself (not the
  // generic «فروشگاه اینترنتی») for maximum exact-match weight when users
  // search the brand name — the competing kgkala.ir ranks partly because
  // its homepage title is exactly its brand name.
  const title = "ای کا جی کالا (ekgkala) | فروشگاه اینترنتی ای‌کا‌جی کالا - کالای تکنولوژی و دیجیتال";
  const description =
    "وب‌سایت رسمی فروشگاه اینترنتی ای کا جی کالا (ekgkala.ir / ای‌کا‌جی کالا / ای کی جی کالا)؛ مرجع خرید آنلاین کالای تکنولوژی، دیجیتال، دوربین مداربسته، دزدگیر و تجهیزات هوشمند در مشهد و سراسر ایران.";
  const canonicalUrl = SITE_URL ? `${SITE_URL}/` : "/";
  const ogImageUrl =
    process.env.NEXT_PUBLIC_OG_IMAGE ||
    (SITE_URL ? `${SITE_URL}/opengraph-image` : "/opengraph-image");
  return {
    title: { absolute: title },
    description,
    keywords: [
      "ای کا جی کالا",
      "ای‌کا‌جی کالا",
      "ای کی جی کالا",
      "ایکاجی کالا",
      "ekgkala",
      "EKG KALA",
      "ekgkala.ir",
      "فروشگاه اینترنتی ای کا جی کالا",
      "سایت ای کا جی کالا",
      "خرید آنلاین کالای تکنولوژی",
      "فروشگاه کالای دیجیتال مشهد",
      "خرید اینترنتی کالای هوشمند",
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
        { url: ogImageUrl, width: 1200, height: 630, alt: "ای کا جی کالا | ekgkala" },
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
  const [homepageCats, banners, railData] = await Promise.all([
    fetchHomeCategories(),
    fetchBanners(),
    fetchHomeRailProducts(),
  ]);
  const railProducts = railData.merged;

  // Never publish a fabricated phone number as factual data: contactPoint
  // uses NEXT_PUBLIC_CONTACT_PHONE when configured, and otherwise falls back
  // to the branch-1 landline already published on the site's own /contact
  // page (ContactClient branches) — a real, publicly listed number.
  const contactPhone =
    (process.env.NEXT_PUBLIC_CONTACT_PHONE || "").trim() || "05135013383";

  // Verified profile URLs that belong to this same business entity:
  // the Enamad trust-seal page already linked from the site footer, the
  // store's own Torob shop (shop/400109 — Torob redirects it to the
  // «ای کا جی کالا» shop slug), its listings on the Irangaah and
  // MarkazTamas directories (both pages are about ekgkala.ir), and the
  // Telegram channel from the live public settings. Together they pin
  // every scattered third-party profile to ekgkala.ir as the canonical
  // entity home, so search engines stop splitting the brand's signals
  // between this store, Digikala and the similarly-named kgkala.
  const verifiedProfiles = [
    "https://trustseal.enamad.ir/?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6",
    "https://torob.com/shop/400109/",
    "https://torob.com/shop/400109/%D8%A7%DB%8C-%DA%A9%D8%A7-%D8%AC%DB%8C-%DA%A9%D8%A7%D9%84%D8%A7/",
    "https://irangaah.ir/websites/ekgkala.ir",
    "https://markaztamas.com/businesses/6658/%D8%A7%DB%8C-%DA%A9%DB%8C-%D8%AC%DB%8C-%DA%A9%D8%A7%D9%84%D8%A7",
    "https://t.me/ekgkala",
  ];
  const socialLinks = Array.from(
    new Set([
      ...verifiedProfiles,
      ...(process.env.NEXT_PUBLIC_SOCIAL_LINKS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        // Entity SEO: one canonical Organization/OnlineStore entity for the
        // brand, with every spelling users actually search for, all three
        // Mashhad branches exactly as published on /contact, the real logo
        // file (the old /logo.png URL returned 404) and non-empty sameAs.
        "@type": ["Organization", "OnlineStore"],
        "@id": `${SITE_URL}/#organization`,
        name: "ای کا جی کالا",
        legalName: "فروشگاه اینترنتی ای کا جی کالا (EKG KALA)",
        alternateName: [
          "ای کا جی کالا",
          "ای‌کا‌جی کالا",
          "ای‌کا‌جی‌کالا",
          "ای کی جی کالا",
          "ای‌کی‌جی کالا",
          "ایکاجی کالا",
          "ایکیجی کالا",
          "فروشگاه ای کا جی کالا",
          "فروشگاه اینترنتی ای کا جی کالا",
          "شرکت ای کا جی کالا",
          "ekgkala",
          "EKG KALA",
          "EKG Kala",
          "EKGKala",
          "ekgkala.ir",
          "www.ekgkala.ir",
          SITE_NAME,
        ],
        url: SITE_URL,
        foundingDate: "2017",
        logo: {
          "@type": "ImageObject",
          "@id": `${SITE_URL}/#logo`,
          url: `${SITE_URL}/logo-text.png`,
          contentUrl: `${SITE_URL}/logo-text.png`,
          width: 929,
          height: 316,
          caption: "فروشگاه اینترنتی ای کا جی کالا (ekgkala)",
        },
        image: [
          `${SITE_URL}/logo-text.png`,
          `${SITE_URL}/icon-512x512.png`,
          `${SITE_URL}/ekg-logo.jpg`,
        ],
        description:
          "فروشگاه اینترنتی ای کا جی کالا (ekgkala / EKG KALA)؛ مرجع رسمی خرید آنلاین کالای تکنولوژی، دیجیتال، الکترونیک و تجهیزات هوشمند در ایران با ۳ شعبه فعال در مشهد (بلوار پیروزی، میدان صاحب‌الزمان و خین‌عرب) و ارسال سریع به سراسر کشور. ای کا جی کالا یک فروشگاه مستقل است و تنها وب‌سایت رسمی آن ekgkala.ir است.",
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer service",
            telephone: contactPhone,
            areaServed: "IR",
            availableLanguage: ["fa", "en"],
          },
          {
            "@type": "ContactPoint",
            contactType: "sales",
            telephone: "05137136355",
            areaServed: "IR",
            availableLanguage: ["fa"],
          },
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            telephone: "09154191788",
            areaServed: "IR",
            availableLanguage: ["fa"],
          },
        ],
        // All three branch addresses, exactly as published on /contact
        // (ContactClient branches) — branch 3 (Khin Arab, Tarchi) is the
        // address Enamad/Torob list for this store, so publishing it here
        // ties that third-party record to this domain.
        address: [
          {
            "@type": "PostalAddress",
            name: "شعبه ۱ ای کا جی کالا (بلوار پیروزی)",
            addressCountry: "IR",
            addressRegion: "خراسان رضوی",
            addressLocality: "مشهد",
            streetAddress: "پیروزی 75 بین ولایتی 9و11",
          },
          {
            "@type": "PostalAddress",
            name: "شعبه ۲ ای کا جی کالا (میدان صاحب‌الزمان)",
            addressCountry: "IR",
            addressRegion: "خراسان رضوی",
            addressLocality: "مشهد",
            streetAddress: "میدان صاحب الزمان پاساژ سبحان طبقه +۱ واحد ۱۶",
          },
          {
            "@type": "PostalAddress",
            name: "شعبه ۳ ای کا جی کالا (خین‌عرب - طرح‌چی)",
            addressCountry: "IR",
            addressRegion: "خراسان رضوی",
            addressLocality: "مشهد",
            streetAddress: "خین عرب طرح چی6 - پ63",
          },
        ],
        sameAs: socialLinks,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "ای کا جی کالا",
        alternateName: [
          "فروشگاه اینترنتی ای کا جی کالا",
          "ای‌کا‌جی کالا",
          "ای کی جی کالا",
          "ایکاجی کالا",
          "ekgkala",
          "EKG KALA",
        ],
        url: SITE_URL,
        inLanguage: "fa-IR",
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  // Preload تصاویر بالای فولد (LCP): بنر اول اسلایدر اصلی و ۶ دسته‌بندی اول —
  // مرورگر بلافاصله پس از HTML دانلود را از پارس‌پک شروع می‌کند. preload بنر
  // با media جدا می‌شود تا موبایل نسخه‌ی دسکتاپ (و برعکس) را دانلود نکند.
  const mainSliderBanners = (banners || [])
    .filter((b) => b.position === "main-slider")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const firstHero = mainSliderBanners[0];
  const heroDesktopUrl = firstHero ? resolveImageUrl(firstHero.image, "") : "";
  const heroMobileUrl = firstHero
    ? resolveImageUrl(firstHero.mobileImage, "") ||
      (firstHero.image && typeof firstHero.image === "object" && (firstHero.image as any).cardUrl
        ? resolveImageUrl(String((firstHero.image as any).cardUrl), "")
        : "")
    : "";
  const seenPreload = new Set<string>();
  const categoryPreloadUrls = (homepageCats || [])
    .slice(0, 6)
    .map((cat) => {
      const card =
        (cat.image && typeof cat.image === "object" && (cat.image as any).cardUrl) ||
        (cat.icon && typeof cat.icon === "object" && (cat.icon as any).cardUrl);
      return resolveImageUrl(card || cat.image || cat.icon, "");
    })
    .filter((url) => {
      if (!/^https?:\/\//i.test(url) || seenPreload.has(url)) return false;
      seenPreload.add(url);
      return true;
    });
  return (
    <div className="flex flex-col pb-4">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {heroDesktopUrl && heroMobileUrl && heroMobileUrl !== heroDesktopUrl ? (
        <>
          <link rel="preload" as="image" href={heroMobileUrl} media="(max-width: 767px)" fetchPriority="high" />
          <link rel="preload" as="image" href={heroDesktopUrl} media="(min-width: 768px)" fetchPriority="high" />
        </>
      ) : heroDesktopUrl ? (
        <link rel="preload" as="image" href={heroDesktopUrl} fetchPriority="high" />
      ) : null}
      {categoryPreloadUrls.map((href) => (
        <link key={href} rel="preload" as="image" href={href} />
      ))}
      {/* Brand H1 for SEO: visually hidden (the design carries no visible
          heading here) but present in the rendered DOM for crawlers and
          assistive tech, carrying the exact brand spelling users search
          for. The entity-disambiguation copy lives in the background
          signals instead of the visible page: the Organization JSON-LD
          description below, the footer brand story, /about and llms.txt. */}
      <h1 className="sr-only">
        ای کا جی کالا (ekgkala.ir) — وب‌سایت رسمی فروشگاه اینترنتی ای‌کا‌جی کالا؛ مرجع خرید آنلاین کالای تکنولوژی، دیجیتال و هوشمند
      </h1>
      {/* Crawlable product links for the client-rendered rails below (see fetchHomeRailProducts) */}
      {railProducts.length > 0 && (
        <nav aria-label="محصولات منتخب فروشگاه" className="sr-only">
          <ul>
            {railProducts.map((item) => {
              const label = item.title || item.name || item.slug || "محصول";
              const imgUrl =
                item.image && /^https?:\/\//i.test(item.image) && !item.image.toLowerCase().includes("placeholder")
                  ? item.image
                  : null;
              return (
                <li key={item.productCode || item.slug || item.id}>
                  <Link href={buildProductUrl(item)}>
                    {imgUrl && (
                      <img
                        src={imgUrl}
                        alt={`خرید ${label}${item.brand ? ` برند ${item.brand}` : ""} | ای کا جی کالا`}
                        width={600}
                        height={600}
                        loading="lazy"
                      />
                    )}
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
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
          <ProductRailContainer title="پرفروش‌ترین‌ها" fetchType="bestSellers" limit={10} initialProducts={railData.bestSellers} />
        </Suspense>
      </HomeSection>

      <HomeSection variant="products">
        <Suspense fallback={<div className="p-4 animate-pulse h-48 bg-white rounded-xl mx-4" />}>
          <ProductRailContainer title="جدیدترین‌ها" fetchType="newest" limit={10} initialProducts={railData.newest} />
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
