import { cache } from "react";
import type { Product, ProductColor } from "@/services/productService";
import { buildProductUrl } from "./paths";
import { resolvePricing } from "@/lib/pricing";

// Enhanced fetch with retry logic and exponential backoff
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success - return response
      if (response.ok) {
        return response;
      }

      // 404 - don't retry, return immediately
      if (response.status === 404) {
        return response;
      }

      // 429 (Rate Limited) or 5xx (Server Error) - retry with backoff
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : initialDelay * Math.pow(2, attempt);

        // If this is the last attempt, return the error response
        if (attempt === maxRetries - 1) {
          return response;
        }

        console.warn(`[productData] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms for: ${url}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Other errors - return response without retry
      return response;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Network error - retry with backoff
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`[productData] Network error, retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // All retries exhausted - throw the last error
  throw lastError || new Error('Fetch failed after all retries');
};

// Reduced from 3600 (1 hour) to 30 seconds for real-time discount updates from admin panel
export const PRODUCT_REVALIDATE = 30;

type BackendImage = string | { url?: string };

type BackendCategory = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  parent?: BackendCategory;
};

type BackendBrand = { name?: string; slug?: string } | string | null;

type BackendProduct = {
  _id?: string;
  id?: string;
  name: string;
  title?: string;
  slug?: string;
  sku?: string;
  enTitle?: string;
  price: number;
  image?: BackendImage;
  images?: BackendImage[];
  category?: BackendCategory | string;
  brand?: BackendBrand;
  description?: string;
  rating?: number;
  numReviews?: number;
  reviewCount?: number;
  stock?: number;
  countInStock?: number;
  discount?: number;
  colors?: ProductColor[];
  specs?: Product["specs"];
  campaignLabel?: string;
  campaignTheme?: string;
  compareAtPrice?: number;
  isFlashDeal?: boolean;
  flashDealEndTime?: string;
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;
  isActive?: boolean;
  categoryPath?: { _id?: string; id?: string; slug?: string; name?: string }[];
};

const getAssetBase = (apiUrl: string) => apiUrl.replace(/\/api\/?$/, "");

const normalizeImage = (img: BackendImage, assetBase: string): string | null => {
  if (!img) return null;
  if (typeof img === "string") {
    const url = img.trim();
    if (!url) return null;
    return url.startsWith("/") ? `${assetBase}${url}` : url;
  }

  if (typeof img === "object" && typeof img.url === "string") {
    const url = img.url.trim();
    if (!url) return null;
    return url.startsWith("/") ? `${assetBase}${url}` : url;
  }

  return null;
};

