import api from "@/lib/api";

/**
 * Cart Item Interface - Frontend representation
 */
export interface CartItem {
  product: string; // Product ID
  name: string;
  price: number;
  quantity: number;
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
 * Backend Endpoints:
 * - GET /api/cart - Get user's cart
 * - POST /api/cart/sync - Sync local cart with server
 * - POST /api/cart/item - Add or update cart item
 * - DELETE /api/cart/item/:productId - Remove item from cart
 * - DELETE /api/cart - Clear entire cart
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

      const response = await api.get("/cart");

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

      const response = await api.post("/cart/sync", { items });

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

      const response = await api.post("/cart/item", {
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
   * @returns Promise with updated cart items and total price
   */
  updateItem: async (
    product: string,
    quantity: number
  ): Promise<CartResponse> => {
    try {
      console.log(`[CART] Updating item ${product} to qty: ${quantity}`);

      const response = await api.post("/cart/item", {
        product,
        quantity,
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
   * @returns Promise with updated cart items and total price
   */
  removeItem: async (productId: string): Promise<CartResponse> => {
    try {
      console.log(`[CART] Removing item ${productId}`);

      const response = await api.delete(`/cart/item/${productId}`);

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

      const response = await api.delete("/cart");

      return response.data;
    } catch (error: any) {
      console.error("Error clearing cart:", error);
      throw new Error(
        error.response?.data?.message || "خطا در پاک کردن سبد خرید"
      );
    }
  },
};
