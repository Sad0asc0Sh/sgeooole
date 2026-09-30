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
} from "@/types/product";

// Import types for internal use
import type {
  Product,
  ProductColor,
  ProductSpec,
  CategoryPathItem,
  CategoryDetails,
} from "@/types/product";



type BackendImage = string | { url?: string };

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

  let imageArray: string[] = [];
  if (backendProduct.images && backendProduct.images.length > 0) {
    imageArray = backendProduct.images
      .map(normalizeImage)
      .filter((x): x is string => Boolean(x));
  }
  if (imageArray.length === 0 && backendProduct.image) {
    const normalized = normalizeImage(backendProduct.image);
    if (normalized) {
      imageArray = [normalized];
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
    images: imageArray, // All images for gallery

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

    // Specifications (optional) - Use properties if specs not available
    specs: backendProduct.specs || backendProduct.properties?.map(p => ({ label: p.label, value: p.value })),

    // Campaign label (time-limited discount)
    campaignLabel: backendProduct.campaignLabel,
    campaignTheme: backendProduct.campaignTheme,

    // Time-based promotions (keep raw flags/timers; UI derives active state)
    isFlashDeal: Boolean(backendProduct.isFlashDeal),
    flashDealEndTime: backendProduct.flashDealEndTime || undefined,
    isSpecialOffer: Boolean(backendProduct.isSpecialOffer),
    specialOfferEndTime: backendProduct.specialOfferEndTime || undefined,
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
      const fields = 'name,slug,productCode,price,discount,images,stock,compareAtPrice,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,campaignLabel,campaignTheme';
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

          return {
            id: item._id,
            name: item.name || "",
            title: item.name || "",
            slug: item.slug || "",
            price: pricing.finalPrice,
            oldPrice: pricing.oldPrice,
            compareAtPrice: pricing.basePrice,
            discount: pricing.discount,
            image: imageUrl,
            images: [imageUrl],
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
      // OPTIMIZED: Only fetch fields needed for rail display
      const now = new Date().toISOString();
      const fields = 'name,slug,productCode,price,discount,images,stock,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,compareAtPrice';
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
      // OPTIMIZED: Only fetch fields needed for rail display
      const fields = 'name,slug,productCode,price,discount,images,stock,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,compareAtPrice,campaignLabel,campaignTheme';
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

      // Listing cards must reflect promotion edits promptly. The backend treats
      // this flag as an explicit no-store request, so no unique timestamp cache
      // entries are created for each refresh.
      queryParams.set("nocache", "true");

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
