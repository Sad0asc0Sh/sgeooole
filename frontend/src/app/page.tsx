import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import HeroSection, { HeroPlaceholder } from "@/components/home/HeroSection";
import HomeCategoryShowcase, { HomeCategoryPlaceholder } from "@/components/home/HomeCategoryShowcase";
import MiddleBannerRail, { MiddleBannerPlaceholder } from "@/components/home/MiddleBannerRail";
import FlashOfferRail from "@/components/home/FlashOfferRail";
import SpecialOfferRail from "@/components/home/SpecialOfferRail";
import ProductRailContainer, { ProductRailPlaceholder } from "@/components/home/ProductRailContainer";
import ServicesGrid from "@/components/home/ServicesGrid";
import BrandsStrip from "@/components/home/BrandsStrip";
import ValueProposition from "@/components/home/ValueProposition";
import HomeSection from "@/components/home/HomeSection";
import type { Category } from "@/services/categoryService";
import type { Banner } from "@/services/bannerService";
import { mapBackendProduct } from "@/lib/productData";
import { safeJsonLd } from "@/lib/sanitizeHtml";

export const revalidate = 60;

const API_BASE = (process.env.INTERNAL_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/.test(API_BASE);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ekgkala.ir").replace(/\/$/, "");
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "ای‌کا‌جی کالا";

const HOME_CARD_FIELDS = "name,slug,productCode,price,discount,images,stock,brand,category,compareAtPrice,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,campaignLabel,campaignTheme,productType,variants";
const CARD_QUERY = `facets=false&nocache=true&fields=${HOME_CARD_FIELDS}`;

async function fetchHomeList<T>(path: string): Promise<T[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000);
  try {
    const response = await fetch(`${API_BASE}${path}`, { signal: controller.signal, next: { revalidate } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload: { success?: boolean; data?: unknown } | null = await response.json();
    if (payload?.success !== true || !Array.isArray(payload.data)) throw new Error("Invalid response");
    return payload.data as T[];
  } catch (error) {
    if (!IS_BUILD_PHASE) console.warn(`[home] Failed to load ${path.split("?")[0]}`, error);
    // A failed request can be recovered in the browser. An empty list is valid data.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHomeProducts(path: string) {
  try {
    const products = await fetchHomeList<Parameters<typeof mapBackendProduct>[0]>(path);
    return products?.map((product) => mapBackendProduct(product, PUBLIC_API_BASE)) ?? undefined;
  } catch (error) {
    if (!IS_BUILD_PHASE) console.warn(`[home] Failed to read ${path.split("?")[0]} products`, error);
    return undefined;
  }
}

async function HomeFeed<T>({ data, children }: { data: Promise<T>; children: (data: T) => ReactNode }) {
  return children(await data);
}

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
      "EKGKALA",
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

export default function Home() {
  // Start the feeds together. Each section can render when its own data arrives,
  // so a slow product query cannot hold up discovery of the first banner.
  const banners = fetchHomeList<Banner>("/banners?isActive=true&sort=sortOrder");
  const categories = fetchHomeList<Category>("/categories/homepage");
  const flash = fetchHomeProducts(`/products?isFlashDeal=true&activeFlash=true&limit=100&${CARD_QUERY}`);
  const special = fetchHomeProducts(`/products?featured=true&limit=100&${CARD_QUERY}`);
  const bestSellers = fetchHomeProducts("/bestsellers?limit=10&in_stock=true&nocache=true");
  const newest = fetchHomeProducts(`/products?sort=-createdAt&limit=10&${CARD_QUERY}`);
  const initialNow = Date.now();

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
        // Entity SEO: one canonical OnlineStore/ElectronicsStore entity for
        // the brand (type aligned with the store's actual niche: CCTV,
        // alarm systems, parking gates — security & electronics hardware),
        // with every spelling users actually search for, all three Mashhad
        // branches exactly as published on /contact (as `department` nodes
        // carrying each branch's real phone), the real logo file (the old
        // /logo.png URL returned 404) and non-empty sameAs.
        "@type": ["OnlineStore", "ElectronicsStore"],
        "@id": `${SITE_URL}/#organization`,
        name: "ای کا جی کالا",
        legalName: "فروشگاه اینترنتی ای کا جی کالا (EKGKALA)",
        alternateName: [
          "ای کا جی کالا",
          "ای‌کا‌جی کالا",
          "ای‌کا‌جی‌کالا",
          "ای کی جی کالا",
          "ای‌کی‌جی کالا",
          "ای ک جی کالا",
          "ایکاجی کالا",
          "ایکیجی کالا",
          "اکج کالا",
          "فروشگاه ای کا جی کالا",
          "فروشگاه اینترنتی ای کا جی کالا",
          "شرکت ای کا جی کالا",
          "ekgkala",
          "EKGKALA",
          "EKGKala",
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
          "فروشگاه اینترنتی و حضوری ای کا جی کالا (ekgkala)؛ مرجع تخصصی خرید دوربین مداربسته، دزدگیر اماکن، جک پارکینگی، کرکره برقی، ریموت و تجهیزات امنیتی در مشهد با ارسال سراسری.",
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
        // All three branches, exactly as published on /contact
        // (ContactClient branches), as `department` LocalBusiness nodes so
        // each branch keeps its own address AND its real phone — branch 3
        // (Khin Arab, Tarchi) is the address Enamad/Torob list for this
        // store, so publishing it here ties that third-party record to
        // this domain. Phones come from ContactClient (branch 2 lists
        // 05137136355 and 05137136356; the second number stays in the
        // sales contactPoint above).
        department: [
          {
            "@type": "ElectronicsStore",
            "@id": `${SITE_URL}/#branch-piroozi`,
            name: "شعبه ۱ ای کا جی کالا (بلوار پیروزی)",
            parentOrganization: { "@id": `${SITE_URL}/#organization` },
            telephone: "05135013383",
            address: {
              "@type": "PostalAddress",
              addressCountry: "IR",
              addressRegion: "خراسان رضوی",
              addressLocality: "مشهد",
              streetAddress: "پیروزی 75 بین ولایتی 9و11",
            },
          },
          {
            "@type": "ElectronicsStore",
            "@id": `${SITE_URL}/#branch-sahibelzaman`,
            name: "شعبه ۲ ای کا جی کالا (میدان صاحب‌الزمان)",
            parentOrganization: { "@id": `${SITE_URL}/#organization` },
            telephone: "05137136355",
            address: {
              "@type": "PostalAddress",
              addressCountry: "IR",
              addressRegion: "خراسان رضوی",
              addressLocality: "مشهد",
              streetAddress: "میدان صاحب الزمان پاساژ سبحان طبقه +۱ واحد ۱۶",
            },
          },
          {
            "@type": "ElectronicsStore",
            "@id": `${SITE_URL}/#branch-khinarab`,
            name: "شعبه ۳ ای کا جی کالا (خین‌عرب - طرح‌چی)",
            parentOrganization: { "@id": `${SITE_URL}/#organization` },
            telephone: "09154191788",
            address: {
              "@type": "PostalAddress",
              addressCountry: "IR",
              addressRegion: "خراسان رضوی",
              addressLocality: "مشهد",
              streetAddress: "خین عرب طرح چی6 - پ63",
            },
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
          "EKGKALA",
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

  return (
    <div className="flex flex-col pb-4">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      />
      {/* Brand H1 for SEO: visually hidden (the design carries no visible
          heading here) but present in the rendered DOM for crawlers and
          assistive tech, carrying the exact brand spelling users search
          for. The entity-disambiguation copy lives in the background
          signals instead of the visible page: the Organization JSON-LD
          description below, the footer brand story, /about and llms.txt. */}
      <h1 className="sr-only">
        ای کا جی کالا (ekgkala.ir) — وب‌سایت رسمی فروشگاه اینترنتی ای‌کا‌جی کالا؛ مرجع خرید آنلاین کالای تکنولوژی، دیجیتال و هوشمند
      </h1>
      <HomeSection variant="hero">
        <Suspense fallback={<HeroPlaceholder />}>
          <HomeFeed data={banners}>{(data) => <HeroSection initialBanners={data} />}</HomeFeed>
        </Suspense>
      </HomeSection>

      <HomeSection variant="discovery">
        <Suspense fallback={<HomeCategoryPlaceholder />}>
          <HomeFeed data={categories}>{(data) => <HomeCategoryShowcase categories={data} />}</HomeFeed>
        </Suspense>
      </HomeSection>

      <HomeSection variant="promotion">
        <Suspense fallback={null}>
          <HomeFeed data={flash}>{(products) => <FlashOfferRail initialProducts={products} initialNow={initialNow} />}</HomeFeed>
        </Suspense>
      </HomeSection>

      <HomeSection variant="promotion">
        <Suspense fallback={<MiddleBannerPlaceholder />}>
          <HomeFeed data={banners}>{(data) => <MiddleBannerRail initialBanners={data} />}</HomeFeed>
        </Suspense>
      </HomeSection>

      <HomeSection variant="promotion">
        <Suspense fallback={null}>
          <HomeFeed data={special}>{(products) => <SpecialOfferRail initialProducts={products} initialNow={initialNow} />}</HomeFeed>
        </Suspense>
      </HomeSection>

      <HomeSection variant="products">
        <Suspense fallback={<ProductRailPlaceholder title="پرفروش‌ترین‌ها" fetchType="bestSellers" />}>
          <HomeFeed data={bestSellers}>{(products) => (
            <ProductRailContainer title="پرفروش‌ترین‌ها" fetchType="bestSellers" initialProducts={products} initialNow={initialNow} />
          )}</HomeFeed>
        </Suspense>
      </HomeSection>

      <HomeSection variant="products">
        <Suspense fallback={<ProductRailPlaceholder title="جدیدترین‌ها" fetchType="newest" />}>
          <HomeFeed data={newest}>{(products) => (
            <ProductRailContainer title="جدیدترین‌ها" fetchType="newest" initialProducts={products} initialNow={initialNow} />
          )}</HomeFeed>
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
