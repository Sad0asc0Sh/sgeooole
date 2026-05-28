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
  product: string;
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
  orderCode?: string;
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
  trackingCode?: string;
  courierName?: string;         // نام شرکت حمل‌ونقل
  preparedTrackingUrl?: string; // لینک آماده رهگیری
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderResponse {
  success: boolean;
  message?: string;
  data?: Order;
}

export interface UpdateOrderStatusRequest {
  status: string;
  trackingCode?: string;
  courierName?: string;
  preparedTrackingUrl?: string;
  adminNotes?: string;
  deliveryDays?: number;
}

export const orderService = {
  /**
   * Create New Order
   */
  create: async (orderData: CreateOrderRequest): Promise<OrderResponse> => {
    try {
      const response = await api.post("/orders", orderData);
      return response.data;
    } catch (error: any) {
      console.error("Error creating order:", error);
      throw new Error(error.response?.data?.message || "خطا در ثبت سفارش");
    }
  },

  /**
   * Get Order by ID
   */
  getById: async (orderId: string): Promise<OrderResponse> => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching order:", error);
      throw new Error(error.response?.data?.message || "خطا در دریافت اطلاعات سفارش");
    }
  },

  /**
   * Get User's Orders
   */
  getMyOrders: async (): Promise<{ success: boolean; data: Order[] }> => {
    try {
      const response = await api.get("/orders/my-orders");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching user orders:", error);
      throw new Error(error.response?.data?.message || "خطا در دریافت لیست سفارشات");
    }
  },

  /**
   * Update Order Status (Admin)
   * شامل تغییر وضعیت، کد رهگیری، نام پیک و لینک رهگیری آماده
   */
  updateStatus: async (
    orderId: string,
    payload: UpdateOrderStatusRequest
  ): Promise<{ success: boolean; data: Order }> => {
    try {
      const response = await api.put(`/orders/${orderId}/status`, payload);
      return response.data;
    } catch (error: any) {
      console.error("Error updating order status:", error);
      throw new Error(error.response?.data?.message || "خطا در به‌روزرسانی وضعیت سفارش");
    }
  },

  /**
   * Get All Orders (Admin)
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    orderStatus?: string;
    search?: string;
  }): Promise<{ success: boolean; data: Order[]; pagination: any }> => {
    try {
      const response = await api.get("/orders", { params });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "خطا در دریافت سفارشات");
    }
  },
};
