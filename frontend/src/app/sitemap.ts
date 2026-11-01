import type { MetadataRoute } from "next";
import { buildProductUrl } from "@/lib/paths";

type ProductItem = {
  _id: string;
  id?: string;
  slug?: string;
  productCode?: string;
  updatedAt?: string;
  name?: string;
  // API shape: [{ url, public_id }] — plain strings are also accepted defensively.
  images?: Array<string | { url?: string }>;
};

type CategoryItem = {
  _id: string;
  slug?: string;
  updatedAt?: string;
};

const API_BASE = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://localhost:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")).replace(/\/$/, "");
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/.test(API_BASE);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const fetchJsonWithTimeout = async (url: string, init: RequestInit & { next?: any }, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
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

// Absolute, indexable image URLs for one product (image sitemap extension).
// Skips empty values and placeholders; relative URLs are absolutized against
// the site origin (productData's "/placeholder.svg" fallback must never leak
// into the sitemap as a product photo).
const productImageUrls = (product: ProductItem): string[] => {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const img of product.images ?? []) {
    const raw = (typeof img === "string" ? img : img?.url || "").trim();
    if (!raw || raw.toLowerCase().includes("placeholder")) continue;
    const absolute = /^https?:\/\//i.test(raw)
      ? raw
      : raw.startsWith("/")
        ? `${SITE_URL}${raw}`
        : null;
    if (absolute && !seen.has(absolute)) {
      seen.add(absolute);
      urls.push(absolute);
    }
  }
  return urls;
};

async function fetchProducts(): Promise<ProductItem[]> {
  // The backend caps `limit` at 100 (productListingService MAX_LIMIT), so the
  // old single `limit=1000` request silently returned only page 1 and every
  // product beyond it was missing from the sitemap. Page through the listing
  // instead (bounded, and `facets=false` keeps each request cheap).
  // NOTE: `isActive` is deliberately NOT sent: it is an admin-only filter
  // (accessControl ADMIN_ONLY_FILTERS) that the backend strips for anonymous
  // callers before forcing isActive=true itself.
  const PAGE_LIMIT = 100;
  const MAX_PAGES = 50;
  const all: ProductItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let json: any = null;
    try {
      json = await fetchJsonWithTimeout(
        `${API_BASE}/products?page=${page}&limit=${PAGE_LIMIT}&facets=false`,
        { next: { revalidate: 3600 } },
        IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
      );
    } catch (error) {
      logBuildFetchWarning("[sitemap] Failed to fetch products", error);
      break;
    }
    const items: ProductItem[] = Array.isArray(json?.data) ? json.data : [];
    all.push(...items);
    const totalPages = Number(json?.pagination?.totalPages);
    if (items.length < PAGE_LIMIT) break;
    if (Number.isFinite(totalPages) && totalPages > 0 && page >= totalPages) break;
  }
  return all;
}

async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    const json = await fetchJsonWithTimeout(
      `${API_BASE}/categories`,
      { next: { revalidate: 3600 } },
      IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
    );
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    logBuildFetchWarning("[sitemap] Failed to fetch categories", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    // Static trust/content pages (each has unique metadata)
    ...["about", "contact", "faq", "terms"].map((page) => ({
      url: `${SITE_URL}/${page}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => {
    const slug = category.slug || category._id;
    return {
      url: `${SITE_URL}/products?category=${slug}`,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    };
  });

  // NOTE: product URLs MUST use the shared buildProductUrl() so the sitemap
  // lists the exact canonical URLs (lib/paths scheme: /product/{code}/{slug}).
  // A previous local builder emitted /{categoryPath}/{slug} URLs which the
  // [...slug] catch-all 307-redirects to the canonical form — Google does not
  // index redirecting sitemap URLs ("Page with redirect" in Search Console).
  const productPages: MetadataRoute.Sitemap = products
    .filter((product) => product._id || product.id)
    .map((product: ProductItem) => {
      const urlPath = buildProductUrl({
        id: product._id || product.id || "",
        slug: product.slug,
        productCode: product.productCode,
      } as any);
      const images = productImageUrls(product);
      return {
        url: `${SITE_URL}${urlPath}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        // Image sitemap extension: without this, Google had to discover every
        // product photo by rendering PDPs (and products have exactly one entry
        // point — this file — for their images).
        ...(images.length > 0 ? { images } : {}),
      };
    });

  return [...staticPages, ...categoryPages, ...productPages];
}
