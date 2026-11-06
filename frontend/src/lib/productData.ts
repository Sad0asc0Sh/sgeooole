import { cache } from "react";
import type { Product, ProductAttribute, ProductColor, ProductVariant } from "@/types/product";
import { buildProductUrl } from "./paths";
import { buildProductSpecs, type BackendSpecifications } from "./productSpecs";
import { resolvePricing } from "@/lib/pricing";
import { updateServerClock, updateServerClockFromPayload } from "@/lib/serverClock";

const syncClockFromFetch = (response: Response | null | undefined, payload: unknown) => {
  try {
    updateServerClockFromPayload(payload);
    const dateHeader = response?.headers?.get?.("date");
    if (dateHeader) updateServerClock(dateHeader);
  } catch {
    // ignore clock sync errors
  }
};

// Enhanced fetch with retry logic and exponential backoff
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<Response> => {
  let lastError: Error | null = null;

  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
  const effectiveRetries = isBuildPhase ? Math.min(1, maxRetries) : maxRetries;
  const baseDelay = isBuildPhase ? 0 : initialDelay;
  const timeoutMs = isBuildPhase ? 3000 : 15000;

  for (let attempt = 0; attempt < effectiveRetries; attempt++) {
    // Guard access to options (may be undefined) and prefer an existing signal
    const providedSignal = options?.signal as AbortSignal | undefined;
    const controller = providedSignal ? null : new AbortController();
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetch(url, { ...options, signal: options.signal ?? controller?.signal });

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

        // Parse Retry-After header robustly: it may be either seconds or an HTTP-date
        const parseRetryAfter = (value: string | null): number | null => {
          if (!value) return null;
          // Try seconds first
          const seconds = parseInt(value, 10);
          if (!Number.isNaN(seconds)) return seconds * 1000;
          // Try HTTP-date
          const dateMs = Date.parse(value);
          if (!Number.isNaN(dateMs)) {
            const diff = dateMs - Date.now();
            return diff > 0 ? diff : 0;
          }
          return null;
        };

        const retryAfterMs = parseRetryAfter(retryAfter);
        let delay = typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs)
          ? retryAfterMs
          : baseDelay * Math.pow(2, attempt);

        if (!Number.isFinite(delay) || delay < 0) {
          delay = baseDelay * Math.pow(2, attempt);
        }

        // If this is the last attempt, return the error response
        if (attempt === effectiveRetries - 1) {
          return response;
        }

        if (process.env.NODE_ENV !== "production") {
          console.warn(`[productData] Retry attempt ${attempt + 1}/${effectiveRetries} after ${delay}ms for: ${url}`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Other errors - return response without retry
      return response;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Network error - retry with backoff
      if (attempt < effectiveRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[productData] Network error, retry attempt ${attempt + 1}/${effectiveRetries} after ${delay}ms`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // All retries exhausted - throw the last error
  throw lastError || new Error('Fetch failed after all retries');
};

// Reduced from 3600 (1 hour) to 30 seconds for real-time discount updates from admin panel
export const PRODUCT_REVALIDATE = 30;

type BackendImage = string | { url?: string; cardUrl?: string; sizes?: { card?: string; small?: string; thumbnail?: string } };

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
  productCode?: string; // SEO-friendly code (KY-XXXXXXX)
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
  // Two-layer spec model from the backend
  specifications?: BackendSpecifications;
  properties?: Array<{ label?: string; value?: unknown }>;
  guarantee?: string;
  campaignLabel?: string;
  campaignTheme?: string;
  compareAtPrice?: number;
  isFlashDeal?: boolean;
  flashDealEndTime?: string;
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;
  isActive?: boolean;
  categoryPath?: { _id?: string; id?: string; slug?: string; name?: string }[];
  productType?: "simple" | "variable";
  attributes?: Array<{ name: string; values: string[]; displayType?: "button" | "color"; swatches?: Array<{ value: string; hex: string }> }>;
  variants?: Array<{ _id: string; sku?: string; price: number; compareAtPrice?: number; stock: number; options: Array<{ name: string; value: string }>; images?: BackendImage[]; excludeFromPromotion?: boolean }>;
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

/** Card (420px) variant of a backend image: cardUrl → legacy size buckets. */
const normalizeCardImage = (img: BackendImage, assetBase: string): string | null => {
  if (!img || typeof img !== "object") return null;
  const url = img.cardUrl || img.sizes?.card || img.sizes?.small || img.sizes?.thumbnail;
  if (typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();
  return trimmed.startsWith("/") ? `${assetBase}${trimmed}` : trimmed;
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

  // images/cardImages are built in ONE pass so the two arrays stay strictly
  // parallel: cardImages[i] is always the card variant of images[i] (or the
  // main URL itself when no card variant exists). Filtering the two arrays
  // independently shifted indexes and showed the wrong photo in galleries.
  const pairImage = (img: BackendImage): { main: string; card: string } | null => {
    const main = normalizeImage(img, assetBase);
    if (!main) return null;
    return { main, card: normalizeCardImage(img, assetBase) || main };
  };

  let images: string[] = [];
  let cardImages: string[] = [];
  if (backend.images && backend.images.length > 0) {
    for (const img of backend.images) {
      const pair = pairImage(img);
      if (pair) {
        images.push(pair.main);
        cardImages.push(pair.card);
      }
    }
  }

  if (images.length === 0 && backend.image) {
    const pair = pairImage(backend.image);
    if (pair) {
      images = [pair.main];
      cardImages = [pair.card];
    }
  }

  // Fallback for variable products whose images live inside variants[].images
  if (images.length === 0 && Array.isArray(backend.variants)) {
    for (const v of backend.variants) {
      if (!v || !Array.isArray(v.images)) continue;
      for (const img of v.images) {
        const pair = pairImage(img);
        if (pair && !images.includes(pair.main)) {
          images.push(pair.main);
          cardImages.push(pair.card);
        }
      }
    }
  }

  if (images.length === 0) {
    images = ["/placeholder.svg"];
  }

  const countInStock = backend.stock ?? backend.countInStock ?? 0;

  // Variable-product mapping — mirror of services/productService mapBackendToFrontend.
  // The PDP is server-rendered through this mapper, so without it the page would
  // still show variable products as out-of-stock with no selector.
  // A non-empty variants array MEANS variable, even for legacy docs whose
  // productType was never set (same rule as the client mapper).
  const rawBackendVariants = Array.isArray(backend.variants) ? backend.variants : [];
  const isVariable = rawBackendVariants.length > 0;

  const mappedVariants: ProductVariant[] = isVariable
    ? rawBackendVariants
      .filter((v): v is NonNullable<typeof v> => Boolean(v) && typeof v === "object")
      .map((v) => {
        // مدل مستثنی: تخفیف صفر تا قیمت پایه بماند؛ آینه‌ی services/productService.
        const excluded = v.excludeFromPromotion === true;
        const vp = resolvePricing({
          price: Number(v.price) || 0,
          discount: excluded ? 0 : backend.discount,
          compareAtPrice: v.compareAtPrice,
          isFlashDeal: excluded ? false : backend.isFlashDeal,
          flashDealEndTime: backend.flashDealEndTime,
          isSpecialOffer: excluded ? false : backend.isSpecialOffer,
          specialOfferEndTime: backend.specialOfferEndTime,
          campaignLabel: excluded ? undefined : backend.campaignLabel,
        });
        return {
          id: v._id,
          sku: v.sku,
          stock: Number(v.stock) || 0,
          options: Array.isArray(v.options) ? v.options : [],
          price: vp.finalPrice,
          oldPrice: vp.oldPrice,
          // Paired in one pass (see pairImage): cardImages[i] ↔ images[i].
          ...(() => {
            const vImages: string[] = [];
            const vCardImages: string[] = [];
            for (const img of v.images ?? []) {
              const pair = pairImage(img);
              if (pair) {
                vImages.push(pair.main);
                vCardImages.push(pair.card);
              }
            }
            return { images: vImages, cardImages: vCardImages };
          })(),
          ...(excluded ? { excludeFromPromotion: true as const } : {}),
        };
      })
    : [];

  const mappedAttributes: ProductAttribute[] = (backend.attributes ?? [])
    .filter((a): a is NonNullable<typeof a> => Boolean(a) && typeof a === "object")
    .map((a) => ({
      name: a.name,
      values: Array.isArray(a.values) ? a.values : [],
      displayType: a.displayType,
      swatches: Object.fromEntries((a.swatches ?? []).map((s) => [s.value, s.hex])),
    }));

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
    productCode: backend.productCode, // SEO-friendly product code (KY-XXXXXXX)
    enTitle: backend.enTitle,
    price: pricing.finalPrice,
    oldPrice: pricing.oldPrice,
    compareAtPrice: pricing.basePrice,
    discount: pricing.discount,
    image: images[0],
    cardImage: cardImages[0] || images[0],
    images,
    cardImages: cardImages.length > 0 ? cardImages : images,
    category,
    categoryPath,
    brand,
    brandSlug,
    description: backend.description,
    rating: backend.rating ?? 0,
    reviewCount: backend.numReviews ?? backend.reviewCount ?? 0,
    countInStock:
      isVariable && mappedVariants.length > 0
        ? mappedVariants.reduce((sum, v) => sum + v.stock, 0)
        : Number(countInStock) || 0,
    colors: backend.colors,
    // تب «مشخصات فنی»: specifications (متن کامل) + properties + گارانتی
    specs: buildProductSpecs({
      specifications: backend.specifications,
      specs: backend.specs,
      properties: backend.properties,
      guarantee: backend.guarantee,
    }),
    guarantee: backend.guarantee,
    campaignLabel: backend.campaignLabel,
    campaignTheme: backend.campaignTheme,
    // Time-based promotions (keep raw flags/timers; UI derives active state)
    isFlashDeal: Boolean(backend.isFlashDeal),
    flashDealEndTime: backend.flashDealEndTime || undefined,
    isSpecialOffer: Boolean(backend.isSpecialOffer),
    specialOfferEndTime: backend.specialOfferEndTime || undefined,
    isActive: backend.isActive,
    // Variable-product fields; price override (cheapest) comes last.
    productType: isVariable ? "variable" : "simple",
    attributes: mappedAttributes,
    variants: mappedVariants,
    ...(isVariable &&
      mappedVariants.length > 0 && {
        price: Math.min(...mappedVariants.map((v) => v.price)),
      }),
  };
};

const apiBaseUrl = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://localhost:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")).replace(/\/$/, "");

const encodePathSegment = (value: string) => {
  // Avoid double-encoding: Next/router params may already be percent-encoded.
  if (/%[0-9A-Fa-f]{2}/.test(value)) return value;
  return encodeURIComponent(value);
};

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
      `${apiBaseUrl}/products/${encodePathSegment(id)}?nocache=true`,
      {
        next: { revalidate: PRODUCT_REVALIDATE },
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
    syncClockFromFetch(response, payload);
    const data = (payload as any)?.data ?? payload;
    if (!data) return null;

    return mapBackendProduct(data as BackendProduct, apiBaseUrl);
  } catch (error) {
    // Keep RateLimitError for runtime error boundaries, but never fail the production build.
    if (error instanceof RateLimitError) {
      if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export") {
        return null;
      }
      throw error;
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[productData] Error fetching product ${id}:`, error);
    } else {
      console.warn(`[productData] Error fetching product ${id}`);
    }
    return null;
  }
});

