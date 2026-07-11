import type { MetadataRoute } from "next";
import { buildProductUrl, buildCategoryUrl } from "@/lib/paths";

type ProductItem = {
  _id: string;
  id?: string;
  slug?: string;
  productCode?: string;
  updatedAt?: string;
  isActive?: boolean;
};

type CategoryItem = {
  _id: string;
  id?: string;
  slug?: string;
  updatedAt?: string;
};

const API_BASE = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://localhost:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")).replace(/\/$/, "");
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/|$)/.test(API_BASE);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://example.com").replace(/\/$/, "");

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

async function fetchProducts(): Promise<ProductItem[]> {
  try {
    // Increase limit to fetch all active products for sitemap with strict fields projection to avoid OOM
    const json = await fetchJsonWithTimeout(
      `${API_BASE}/products?limit=50000&isActive=true&fields=_id,slug,productCode,updatedAt,isActive`,
      { next: { revalidate: 3600 } },
      IS_BUILD_PHASE && IS_LOCAL_API ? 1200 : 8000
    );
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    logBuildFetchWarning("[sitemap] Failed to fetch products", error);
    return [];
  }
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
    {
      url: `${SITE_URL}/categories`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => {
    const slug = category.slug || category._id;
    return {
      url: `${SITE_URL}${buildCategoryUrl(slug)}`,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    };
  });

  const productPages: MetadataRoute.Sitemap = products
    .filter((product) => product.isActive !== false) // Only map active products
    .map((product) => {
      // Map MongoDB _id to id to be compatible with buildProductUrl signature
      const compatibleProduct = {
        id: product._id || product.id || "",
        slug: product.slug,
        productCode: product.productCode || `KY-${(product._id || "").slice(-7).toUpperCase() || "0000000"}`,
      } as any;

      const productPath = buildProductUrl(compatibleProduct);

      return {
        url: `${SITE_URL}${productPath}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
        changeFrequency: "daily" as const, // Daily to keep prices updated in Google index
        priority: 0.7,
      };
    });

  return [...staticPages, ...categoryPages, ...productPages];
}
