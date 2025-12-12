import api from "@/lib/api";

/**
 * Shipping Address Interface
 */
export interface ShippingAddress {
  fullName: string;
  phone: string;
  province?: string;
  city: string;
  address: string;
  postalCode: string;
  isDefault?: boolean;
  mobile?: string;
  nationalCode?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientNationalCode?: string;
}

/**
 * Order Item Interface
 */
export interface OrderItem {
  name: string;
  quantity: number;
  image: string;
  price: number;
  product: string; // Product ID
}

/**
 * Create Order Request
 */
export interface CreateOrderRequest {
  orderItems: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: "online" | "cod";
  itemsPrice: number;
  shippingPrice: number;
  shippingMethod?: string;
  taxPrice?: number;
  totalPrice: number;
  totalDiscount?: number;
}

/**
 * Order Response from Backend
 */
export interface Order {
  _id: string;
  user: string;
  orderCode?: string; // Human-readable order code (e.g., WV-123456)
  orderItems: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentResult?: {
    id: string;
    status: string;
    update_time: string;
    email_address: string;
  };
  itemsPrice: number;
  shippingPrice: number;
  shippingMethod?: string;
  taxPrice: number;
  totalPrice: number;
  totalDiscount?: number;
  isPaid: boolean;
  paidAt?: string;
  orderStatus: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingCode?: string; // Postal tracking code
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Order Service Response
 */
interface OrderResponse {
  success: boolean;
  message?: string;
  data?: Order;
}

/**
 * Order Service
 *
 * Handles order creation and management for authenticated users.
 *
 * Backend Endpoints:
 * - POST /api/orders - Create new order
 * - GET /api/orders/:id - Get order by ID (future)
 * - GET /api/orders - Get user's orders (future)
 *
 * Status: ✅ Connected to Real Backend API
 */
export const orderService = {
  /**
   * Create New Order
   * Creates a new order and clears the user's cart
   *
   * @param orderData - Order details including items, address, payment method
   * @returns Promise with created order
   */
  create: async (orderData: CreateOrderRequest): Promise<OrderResponse> => {
    try {
      console.log("[ORDER] Creating order:", orderData);

      const response = await api.post("/orders", orderData);

      return response.data;
    } catch (error: any) {
      console.error("Error creating order:", error);
      throw new Error(
        error.response?.data?.message || "خطا در ثبت سفارش"
      );
    }
  },

  /**
   * Get Order by ID
   * Retrieves a specific order by its ID
   *
   * @param orderId - Order ID
   * @returns Promise with order details
   */
  getById: async (orderId: string): Promise<OrderResponse> => {
    try {
      console.log(`[ORDER] Fetching order ${orderId}`);

      const response = await api.get(`/orders/${orderId}`);

      return response.data;
    } catch (error: any) {
      console.error("Error fetching order:", error);
      throw new Error(
        error.response?.data?.message || "خطا در دریافت اطلاعات سفارش"
      );
    }
  },

  /**
   * Get User's Orders
   * Retrieves all orders for the authenticated user
   *
   * @returns Promise with list of orders
   */
  getMyOrders: async (): Promise<{ success: boolean; data: Order[] }> => {
    try {
      console.log("[ORDER] Fetching user orders");

      const response = await api.get("/orders/my-orders");

      return response.data;
    } catch (error: any) {
      console.error("Error fetching user orders:", error);
      throw new Error(
        error.response?.data?.message || "خطا در دریافت لیست سفارشات"
      );
    }
  },
};