/**
 * Fetch product by productCode (e.g., "ky-1234567" or "KY-1234567")
 * Falls back to ID lookup if code lookup fails
 */
export const fetchProductByCode = cache(async (code: string): Promise<(Product & { isActive?: boolean; productCode?: string }) | null> => {
  // Normalize code to uppercase
  const normalizedCode = code.toUpperCase();

  try {
    // Try to fetch by productCode first
    const response = await fetchWithRetry(
      `${apiBaseUrl}/products/code/${encodePathSegment(normalizedCode)}?nocache=true`,
      {
        next: { revalidate: PRODUCT_REVALIDATE },
      } as RequestInit,
      2,
      1000
    );

    if (response.ok) {
      const payload = await response.json();
      syncClockFromFetch(response, payload);
      const data = (payload as any)?.data ?? payload;
      if (data) {
        const product = mapBackendProduct(data as BackendProduct, apiBaseUrl);
        // Attach productCode to the result
        return { ...product, productCode: data.productCode || normalizedCode };
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn('[productData] Code lookup failed, trying fallback:', e);
    } else {
      console.warn('[productData] Code lookup failed, trying fallback');
    }
  }

  // Fallback: try by ID (for backward compatibility with old URLs)
  try {
    return await fetchProductById(code);
  } catch {
    console.warn('[productData] ID fallback also failed');
  }

  return null;
});

export const fetchProductBySlug = cache(async (slug: string): Promise<(Product & { isActive?: boolean }) | null> => {
  // Backend supports resolving by slug via GET /api/products/:id (fallback lookup by slug).
  return fetchProductById(slug);
});

export const fetchProductsForStatic = async (limit: number = 100): Promise<(Product & { isActive?: boolean })[]> => {
  try {
    const response = await fetchWithRetry(
      `${apiBaseUrl}/products?limit=${limit}&nocache=true`,
      {
        next: { revalidate: 3600 },
      } as RequestInit,
      3,
      1000
    );
    if (!response.ok) return [];
    const payload = await response.json();
    syncClockFromFetch(response, payload);
    const items = Array.isArray(payload?.data) ? payload.data : [];
    return items.map((p: BackendProduct) => mapBackendProduct(p, apiBaseUrl));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[product static] failed to fetch", error);
    } else {
      console.warn("[product static] failed to fetch");
    }
    return [];
  }
};

