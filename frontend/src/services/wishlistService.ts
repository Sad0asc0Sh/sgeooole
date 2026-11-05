import api from "@/lib/api";

/**
 * Wishlist Item Interface - Frontend representation
 */
export interface WishlistVariant {
  _id: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  options?: Array<{ name: string; value: string }>;
  images?: Array<string | { url?: string; cardUrl?: string; sizes?: { card?: string; small?: string; thumbnail?: string } }>;
  excludeFromPromotion?: boolean;
}

export interface WishlistItem {
  _id: string;
  slug?: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  discount?: number;
  campaignLabel?: string;
  campaignTheme?: string;
  isFlashDeal?: boolean;
  flashDealEndTime?: string;
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;
  images?: Array<{
    url: string;
    cardUrl?: string;
    sizes?: { card?: string; small?: string; thumbnail?: string };
    public_id?: string;
  }>;
  stock?: number;
  countInStock?: number;
  category?: string;
  brand?: string;
  rating?: number;
  isActive?: boolean;
  // Variable-product fields (present when the backend sends variants)
  productType?: "simple" | "variable";
  variants?: WishlistVariant[];
}

/**
 * Wishlist Response from Backend
 */
interface WishlistResponse {
  success: boolean;
  message?: string;
  data?: WishlistItem[];
  wishlist?: WishlistItem[];
}

/**
 * Toggle Response from Backend
 */
interface ToggleResponse {
  success: boolean;
  message?: string;
  isInWishlist?: boolean;
}

/**
 * Wishlist Service
 *
 * Server-side wishlist persistence for authenticated users.
 *
 * Backend Endpoints (mounted at /api/wishlist):
 * - GET /api/wishlist - Get user's wishlist
 * - POST /api/wishlist - Add item to wishlist
 * - DELETE /api/wishlist/:productId - Remove item from wishlist
 * - POST /api/wishlist/toggle/:productId - Toggle item in wishlist
 *
 * Status: ✅ Ready for Backend Integration
 */
export const wishlistService = {
  /**
   * Get User's Wishlist
   * Fetches the authenticated user's wishlist from the server
   *
   * @returns Promise with array of wishlist items
   */
  getWishlist: async (): Promise<WishlistItem[]> => {
    try {
      console.log("[WISHLIST] Fetching user wishlist");

      const response = await api.get("/wishlist");

      // Handle different response structures from backend
      const items = response.data.data || response.data.wishlist || response.data;

      return Array.isArray(items) ? items : [];
    } catch (error: any) {
      console.error("Error fetching wishlist:", error);

      // If 404 or empty wishlist, return empty array instead of throwing
      if (error.response?.status === 404) {
        return [];
      }

      throw new Error(
        error.response?.data?.message || "خطا در دریافت لیست علاقه‌مندی‌ها"
      );
    }
  },

  /**
   * Add Item to Wishlist
   * Adds a product to the user's wishlist
   *
   * @param productId - Product ID to add
   * @returns Promise with success status
   */
  addToWishlist: async (productId: string): Promise<WishlistResponse> => {
    try {
      console.log(`[WISHLIST] Adding item ${productId} to wishlist`);

      const response = await api.post("/wishlist", { productId });

      return response.data;
    } catch (error: any) {
      console.error("Error adding to wishlist:", error);
      throw new Error(
        error.response?.data?.message || "خطا در افزودن به لیست علاقه‌مندی‌ها"
      );
    }
  },

  /**
   * Remove Item from Wishlist
   * Removes a product from the user's wishlist
   *
   * @param productId - Product ID to remove
   * @returns Promise with success status
   */
  removeFromWishlist: async (productId: string): Promise<WishlistResponse> => {
    try {
      console.log(`[WISHLIST] Removing item ${productId} from wishlist`);

      const response = await api.delete(`/wishlist/${productId}`);

      return response.data;
    } catch (error: any) {
      console.error("Error removing from wishlist:", error);
      throw new Error(
        error.response?.data?.message || "خطا در حذف از لیست علاقه‌مندی‌ها"
      );
    }
  },

  /**
   * Toggle Item in Wishlist
   * Smart toggle: adds item if not in wishlist, removes if already in wishlist
   *
   * @param productId - Product ID to toggle
   * @returns Promise with success status and isInWishlist boolean
   */
  toggleWishlist: async (productId: string): Promise<ToggleResponse> => {
    try {
      console.log(`[WISHLIST] Toggling item ${productId} in wishlist`);

      const response = await api.post(`/wishlist/toggle/${productId}`);

      return response.data;
    } catch (error: any) {
      console.error("Error toggling wishlist:", error);
      throw new Error(
        error.response?.data?.message || "خطا در به‌روزرسانی لیست علاقه‌مندی‌ها"
      );
    }
  },

  /**
   * Check if Item is in Wishlist
   * Checks if a product is in the user's wishlist
   *
   * @param productId - Product ID to check
   * @returns Promise with boolean indicating if item is in wishlist
   */
  isInWishlist: async (productId: string): Promise<boolean> => {
    try {
      const wishlist = await wishlistService.getWishlist();
      return wishlist.some((item) => item._id === productId);
    } catch (error) {
      console.error("Error checking wishlist status:", error);
      return false;
    }
  },

  /**
   * Clear Wishlist
   * Removes all items from the wishlist
   *
   * @returns Promise with success status
   */
  clearWishlist: async (): Promise<WishlistResponse> => {
    try {
      console.log("[WISHLIST] Clearing wishlist");

      const response = await api.delete("/wishlist");

      return response.data;
    } catch (error: any) {
      console.error("Error clearing wishlist:", error);
      throw new Error(
        error.response?.data?.message || "خطا در پاک کردن لیست علاقه‌مندی‌ها"
      );
    }
  },
};
