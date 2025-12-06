import api from "@/lib/api";

/**
 * Cart Item Interface - Frontend representation
 */
export interface CartItem {
  product: string; // Product ID
  name: string;
  price: number;
  quantity: number;
  originalPrice?: number;
  finalPrice?: number;
  compareAtPrice?: number;
  campaignLabel?: string;
  isFlashDeal?: boolean;
  flashDealEndTime?: string;
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;
  totalItemPrice?: number;
  variantOptions?: Array<{
    name: string;
    value: string;
  }>;
  // Populated fields from backend
  images?: Array<{
    url: string;
    public_id?: string;
  }>;
  countInStock?: number;
  discount?: number;
}

/**
 * Cart Response from Backend
 */
interface CartResponse {
  success: boolean;
  message?: string;
  data?: {
    items: CartItem[];
    totalPrice: number;
    couponCode?: string;
  };
}

/**
 * Sync Cart Request Body
 */
interface SyncCartRequest {
  items: Array<{
    product: string;
    quantity: number;
    variantOptions?: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

/**
 * Add/Update Item Request Body
 */
interface AddItemRequest {
  product: string;
  quantity: number;
  variantOptions?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Cart Service
 *
 * Server-side cart persistence for authenticated users.
 *
 * Backend Endpoints (mounted at /api/carts):
 * - GET /api/carts/cart - Get user's cart
 * - POST /api/carts/cart/sync - Sync local cart with server
 * - POST /api/carts/cart/item - Add or update cart item
 * - DELETE /api/carts/cart/item/:productId - Remove item from cart
 * - DELETE /api/carts/cart - Clear entire cart
 *
 * Status: ✅ Connected to Real Backend API
 */
export const cartService = {
  /**
   * Get User's Cart
   * Fetches the authenticated user's active cart from the server
   *
   * @returns Promise with cart items and total price
   */
  getCart: async (): Promise<CartResponse> => {
    try {
      console.log("[CART] Fetching user cart");

      const response = await api.get("/carts/cart");

      return response.data;
    } catch (error: any) {
      console.error("Error fetching cart:", error);
      throw new Error(
        error.response?.data?.message || "خطا در دریافت سبد خرید"
      );
    }
  },

  /**
   * Sync Local Cart with Server
   * Merges local cart items with server cart (keeps highest quantity)
   *
   * @param items - Array of local cart items to sync
   * @returns Promise with merged cart items and total price
   */
  syncCart: async (items: SyncCartRequest["items"]): Promise<CartResponse> => {
    try {
      console.log(`[CART] Syncing ${items.length} items with server`);

      const response = await api.post("/carts/cart/sync", { items });

      return response.data;
    } catch (error: any) {
      console.error("Error syncing cart:", error);
      throw new Error(
        error.response?.data?.message || "خطا در همگام‌سازی سبد خرید"
      );
    }
  },

  /**
   * Add or Update Item in Cart
   * Adds a new item to cart or updates quantity if item already exists
   *
   * @param product - Product ID
   * @param quantity - Item quantity
   * @param variantOptions - Optional variant options (e.g., color, size)
   * @returns Promise with updated cart items and total price
   */
  addItem: async (
    product: string,
    quantity: number,
    variantOptions?: AddItemRequest["variantOptions"]
  ): Promise<CartResponse> => {
    try {
      console.log(`[CART] Adding item ${product} (qty: ${quantity})`);

      const response = await api.post("/carts/cart/item", {
        product,
        quantity,
        variantOptions,
      });

      return response.data;
    } catch (error: any) {
      console.error("Error adding item to cart:", error);
      throw new Error(
        error.response?.data?.message || "خطا در افزودن محصول به سبد خرید"
      );
    }
  },

  /**
   * Update Item Quantity
   * Convenience method to update existing item's quantity
   *
   * @param product - Product ID
   * @param quantity - New quantity
   * @param variantOptions - Optional variant options
   * @returns Promise with updated cart items and total price
   */
  updateItem: async (
    product: string,
    quantity: number,
    variantOptions?: AddItemRequest["variantOptions"]
  ): Promise<CartResponse> => {
    try {
      console.log(`[CART] Updating item ${product} to qty: ${quantity}`);

      const response = await api.post("/carts/cart/item", {
        product,
        quantity,
        variantOptions,
      });

      return response.data;
    } catch (error: any) {
      console.error("Error updating item:", error);
      throw new Error(
        error.response?.data?.message || "خطا در به‌روزرسانی محصول"
      );
    }
  },

  /**
   * Remove Item from Cart
   * Removes a specific item from the cart
   *
   * @param productId - Product ID to remove
   * @param variantOptions - Optional variant options to identify exact item
   * @returns Promise with updated cart items and total price
   */
  removeItem: async (
    productId: string,
    variantOptions?: AddItemRequest["variantOptions"]
  ): Promise<CartResponse> => {
    try {
      console.log(`[CART] Removing item ${productId}`);

      // Include variantOptions in query params if provided
      const params = variantOptions
        ? { variantOptions: JSON.stringify(variantOptions) }
        : {};

      const response = await api.delete(`/carts/cart/item/${productId}`, {
        params,
      });

      return response.data;
    } catch (error: any) {
      console.error("Error removing item:", error);
      throw new Error(
        error.response?.data?.message || "خطا در حذف محصول از سبد خرید"
      );
    }
  },

  /**
   * Clear Cart
   * Removes all items from the cart
   *
   * @returns Promise with success status
   */
  clearCart: async (): Promise<CartResponse> => {
    try {
      console.log("[CART] Clearing cart");

      const response = await api.delete("/carts/cart");

      return response.data;
    } catch (error: any) {
      console.error("Error clearing cart:", error);
      throw new Error(
        error.response?.data?.message || "خطا در پاک کردن سبد خرید"
      );
    }
  },
};