/**
 * Fetch related products by category (SSR-safe, uses native fetch)
 * This replaces productService.getRelated for server components to avoid url.parse() deprecation
 * Uses smart category fallback: tries leaf category first, then parent categories with includeChildren
 * @param categoryPath - Array of category objects from root to leaf
 * @param currentProductId - Current product ID to exclude from results
 * @param limit - Number of products to return (default: 10)
 */
export const fetchRelatedProducts = cache(async (
  categoryPath: Array<{ id: string; name?: string; slug?: string }>,
  currentProductId: string,
  limit: number = 10
): Promise<(Product & { isActive?: boolean })[]> => {
  if (!categoryPath || categoryPath.length === 0) {
    return [];
  }

  try {
    const fetchLimit = limit + 5;
    let relatedProducts: (Product & { isActive?: boolean })[] = [];

    // Strategy: Start from the leaf category and move up to parent categories
    // Use includeChildren to get products from this category and all its children
    for (let i = categoryPath.length - 1; i >= 0 && relatedProducts.length < limit; i--) {
      const category = categoryPath[i];
      if (!category?.id) continue;

      // Use includeChildren=true to get products from this category and all its children
      const response = await fetchWithRetry(
        `${apiBaseUrl}/products?category=${category.id}&includeChildren=true&limit=${fetchLimit}&nocache=true`,
        {
          // 30s to match the PDP route revalidate (lowest fetch revalidate wins
          // for the route's Cache-Control header).
          next: { revalidate: 30 },
        } as RequestInit,
        2,
        1000
      );

      if (!response.ok) continue;

      const payload = await response.json();
      syncClockFromFetch(response, payload);
      const items = Array.isArray(payload?.data) ? payload.data : [];

      // Filter out the current product
      const filteredItems = items
        .filter((item: BackendProduct) => (item._id || item.id) !== currentProductId)
        .slice(0, limit)
        .map((p: BackendProduct) => mapBackendProduct(p, apiBaseUrl));

      if (filteredItems.length > 0) {
        relatedProducts = filteredItems;
        break; // Found enough products, stop searching
      }
    }

    return relatedProducts;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[productData] Error fetching related products:`, error);
    } else {
      console.warn(`[productData] Error fetching related products`);
    }
    return []; // Return empty array instead of throwing to prevent page crash
  }
});

export { buildProductUrl };
