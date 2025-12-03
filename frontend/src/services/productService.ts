import api from "@/lib/api";

// Color Interface
export interface ProductColor {
  id: number;
  hex: string;
  name: string;
}

// Specification Interface
export interface ProductSpec {
  label: string;
  value: string;
}

// Category Path Interface
export interface CategoryPathItem {
  id: string;
  name: string;
  slug: string;
}

// Frontend Product Interface (matching our UI expectations)
export interface Product {
  id: string;
  name: string;
  title: string; // Display name (same as name for now)
  slug?: string;
  enTitle?: string; // English title (optional)
  price: number;
  oldPrice?: number; // Original price before discount
  discount: number;
  image: string;
  images: string[]; // Gallery images
  category: string;
  categoryPath?: CategoryPathItem[]; // Structured category hierarchy
  brand?: string;
  description?: string;
  rating: number;
  reviewCount: number;
  countInStock: number;
  colors?: ProductColor[]; // Optional color variants
  specs?: ProductSpec[]; // Technical specifications
  campaignLabel?: string; // Active campaign name (time-limited discount)
  campaignTheme?: string; // Badge color theme
  compareAtPrice?: number; // Original price for comparison

  // Time-based promotion fields
  isFlashDeal?: boolean;
  flashDealEndTime?: string; // ISO date string
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string; // ISO date string
}

// ... (BackendProduct interface remains same)



// Backend MongoDB Product Interface (typical structure)
interface BackendProduct {
  _id: string;
  name: string;
  enTitle?: string;
  price: number;
  image?: string;
  images?: string[];
  category?: string;
  // CRITICAL: Backend uses 'stock' field, not 'countInStock'
  stock?: number;
  countInStock?: number; // Keep for backward compatibility
  rating?: number;
  numReviews?: number;
  description?: string;
  brand?: string;
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
}

/**
 * Data Mapper: Transform MongoDB document to Frontend Product interface
 * This prevents backend schema changes from breaking the UI
 */
