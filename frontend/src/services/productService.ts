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

// Frontend Product Interface (matching our UI expectations)
export interface Product {
  id: string;
  name: string;
  title: string; // Display name (same as name for now)
  enTitle?: string; // English title (optional)
  price: number;
  oldPrice?: number; // Original price before discount
  discount: number;
  image: string;
  images: string[]; // Gallery images
  category: string;
  brand?: string;
  description?: string;
  rating: number;
  reviewCount: number;
  countInStock: number;
  colors?: ProductColor[]; // Optional color variants
  specs?: ProductSpec[]; // Technical specifications

  // Time-based promotion fields
  isFlashDeal?: boolean;
  flashDealEndTime?: string; // ISO date string
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string; // ISO date string
}

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
  const discount = backendProduct.discount || 0;
  const oldPrice = discount > 0
    ? Math.round(backendProduct.price / (1 - discount / 100))
    : undefined;

  // Handle images - support string URLs and objects with `url`
  const normalizeImage = (img: any): string | null => {
    if (typeof img === "string" && img.trim() !== "") return img.trim();
    if (img && typeof img === "object" && typeof img.url === "string" && img.url.trim() !== "") {
      return img.url.trim();
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
    imageArray = ["/placeholder-product.png"];
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
    enTitle: backendProduct.enTitle,

    // Price calculations
    price: backendProduct.price,
    oldPrice: oldPrice,
    discount: discount,

    // Images
    image: imageArray[0], // First image as main image
    images: imageArray, // All images for gallery

    // Category and Brand
    category: backendProduct.category || "عمومی",
    brand: backendProduct.brand,

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
      const response = await api.get("/products");
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
      const response = await api.get(`/products?sort=-createdAt&limit=${limit}`);
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
      const response = await api.get(`/products?sort=-numReviews&limit=${limit}`);
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
      const response = await api.get(`/products?hasDiscount=true&limit=${limit}`);
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
      const response = await api.get(`/products/${id}`);
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
      const response = await api.get(`/products?category=${category}${limitParam}`);
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
      const response = await api.get(`/products?isFlashDeal=true&flashDealEndTime[gt]=${now}&limit=${limit}`);
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
      const response = await api.get(`/products?isSpecialOffer=true&specialOfferEndTime[gt]=${now}&limit=${limit}`);
      const items = productService._extractList(response);
      return items.map(mapBackendToFrontend);
    } catch (error) {
      console.error("Error fetching special offers:", error);
      throw error;
    }
  },
};
