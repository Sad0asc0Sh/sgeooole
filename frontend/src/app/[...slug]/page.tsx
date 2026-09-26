import { redirect, permanentRedirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ProductDetailClient from "../product/[...segments]/ProductDetailClient";
import ProductStructuredData from "../product/[...segments]/ProductStructuredData";
import { fetchProductBySlug } from "@/lib/productData";
import { buildProductUrl } from "@/lib/paths";
import { NOT_FOUND_METADATA } from "@/lib/seo";
import { buildProductMetaDescription, buildProductSeoTitle } from "@/lib/seo";
import type { Product } from "@/types/product";

// ISR: cache rendered product pages for 60s instead of re-rendering on every
// hit (previously force-dynamic). Dramatically improves TTFB / crawl budget
// while staying fresh enough after admin edits.
export const revalidate = 60;
export const dynamicParams = true;

type CatchAllParams = Promise<{ slug?: string[] }>;

const API_BASE = (
  process.env.INTERNAL_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

/**
 * Phase 1 SEO (soft-404 fix): resolve a catch-all slug to a product, a real
 * category, or unknown. Unknown slugs must 404 — previously they were
 * redirected to `/products?category=<garbage>`, returning HTTP 200 for
 * nonexistent URLs.
 *
 * Fail-open: if the categories API is unreachable we keep the legacy redirect
 * behavior rather than 404-ing legitimate category URLs.
 */
type CatchAllResolution =
  | { kind: "product"; product: Product & { isActive?: boolean } }
  | { kind: "category"; slug: string }
  | { kind: "unknown"; slug: string };

const fetchCategorySlugs = cache(async (): Promise<Set<string> | null> => {
  try {
    const res = await fetch(`${API_BASE}/categories?limit=1000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const list = Array.isArray(json?.data) ? json.data : [];
    const slugs = list
      .map((c: any) => String(c?.slug ?? c?._id ?? "").toLowerCase())
      .filter(Boolean);
    return new Set(slugs);
  } catch {
    return null;
  }
});

const resolveCatchAll = cache(
  async (segments: string[]): Promise<CatchAllResolution> => {
    const slug = segments[segments.length - 1];
    let product: (Product & { isActive?: boolean }) | null = null;
    try {
      product = await fetchProductBySlug(slug);
    } catch {
      product = null;
    }
    if (product) return { kind: "product", product };

    const slugs = await fetchCategorySlugs();
    // Fail-open on API error: preserve the legacy category redirect.
    if (slugs === null) return { kind: "category", slug };
    if (slugs.has(slug.toLowerCase())) return { kind: "category", slug };
    return { kind: "unknown", slug };
  }
);

export async function generateMetadata({
  params,
}: {
  params: CatchAllParams;
}): Promise<Metadata> {
  const resolved = await params;
  const segments = resolved.slug || [];
  if (segments.length === 0) {
    return {};
  }

  const resolution = await resolveCatchAll(segments);

  // Unknown slug: noindex + distinct title; the page itself serves a real 404
  // via notFound(). (Category slugs redirect, so their metadata never renders.)
  if (resolution.kind === "unknown") {
    return NOT_FOUND_METADATA;
  }
  if (resolution.kind !== "product") {
    return {};
  }

  const product = resolution.product;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const canonicalPath = buildProductUrl(product);
  const canonicalUrl = siteUrl ? `${siteUrl}${canonicalPath}` : canonicalPath;
  const coverImage = product.images?.[0];

  // Phase 1 SEO: sanitized Persian meta description (no raw HTML/entities)
  // and no «بدون برند» fallback in the title.
  const description = buildProductMetaDescription(product);
  const seoTitle = buildProductSeoTitle(product);
  const indexable = product?.isActive !== false;

  return {
    title: seoTitle,
    description,
    keywords: [product.title, product.brand, product.category].filter(
      Boolean
    ) as string[],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: seoTitle,
      description,
      url: canonicalUrl,
      type: "website",
      images: coverImage ? [{ url: coverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description,
      images: coverImage ? [coverImage] : undefined,
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
}

export default async function CatchAllPage({ params }: { params: CatchAllParams }) {
  const resolved = await params;
  const segments = resolved.slug || [];
  if (segments.length === 0) {
    redirect("/");
  }

  const resolution = await resolveCatchAll(segments);

  if (resolution.kind === "product") {
    const product = resolution.product;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const canonicalPath = buildProductUrl(product);

    // Permanent consolidation: old/non-canonical product paths → canonical URL.
    // 308 (not 307) so Google drops the old URL and consolidates ranking signals.
    const currentPath = `/${segments.join("/")}`;
    if (canonicalPath !== currentPath) {
      permanentRedirect(siteUrl ? `${siteUrl}${canonicalPath}` : canonicalPath);
    }

    const breadcrumbs = [
      { label: "صفحه اصلی", href: "/" },
      ...(product.categoryPath || []).map((c) => ({
        label: c.name,
        href: `/products?category=${c.slug || c.id}&includeChildren=true`,
      })),
      { label: product.title },
    ];

    return (
      <>
        <ProductStructuredData product={product} relatedProducts={[]} />
        <div className="px-4 pt-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <ProductDetailClient product={product} />
      </>
    );
  }

  if (resolution.kind === "category") {
    // Known category slug: keep the legacy redirect to the filtered listing.
    redirect(
      `/products?category=${encodeURIComponent(resolution.slug)}&includeChildren=true`
    );
  }

  // Unknown slug: serve a real 404 (no more soft-404 redirects to listings).
  notFound();
}