const mapBackendToFrontend = (backendProduct: BackendProduct): Product => {
  // Calculate old price if discount exists
  // Enforce rule: Discount is valid ONLY if isFlashDeal, isSpecialOffer, OR a Campaign is active
  // The user requested that discounts should not be applied unless one of these options is selected.
  const hasActivePromotion = backendProduct.isFlashDeal || backendProduct.isSpecialOffer || backendProduct.campaignLabel;
  const discount = hasActivePromotion ? (backendProduct.discount || 0) : 0;

  const oldPrice = discount > 0
    ? Math.round(backendProduct.price / (1 - discount / 100))
    : undefined;

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
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
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

  // Debug logging (can be removed after verification)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[STOCK DEBUG] Product: ${backendProduct.name}, Backend stock: ${backendProduct.stock}, countInStock: ${backendProduct.countInStock}, Mapped: ${countInStock}`);
  }

  return {
    // MongoDB uses _id, our UI expects id
    id: backendProduct._id,

    // Name/Title mappings
    name: backendProduct.name,
    title: backendProduct.name, // Use name as title
    slug: (backendProduct as any).slug, // Ensure slug is mapped if available
    enTitle: backendProduct.enTitle,

    // Price calculations
    price: backendProduct.price,
    oldPrice: backendProduct.compareAtPrice || oldPrice,
    compareAtPrice: backendProduct.compareAtPrice,
    discount: discount,

    // Images
    image: imageArray[0], // First image as main image
    images: imageArray, // All images for gallery

    // Category and Brand (Handle both string ID and populated object)
    category: (() => {
      let display = "عمومی";
      if (typeof backendProduct.category === 'object' && backendProduct.category !== null) {
        const cat = backendProduct.category as any;
        if (cat.parent && cat.parent.name) {
          display = `${cat.parent.name} > ${cat.name}`;
        } else {
          display = cat.name;
        }
      } else if (backendProduct.category) {
        display = backendProduct.category;
      }
      return display;
    })(),

    categoryPath: (() => {
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
      : backendProduct.brand,

    // Description
    description: backendProduct.description,

    // Ratings and Reviews
    rating: backendProduct.rating || 0,
    reviewCount: backendProduct.numReviews || 0,

    // Stock - THE CRITICAL FIX
    countInStock: countInStock,

    // Colors (optional)
    colors: backendProduct.colors,

    // Specifications (optional)
    specs: backendProduct.specs,

    // Campaign label (time-limited discount)
    campaignLabel: backendProduct.campaignLabel,
    campaignTheme: backendProduct.campaignTheme,

    // Time-based promotions
    isFlashDeal: backendProduct.isFlashDeal,
    flashDealEndTime: backendProduct.flashDealEndTime,
    isSpecialOffer: backendProduct.isSpecialOffer,
    specialOfferEndTime: backendProduct.specialOfferEndTime,
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

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[DATA EXTRACT] Response structure:', {
        hasData: !!payload,
        isArray: Array.isArray(payload),
        hasNestedData: !!(payload && payload.data),
        firstItemSample: Array.isArray(payload) && payload[0] ? {
          name: payload[0].name,
          countInStock: payload[0].countInStock
        } : 'N/A'
      });
    }

    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.data)) {
      return payload.data;
    }
    console.warn("Unexpected products list payload shape:", payload);
    return [];
  },

  /**
   * Helper to safely extract a single backend product
   * Backend typically responds with: { success, data: {...} }
   */
  _extractItem: (response: any): BackendProduct => {
    const payload = response?.data;

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[DATA EXTRACT] Single item response:', {
        hasData: !!payload,
        hasNestedData: !!(payload && payload.data),
        countInStock: payload?.countInStock || payload?.data?.countInStock
      });
    }

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
      const response = await api.get(`/products?sort=-createdAt&limit=${limit}&_t=${Date.now()}`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching newest products:", error);
      throw error;
    }
  },

  /**
   * Fetch best-selling products
   * @param limit - Number of products to return (default: 10)
   */
  getBestSellers: async (limit: number = 10): Promise<Product[]> => {
    try {
      // Assuming backend supports sorting by sales or numReviews
      const response = await api.get(`/products?sort=-numReviews&limit=${limit}&_t=${Date.now()}`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching best sellers:", error);
      throw error;
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
      const now = new Date().toISOString();
      const response = await api.get(`/products?isFlashDeal=true&flashDealEndTime[gt]=${now}&limit=${limit}&_t=${Date.now()}`);
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
      // Query products with isSpecialOffer=true and specialOfferEndTime greater than now
      const now = new Date().toISOString();
      const response = await api.get(`/products?isSpecialOffer=true&specialOfferEndTime[gt]=${now}&limit=${limit}&_t=${Date.now()}`);
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
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    properties?: Record<string, string>;
    includeChildren?: boolean;
  }): Promise<{ products: Product[]; total: number; priceRange?: { min: number; max: number } }> => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set("page", params.page.toString());
      if (params.limit) queryParams.set("limit", params.limit.toString());
      if (params.sort) queryParams.set("sort", params.sort);
      if (params.category) queryParams.set("category", params.category);
      if (params.search) queryParams.set("search", params.search);
      if (params.minPrice) queryParams.set("minPrice", params.minPrice.toString());
      if (params.maxPrice) queryParams.set("maxPrice", params.maxPrice.toString());
      if (params.includeChildren) queryParams.set("includeChildren", "true");

      if (params.properties) {
        Object.entries(params.properties).forEach(([key, value]) => {
          queryParams.set(`properties[${key}]`, value);
        });
      }

      // Add cache busting timestamp
      queryParams.set('_t', Date.now().toString());

      const response = await api.get(`/products?${queryParams.toString()}`);

      // Handle response structure
      const data = response.data;
      const products = Array.isArray(data.data) ? data.data.map(mapBackendToFrontend) : [];

      return {
        products,
        total: data.total || products.length,
        priceRange: data.priceRange
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
};