export const mapBackendProduct = (backend: BackendProduct, apiUrl: string): Product & { isActive?: boolean } => {
  const assetBase = getAssetBase(apiUrl);

  const pricing = resolvePricing({
    price: backend.price ?? 0,
    discount: backend.discount,
    compareAtPrice: backend.compareAtPrice,
    isFlashDeal: backend.isFlashDeal,
    flashDealEndTime: backend.flashDealEndTime,
    isSpecialOffer: backend.isSpecialOffer,
    specialOfferEndTime: backend.specialOfferEndTime,
    campaignLabel: backend.campaignLabel,
  });

  let images: string[] = [];
  if (backend.images && backend.images.length > 0) {
    images = backend.images
      .map((img) => normalizeImage(img, assetBase))
      .filter((value): value is string => Boolean(value));
  }

  if (images.length === 0 && backend.image) {
    const normalized = normalizeImage(backend.image, assetBase);
    if (normalized) {
      images = [normalized];
    }
  }

  if (images.length === 0) {
    images = ["/placeholder.svg"];
  }

  const countInStock = backend.stock ?? backend.countInStock ?? 0;

  const category =
    typeof backend.category === "object" && backend.category !== null
      ? (() => {
        const cat: BackendCategory = backend.category as BackendCategory;
        if (cat.parent?.name) {
          return `${cat.parent.name} > ${cat.name}`;
        }
        return cat.name || "نامشخص";
      })()
      : backend.category || "نامشخص";

  const categoryPath: Product["categoryPath"] = (() => {
    if (Array.isArray(backend.categoryPath) && backend.categoryPath.length > 0) {
      return backend.categoryPath
        .map((c) => ({
          id: c._id || c.id || "",
          name: c.name || "",
          slug: c.slug || c._id || c.id || "",
        }))
        .filter((c) => c.id);
    }

    const path: NonNullable<Product["categoryPath"]> = [];
    if (typeof backend.category === "object" && backend.category !== null) {
      const cat: BackendCategory = backend.category as BackendCategory;
      if (cat.parent?.name) {
        path.push({
          id: cat.parent._id || cat.parent.id || "",
          name: cat.parent.name || "",
          slug: cat.parent.slug || cat.parent._id || cat.parent.id || "",
        });
      }
      if (cat._id || cat.id || cat.name) {
        path.push({
          id: cat._id || cat.id || "",
          name: cat.name || "",
          slug: cat.slug || cat._id || cat.id || "",
        });
      }
    }
    return path;
  })();

  const brand =
    typeof backend.brand === "object" && backend.brand !== null
      ? (backend.brand as any).name
      : backend.brand || undefined;

  const brandSlug =
    typeof backend.brand === "object" && backend.brand !== null
      ? (backend.brand as any).slug
      : undefined;

  return {
    id: backend._id || backend.id || "",
    name: backend.name,
    title: backend.title || backend.name,
    slug: backend.slug,
    sku: backend.sku,
    enTitle: backend.enTitle,
    price: pricing.finalPrice,
    oldPrice: pricing.oldPrice,
    compareAtPrice: pricing.basePrice,
    discount: pricing.discount,
    image: images[0],
    images,
    category,
    categoryPath,
    brand,
    brandSlug,
    description: backend.description,
    rating: backend.rating ?? 0,
    reviewCount: backend.numReviews ?? backend.reviewCount ?? 0,
    countInStock: Number(countInStock) || 0,
    colors: backend.colors,
    specs: backend.specs,
    campaignLabel: backend.campaignLabel,
    campaignTheme: backend.campaignTheme,
    isFlashDeal: pricing.flashActive,
    flashDealEndTime: pricing.flashActive ? backend.flashDealEndTime : undefined,
    isSpecialOffer: pricing.specialActive,
    specialOfferEndTime: pricing.specialActive ? backend.specialOfferEndTime : undefined,
    isActive: backend.isActive,
  };
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

// Custom error class for rate limiting
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export const fetchProductById = cache(async (id: string): Promise<(Product & { isActive?: boolean }) | null> => {
  try {
    const response = await fetchWithRetry(
      `${apiBaseUrl}/products/${id}`,
      {
        next: { revalidate: 0 },
        cache: 'no-store',
      } as RequestInit,
      3, // max retries
      1000 // initial delay
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      if (response.status === 429) {
        // For 429, throw a specific error that can be handled by error boundary
        throw new RateLimitError(`سرور موقتاً درخواست‌ها را محدود کرده است. لطفاً چند ثانیه صبر کنید. (429)`);
      }
      throw new Error(`Failed to fetch product ${id} (${response.status})`);
    }

    const payload = await response.json();
    const data = (payload as any)?.data ?? payload;
    if (!data) return null;

    return mapBackendProduct(data as BackendProduct, apiBaseUrl);
  } catch (error) {
    // Re-throw RateLimitError for error boundary to catch
    if (error instanceof RateLimitError) {
      throw error;
    }
    // Log other errors and return null to prevent page crash
    console.error(`[productData] Error fetching product ${id}:`, error);
    throw error;
  }
});

export const fetchProductBySlug = cache(async (slug: string): Promise<(Product & { isActive?: boolean }) | null> => {
  try {
    // Try a slug endpoint first with retry
    const resSlug = await fetchWithRetry(
      `${apiBaseUrl}/products/slug/${slug}`,
      {
        next: { revalidate: 0 },
        cache: 'no-store',
      } as RequestInit,
      3,
      1000
    );
    if (resSlug.ok) {
      const payload = await resSlug.json();
      const data = (payload as any)?.data ?? payload;
      if (data) return mapBackendProduct(data as BackendProduct, apiBaseUrl);
    }
  } catch (e) {
    // fall back to other methods
    console.warn('[productData] Slug endpoint failed, trying fallback:', e);
  }

  // Fallback: try list query with retry
  try {
    const res = await fetchWithRetry(
      `${apiBaseUrl}/products?slug=${slug}`,
      {
        next: { revalidate: 0 },
        cache: 'no-store',
      } as RequestInit,
      2,
      1000
    );
    if (res.ok) {
      const payload = await res.json();
      const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
      if (item) return mapBackendProduct(item as BackendProduct, apiBaseUrl);
    }
  } catch (e) {
    // ignore and try final fallback
  }

  // Final fallback: maybe slug is actually ID
  return fetchProductById(slug);
});

export const fetchProductsForStatic = async (limit: number = 100): Promise<(Product & { isActive?: boolean })[]> => {
  try {
    const response = await fetchWithRetry(
      `${apiBaseUrl}/products?limit=${limit}`,
      {
        next: { revalidate: 0 },
        cache: 'no-store',
      } as RequestInit,
      3,
      1000
    );
    if (!response.ok) return [];
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    return items.map((p: BackendProduct) => mapBackendProduct(p, apiBaseUrl));
  } catch (error) {
    console.error("[product static] failed to fetch", error);
    return [];
  }
};

export { buildProductUrl };
