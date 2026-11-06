"use client";
/**
 * Product Service - Client-Side API Wrapper
 * 
 * ⚠️  DEP0169 SAFETY NOTE:
 * This file uses axios which internally calls url.parse() (deprecated in Node.js).
 * This file is marked as "use client" to prevent it from being bundled in Server Components.
 * 
 * For Server Components (SSR), use:
 * - Import types from "@/types/product" (SSR-safe, no runtime dependencies)
 * - Use functions from "@/lib/productData" for data fetching (uses native fetch)
 * 
 * DO NOT import this file in Server Components!
 */

import api from "@/lib/api";
import { resolvePricing } from "@/lib/pricing";
import { buildProductSpecs } from "@/lib/productSpecs";
import { appendPropertyFilters, type ProductFilterProperties, type ProductFilterFacets } from "@/lib/productFilters";

// Re-export types from the SSR-safe types file for backward compatibility
// This allows existing client components to continue using `import { Product } from "@/services/productService"`
export type {
  Product,
  ProductColor,
  ProductSpec,
  CategoryPathItem,
  CategoryProperty,
  CategoryDetails,
  ProductWithStatus,
  ProductAttribute,
  ProductVariant,
  ProductVariantOption,
} from "@/types/product";

// Import types for internal use
import type {
  Product,
  ProductColor,
  ProductSpec,
  CategoryPathItem,
  CategoryDetails,
  ProductAttribute,
  ProductVariant,
} from "@/types/product";



type BackendImage = string | { url?: string; cardUrl?: string; sizes?: { card?: string; small?: string; thumbnail?: string } };

type BackendCategory = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  parent?: BackendCategory | string | null;
};

type BackendBrand = { _id?: string; id?: string; name?: string; slug?: string } | string | null;

type BackendCategoryPathItem = { _id?: string; id?: string; slug?: string; name?: string };

// Backend MongoDB Product Interface (typical structure)
interface BackendProduct {
  _id: string;
  name: string;
  sku?: string;
  productCode?: string;
  slug?: string;
  enTitle?: string;
  price: number;
  image?: BackendImage;
  images?: BackendImage[];
  category?: BackendCategory | string | null;
  categoryPath?: BackendCategoryPathItem[];
  // CRITICAL: Backend uses 'stock' field, not 'countInStock'
  stock?: number;
  countInStock?: number; // Keep for backward compatibility
  rating?: number;
  numReviews?: number;
  description?: string;
  brand?: BackendBrand;
  createdAt?: string;
  updatedAt?: string;
  discount?: number;
  colors?: ProductColor[];
  specs?: ProductSpec[];
  campaignLabel?: string;
  campaignTheme?: string;
  compareAtPrice?: number;

  // Time-based promotion fields (matching backend model)
  isFlashDeal?: boolean;
  flashDealEndTime?: string; // Date from backend becomes ISO string
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;

  // Dynamic properties (category-based specifications)
  properties?: Array<{ label: string; value: string }>;
  // Full-text spec table (backend `specifications`) + guarantee
  specifications?: Record<string, unknown> | Array<{ key?: string; label?: string; name?: string; value?: unknown }>;
  guarantee?: string;

  // Variable-product fields (only present when productType === 'variable')
  productType?: "simple" | "variable";
  attributes?: Array<{ name: string; values: string[]; displayType?: "button" | "color"; swatches?: Array<{ value: string; hex: string }> }>;
  variants?: Array<{ _id: string; sku?: string; price: number; compareAtPrice?: number; stock: number; options: Array<{ name: string; value: string }>; images?: BackendImage[]; excludeFromPromotion?: boolean }>;
}

/**
 * Data Mapper: Transform MongoDB document to Frontend Product interface
 * This prevents backend schema changes from breaking the UI
 */
const mapBackendToFrontend = (backendProduct: BackendProduct): Product => {
  // Debug: Log SKU from backend
  if (backendProduct.sku) {
    console.log(`[DEBUG] Product "${backendProduct.name}" has SKU: ${backendProduct.sku}`);
  }

  const pricing = resolvePricing({
    price: backendProduct.price,
    discount: backendProduct.discount,
    compareAtPrice: backendProduct.compareAtPrice,
    isFlashDeal: backendProduct.isFlashDeal,
    flashDealEndTime: backendProduct.flashDealEndTime,
    isSpecialOffer: backendProduct.isSpecialOffer,
    specialOfferEndTime: backendProduct.specialOfferEndTime,
    campaignLabel: backendProduct.campaignLabel,
  });

  // Handle images - support string URLs and objects with `url`
  const normalizeImage = (img: any): string | null => {
    let url: string | null = null;
    if (typeof img === "string" && img.trim() !== "") url = img.trim();
    else if (img && typeof img === "object" && typeof img.url === "string" && img.url.trim() !== "") {
      url = img.url.trim();
    }

    if (url) {
      // If url is relative (starts with /), prepend the backend URL
      if (url.startsWith("/")) {
        const API_URL = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://127.0.0.1:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api"));
        let BACKEND_URL = API_URL.replace(/\/api\/?$/, "");
        // Force localhost to 127.0.0.1 to avoid Next.js private IP errors
        BACKEND_URL = BACKEND_URL.replace("localhost", "127.0.0.1");
        return `${BACKEND_URL}${url}`;
      }
      return url;
    }
    return null;
  };

  // Card (420px) variant of a backend image: cardUrl first, then legacy
  // size buckets, then the main URL. Returns null when nothing usable.
  const normalizeCardImage = (img: any): string | null => {
    if (!img || typeof img !== "object") return null;
    const url = img.cardUrl || img.sizes?.card || img.sizes?.small || img.sizes?.thumbnail;
    return typeof url === "string" && url.trim() !== "" ? url.trim() : null;
  };

  // images/cardImages are built in ONE pass so the two arrays stay strictly
  // parallel: cardImages[i] is always the card variant of images[i] (or the
  // main URL itself when no card variant exists). Filtering the two arrays
  // independently shifted indexes and showed the wrong photo in galleries.
  const pairImage = (img: any): { main: string; card: string } | null => {
    const main = normalizeImage(img);
    if (!main) return null;
    return { main, card: normalizeCardImage(img) || main };
  };

  let imageArray: string[] = [];
  let cardImageArray: string[] = [];
  if (backendProduct.images && backendProduct.images.length > 0) {
    for (const img of backendProduct.images) {
      const pair = pairImage(img);
      if (pair) {
        imageArray.push(pair.main);
        cardImageArray.push(pair.card);
      }
    }
  }
  if (imageArray.length === 0 && backendProduct.image) {
    const pair = pairImage(backendProduct.image);
    if (pair) {
      imageArray = [pair.main];
      cardImageArray = [pair.card];
    }
  }
  if (imageArray.length === 0 && Array.isArray(backendProduct.variants)) {
    for (const v of backendProduct.variants) {
      if (!v || !Array.isArray(v.images)) continue;
      for (const img of v.images) {
        const pair = pairImage(img);
        if (pair && !imageArray.includes(pair.main)) {
          imageArray.push(pair.main);
          cardImageArray.push(pair.card);
        }
      }
    }
  }
  if (imageArray.length === 0) {
    imageArray = ["/placeholder.svg"];
  }

  // CRITICAL FIX: Backend uses 'stock', not 'countInStock'
  // Check both fields for compatibility (backend uses 'stock', some APIs might use 'countInStock')
  const countInStock = backendProduct.stock !== undefined
    ? Number(backendProduct.stock)
    : (backendProduct.countInStock !== undefined
      ? Number(backendProduct.countInStock)
      : 0);

  // Variable-product mapping: each variant gets the same pricing contract as
  // simple products (resolvePricing with the product-level discount/flags).
  // Guards: corrupt entries (null, non-object) are skipped, never crash mapping.
  // A non-empty variants array MEANS variable — even for legacy docs whose
  // productType was never set (or was overwritten to 'simple' by an edit that
  // didn't touch variants). Otherwise such products fall back to product-level
  // pricing: a phantom discount on a base price with no «از» prefix.
  const rawBackendVariants = Array.isArray(backendProduct.variants) ? backendProduct.variants : [];
  const isVariable = rawBackendVariants.length > 0;

  const variants: ProductVariant[] = isVariable
    ? rawBackendVariants
      .filter((v): v is NonNullable<typeof v> => Boolean(v) && typeof v === "object")
      .map((v) => {
        // وariant مستثنی: تخفیف صفر تا قیمت پایه بماند؛ بقیه مثل قبل با تخفیف محصول.
        const excluded = (v as { excludeFromPromotion?: unknown }).excludeFromPromotion === true;
        const vp = resolvePricing({
          price: Number(v.price) || 0,
          discount: excluded ? 0 : backendProduct.discount,
          compareAtPrice: v.compareAtPrice,
          isFlashDeal: excluded ? false : backendProduct.isFlashDeal,
          flashDealEndTime: backendProduct.flashDealEndTime,
          isSpecialOffer: excluded ? false : backendProduct.isSpecialOffer,
          specialOfferEndTime: backendProduct.specialOfferEndTime,
          campaignLabel: excluded ? undefined : backendProduct.campaignLabel,
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

  const attributes: ProductAttribute[] = (backendProduct.attributes ?? [])
    .filter((a): a is NonNullable<typeof a> => Boolean(a) && typeof a === "object")
    .map((a) => ({
      name: a.name,
      values: Array.isArray(a.values) ? a.values : [],
      displayType: a.displayType,
      swatches: Object.fromEntries((a.swatches ?? []).map((s) => [s.value, s.hex])),
    }));

  return {
    // MongoDB uses _id, our UI expects id
    id: backendProduct._id,

    // Name/Title mappings
    name: backendProduct.name,
    title: backendProduct.name, // Use name as title
    slug: backendProduct.slug, // Ensure slug is mapped if available
    sku: backendProduct.sku,
    productCode: backendProduct.productCode,
    enTitle: backendProduct.enTitle,

    // Price calculations
    price: pricing.finalPrice,
    oldPrice: pricing.oldPrice,
    compareAtPrice: pricing.basePrice,
    discount: pricing.discount,

    // Images
    image: imageArray[0], // First image as main image
    cardImage: cardImageArray[0] || imageArray[0],
    images: imageArray, // All images for gallery
    cardImages: cardImageArray.length > 0 ? cardImageArray : imageArray,

    // Category and Brand (Handle both string ID and populated object)
    category: (() => {
      // Prefer backend-provided full category path when available (supports deep nesting)
      if (Array.isArray(backendProduct.categoryPath) && backendProduct.categoryPath.length > 0) {
        const names = backendProduct.categoryPath
          .map((c) => (typeof c?.name === "string" ? c.name.trim() : ""))
          .filter(Boolean);
        if (names.length > 0) return names.join(" > ");
      }

      let display = "عمومی";
      if (typeof backendProduct.category === 'object' && backendProduct.category !== null) {
        const cat = backendProduct.category as any;
        if (cat.parent && cat.parent.name) {
          display = `${cat.parent.name} > ${cat.name}`;
        } else if (cat.name) {
          display = cat.name;
        }
      } else if (backendProduct.category) {
        // Check if it's a MongoDB ObjectId (24 hex characters) - don't display it
        const isObjectId = /^[a-fA-F0-9]{24}$/.test(backendProduct.category);
        if (!isObjectId) {
          display = backendProduct.category;
        }
      }
      return display;
    })(),

    categoryPath: (() => {
      if (Array.isArray(backendProduct.categoryPath) && backendProduct.categoryPath.length > 0) {
        return backendProduct.categoryPath
          .map((c) => ({
            id: c._id || c.id || "",
            name: c.name || "",
            slug: c.slug || c._id || c.id || "",
          }))
          .filter((c) => c.id);
      }

      const path: CategoryPathItem[] = [];
      if (typeof backendProduct.category === 'object' && backendProduct.category !== null) {
        const cat = backendProduct.category as any;
        // Add parent if exists
        if (cat.parent && cat.parent.name) {
          path.push({
            id: cat.parent._id,
            name: cat.parent.name,
            slug: cat.parent.slug || cat.parent._id
          });
        }
        // Add current category
        path.push({
          id: cat._id,
          name: cat.name,
          slug: cat.slug || cat._id
        });
      }
      return path;
    })(),

    brand: typeof backendProduct.brand === 'object' && backendProduct.brand !== null
      ? (backendProduct.brand as any).name
      : backendProduct.brand || undefined,

    brandSlug: typeof backendProduct.brand === 'object' && backendProduct.brand !== null
      ? (backendProduct.brand as any).slug
      : undefined,

    // Description
    description: backendProduct.description,

    // Ratings and Reviews
    rating: backendProduct.rating || 0,
    reviewCount: backendProduct.numReviews || 0,

    // Stock - THE CRITICAL FIX
    countInStock: countInStock,

    // Colors (optional)
    colors: backendProduct.colors,

    // Specifications: specifications (full text) + properties + guarantee
    specs: buildProductSpecs({
      specifications: backendProduct.specifications,
      specs: backendProduct.specs,
      properties: backendProduct.properties,
      guarantee: backendProduct.guarantee,
    }),
    guarantee: backendProduct.guarantee,

    // Campaign label (time-limited discount)
    campaignLabel: backendProduct.campaignLabel,
    campaignTheme: backendProduct.campaignTheme,

    // Time-based promotions (keep raw flags/timers; UI derives active state)
    isFlashDeal: Boolean(backendProduct.isFlashDeal),
    flashDealEndTime: backendProduct.flashDealEndTime || undefined,
    isSpecialOffer: Boolean(backendProduct.isSpecialOffer),
    specialOfferEndTime: backendProduct.specialOfferEndTime || undefined,

    // Variable-product fields. For variable products the card-level price is the
    // cheapest variant and stock is the total (this also fixes variable products
    // showing as "ناموجود" since top-level price/stock are empty for them).
    // Spread last so it overrides the simple-product price/countInStock above.
    // Simple products are untouched (isVariable === false → no override).
    productType: isVariable ? "variable" : "simple",
    attributes,
    variants,
    ...(isVariable && variants.length > 0 && {
      price: Math.min(...variants.map((v) => v.price)),
      countInStock: variants.reduce((sum, v) => sum + v.stock, 0),
    }),
  };
};

/**
 * Product Service - Centralized API calls for products
 */
export const productService = {
  /**
   * Helper to safely extract a list of backend products
   * Backend typically responds with: { success, data: [...], pagination? }
   */
  _extractList: (response: any): BackendProduct[] => {
    const payload = response?.data;

    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  },

  /**
   * Helper to safely extract a single backend product
   * Backend typically responds with: { success, data: {...} }
   */
  _extractItem: (response: any): BackendProduct => {
    const payload = response?.data;

    if (payload && !Array.isArray(payload) && payload.data) {
      return payload.data;
    }
    return payload as BackendProduct;
  },

  /**
   * Fetch all products
   */
  getAll: async (): Promise<Product[]> => {
    try {
      const response = await api.get(`/products?_t=${Date.now()}`);
      // Map each backend product to frontend format
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  },

  /**
   * Fetch newest products (sorted by creation date)
   * @param limit - Number of products to return (default: 10)
   */
  getNewest: async (limit: number = 10): Promise<Product[]> => {
    try {
      // Include all promotion metadata required by the shared card resolver.
      // productType + variants are mandatory: without them a variable product
      // arrives variant-less and the card falls back to product-level pricing
      // (the exact discount bug this file's mapper otherwise prevents).
      const fields = 'name,slug,productCode,price,discount,images,stock,compareAtPrice,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,campaignLabel,campaignTheme,productType,variants';
      const response = await api.get(`/products?sort=-createdAt&limit=${limit}&fields=${fields}&nocache=true`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching newest products:", error);
      throw error;
    }
  },

  /**
   * Fetch best-selling products from the dedicated bestsellers scoring engine.
   * Uses the /bestsellers endpoint which leverages ProductScore with decayed_score
   * for accurate bestseller ranking (vs. naive salesCount sort).
   * @param limit - Number of products to return (default: 10)
   */
  getBestSellers: async (limit: number = 10): Promise<Product[]> => {
    try {
      // Primary: Use the dedicated bestsellers endpoint (ProductScore engine)
      // Best-seller cards can contain time-limited promotions; request the
      // current payload instead of the endpoint's long-lived ranking cache.
      const response = await api.get(`/bestsellers?limit=${limit}&in_stock=true&nocache=true`);
      const payload = response?.data;

      // The bestsellers endpoint returns { success, data: [...] }
      // where each item has a different shape than standard products
      if (payload?.success && Array.isArray(payload.data) && payload.data.length > 0) {
        return payload.data.map((item: any) => {
          // Map bestsellers response format to frontend Product interface
          const normalizeImage = (img: any): string | null => {
            if (!img) return null;
            let url: string | null = null;
            if (typeof img === "string" && img.trim() !== "") url = img.trim();
            else if (img && typeof img === "object" && typeof img.url === "string" && img.url.trim() !== "") {
              url = img.url.trim();
            }
            if (url && url.startsWith("/")) {
              const API_URL = (typeof window === "undefined" ? (process.env.INTERNAL_API_URL || "http://127.0.0.1:5000/api") : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api"));
              let BACKEND_URL = API_URL.replace(/\/api\/?$/, "");
              BACKEND_URL = BACKEND_URL.replace("localhost", "127.0.0.1");
              return `${BACKEND_URL}${url}`;
            }
            return url;
          };

          // Handle image - bestsellers returns image as string or object
          const imageUrl = normalizeImage(item.image) || "/placeholder.svg";
          const cardImageUrl =
            (item.image && typeof item.image === "object"
              ? item.image.cardUrl || item.image.sizes?.card || item.image.sizes?.small || item.image.sizes?.thumbnail
              : null) || imageUrl;

          // Handle stock - could be a number or an object with variants
          const stock = typeof item.stock === 'number' ? item.stock : 0;
          const pricing = resolvePricing({
            price: item.price || 0,
            discount: item.discount,
            compareAtPrice: item.compareAtPrice,
            isFlashDeal: item.isFlashDeal,
            flashDealEndTime: item.flashDealEndTime,
            isSpecialOffer: item.isSpecialOffer,
            specialOfferEndTime: item.specialOfferEndTime,
            campaignLabel: item.campaignLabel,
          });

          // Variable products: same per-variant pricing contract as the main
          // mapper (excluded models keep their base price). The endpoint does
          // not return variants today, so this is defensive — when absent the
          // card keeps the previous simple-product behavior.
          const rawVariants = Array.isArray(item.variants) ? item.variants : [];
          // Same rule as the main mappers: a non-empty variants array means
          // variable (covers legacy docs and stale caches without the flag).
          const isVariable = rawVariants.length > 0;
          const variants: ProductVariant[] = isVariable
            ? rawVariants
              .filter((v: unknown): v is NonNullable<typeof v> => Boolean(v) && typeof v === "object")
              .map((v: any) => {
                const excluded = v.excludeFromPromotion === true;
                const vp = resolvePricing({
                  price: Number(v.price) || 0,
                  discount: excluded ? 0 : item.discount,
                  compareAtPrice: v.compareAtPrice,
                  isFlashDeal: excluded ? false : item.isFlashDeal,
                  flashDealEndTime: item.flashDealEndTime,
                  isSpecialOffer: excluded ? false : item.isSpecialOffer,
                  specialOfferEndTime: item.specialOfferEndTime,
                  campaignLabel: excluded ? undefined : item.campaignLabel,
                });
                return {
                  id: v._id,
                  sku: v.sku,
                  stock: Number(v.stock) || 0,
                  options: Array.isArray(v.options) ? v.options : [],
                  price: vp.finalPrice,
                  oldPrice: vp.oldPrice,
                  images: (Array.isArray(v.images) ? v.images : []).map(normalizeImage).filter((x: unknown): x is string => Boolean(x)),
                  ...(excluded ? { excludeFromPromotion: true as const } : {}),
                };
              })
            : [];

          return {
            id: item._id,
            name: item.name || "",
            title: item.name || "",
            slug: item.slug || "",
            // Without productCode, buildProductUrl() falls back to the Mongo
            // _id and best-seller cards link to the legacy /product/<id>/…
            // format instead of the canonical /product/KY-…/… URL.
            productCode: item.productCode || undefined,
            price: pricing.finalPrice,
            oldPrice: pricing.oldPrice,
            compareAtPrice: pricing.basePrice,
            discount: pricing.discount,
            image: imageUrl,
            cardImage: cardImageUrl,
            images: [imageUrl],
            cardImages: [cardImageUrl],
            category: item.category?.name || "عمومی",
            categoryPath: item.category ? [{ id: item.category._id || "", name: item.category.name || "", slug: item.category.slug || "" }] : [],
            rating: item.average_rating || 0,
            reviewCount: item.review_count || 0,
            countInStock: stock,
            campaignLabel: item.campaignLabel || undefined,
            campaignTheme: item.campaignTheme || undefined,
            isFlashDeal: Boolean(item.isFlashDeal),
            flashDealEndTime: item.flashDealEndTime || undefined,
            isSpecialOffer: Boolean(item.isSpecialOffer),
            specialOfferEndTime: item.specialOfferEndTime || undefined,
            productType: isVariable ? "variable" : "simple",
            attributes: [],
            variants,
            ...(isVariable && variants.length > 0 && {
              price: Math.min(...variants.map((v) => v.price)),
              countInStock: variants.reduce((sum, v) => sum + v.stock, 0),
            }),
          } as Product;
        });
      }

      // Fallback: If bestsellers endpoint returns empty or fails,
      // fall back to regular products sorted by salesCount (only products with actual sales)
      console.warn("[ProductService] Bestsellers endpoint returned empty, falling back to salesCount sort");
      const fallbackResponse = await api.get(`/products?sort=-salesCount&minSalesCount=1&limit=${limit}&_t=${Date.now()}`);
      const items = productService._extractList(fallbackResponse);
      if (items.length > 0) {
        return items.map(mapBackendToFrontend);
      }
      // If no products with sales, return empty - don't show newest products as bestsellers
      return [];
    } catch (error) {
      console.error("Error fetching best sellers:", error);
      // Final fallback: try the simple products endpoint with sales filter
      try {
        const fallbackResponse = await api.get(`/products?sort=-salesCount&minSalesCount=1&limit=${limit}&_t=${Date.now()}`);
        const items = productService._extractList(fallbackResponse);
        return items.map(mapBackendToFrontend);
      } catch (fallbackError) {
        console.error("Error in bestsellers fallback:", fallbackError);
        throw error;
      }
    }
  },

  /**
   * Fetch products with discount
   * @param limit - Number of products to return (default: 10)
   */
  getDiscounted: async (limit: number = 10): Promise<Product[]> => {
    try {
      const response = await api.get(`/products?hasDiscount=true&limit=${limit}&_t=${Date.now()}`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching discounted products:", error);
      throw error;
    }
  },

  /**
   * Fetch single product by ID
   * @param id - Product ID
   */
  getById: async (id: string): Promise<Product> => {
    try {
      const response = await api.get(`/products/${id}?_t=${Date.now()}`);
      const item = productService._extractItem(response);
      return mapBackendToFrontend(item);
    } catch (error) {
      console.error(`Error fetching product ${id}:`, error);
      throw error;
    }
  },

  /**
   * Fetch products by category
   * @param category - Category name
   * @param limit - Number of products to return
   */
  getByCategory: async (category: string, limit?: number): Promise<Product[]> => {
    try {
      const limitParam = limit ? `&limit=${limit}` : "";
      const response = await api.get(`/products?category=${category}${limitParam}&_t=${Date.now()}`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error(`Error fetching products for category ${category}:`, error);
      throw error;
    }
  },

  /**
   * Fetch flash deal products (with active countdown timers)
   * @param limit - Number of products to return (default: 10)
   */
  getFlashDeals: async (limit: number = 10): Promise<Product[]> => {
    try {
      // Query products with isFlashDeal=true and flashDealEndTime greater than now
      // OPTIMIZED: Only fetch fields needed for rail display (+ productType/variants
      // so variable products resolve per-variant pricing instead of product-level).
      const now = new Date().toISOString();
      const fields = 'name,slug,productCode,price,discount,images,stock,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,compareAtPrice,productType,variants';
      const response = await api.get(`/products?isFlashDeal=true&flashDealEndTime[gt]=${now}&limit=${limit}&fields=${fields}&nocache=true`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching flash deals:", error);
      throw error;
    }
  },

  /**
   * Fetch special offer products (with global countdown timer)
   * @param limit - Number of products to return (default: 10)
   */
  getSpecialOffers: async (limit: number = 10): Promise<Product[]> => {
    try {
      // «منتخب‌ها»: شگفت‌انگیزهای دستی فعال + محصولات تخفیف‌های زمان‌داری که گزینه‌ی
      // «نمایش در منتخب‌های صفحه اصلی» دارند (با لیبل همان تخفیف). فیلتر زمانی در بک‌اند اعمال می‌شود.
      // OPTIMIZED: Only fetch fields needed for rail display (+ productType/variants
      // so variable products resolve per-variant pricing instead of product-level).
      const fields = 'name,slug,productCode,price,discount,images,stock,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,compareAtPrice,campaignLabel,campaignTheme,productType,variants';
      const response = await api.get(`/products?featured=true&limit=${limit}&fields=${fields}&nocache=true`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching special offers:", error);
      throw error;
    }
  },
  /**
   * Fetch products with advanced filtering
   */
  getProducts: async (params: {
    page?: number;
    limit?: number;
    sort?: string;
    category?: string;
    brand?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    properties?: ProductFilterProperties;
    includeChildren?: boolean;
    inStock?: boolean;
    onSale?: boolean;
    minRating?: number;
  }): Promise<{ products: Product[]; total: number; totalPages: number; currentPage: number; priceRange?: { min: number; max: number }; facets?: ProductFilterFacets }> => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set("page", params.page.toString());
      if (params.limit) queryParams.set("limit", params.limit.toString());
      if (params.sort) queryParams.set("sort", params.sort);
      if (params.category) queryParams.set("category", params.category);
      if (params.brand) queryParams.set("brand", params.brand);
      if (params.search) queryParams.set("search", params.search);
      // Use !== undefined to allow 0 values to be sent
      if (params.minPrice !== undefined && params.minPrice !== null) {
        queryParams.set("minPrice", params.minPrice.toString());
      }
      if (params.maxPrice !== undefined && params.maxPrice !== null) {
        queryParams.set("maxPrice", params.maxPrice.toString());
      }
      if (params.includeChildren) queryParams.set("includeChildren", "true");
      if (params.inStock) queryParams.set("inStock", "true");
      if (params.onSale) queryParams.set("onSale", "true");
      if (params.minRating !== undefined) queryParams.set("minRating", params.minRating.toString());

      if (params.properties) {
        appendPropertyFilters(queryParams, params.properties);
      }

      // توجه: عمداً `nocache=true` فرستاده نمی‌شود.
      // کش سمت سرور با clearCacheByPrefix('/api/products') در هر ویرایش
      // محصول/کمپین و با ttlUntil(nearest, 300, now) برای انقضای پروموشن‌ها
      // دقیق مدیریت می‌شود؛ دور زدن آن فقط سرعت فیلترینگ را چند برابر کم می‌کرد.

      const response = await api.get(`/products?${queryParams.toString()}`);

      // Handle response structure
      const data = response.data;
      const products = Array.isArray(data.data) ? data.data.map(mapBackendToFrontend) : [];

      // Extract pagination from backend response
      const pagination = data.pagination || {};
      const total = pagination.totalItems ?? data.total ?? products.length;
      const totalPages = pagination.totalPages ?? (Math.ceil(total / (params.limit || 24)) || 1);
      const currentPage = pagination.currentPage ?? params.page ?? 1;

      return {
        products,
        total,
        totalPages,
        currentPage,
        priceRange: data.priceRange,
        facets: data.facets,
      };
    } catch (error) {
      console.error("Error fetching products with filters:", error);
      throw error;
    }
  },

  /**
   * Fetch related products by category (excludes current product)
   * @param categoryId - Category ID to fetch products from
   * @param currentProductId - Current product ID to exclude from results
   * @param limit - Number of products to return (default: 10)
   */
  getRelated: async (categoryId: string, currentProductId: string, limit: number = 10): Promise<Product[]> => {
    try {
      // Fetch extra products to ensure we have enough after filtering
      const fetchLimit = limit + 5;
      const response = await api.get(`/products?category=${categoryId}&limit=${fetchLimit}&_t=${Date.now()}`);
      const items = productService._extractList(response);

      // Filter out the current product and limit results
      const relatedProducts = items
        .filter(item => item._id !== currentProductId)
        .slice(0, limit)
        .map(mapBackendToFrontend);

      return relatedProducts;
    } catch (error) {
      console.error(`Error fetching related products for category ${categoryId}:`, error);
      // Return empty array instead of throwing to prevent page crash
      return [];
    }
  },

  /**
   * Fetch category details by slug (with properties for filters)
   * @param slug - Category slug or ID
   */
  getCategoryBySlug: async (slug: string): Promise<CategoryDetails | null> => {
    try {
      const response = await api.get(`/categories/slug/${slug}?_t=${Date.now()}`);
      const data = response?.data;
      if (data?.success && data?.data) {
        return data.data as CategoryDetails;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching category ${slug}:`, error);
      return null;
    }
  },
};
