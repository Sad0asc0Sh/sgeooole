import api from "@/lib/api";

/**
 * Address Interface
 */
export interface Address {
  _id: string;
  user: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  address: string;
  plaque: string;
  unit?: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Address Request
 */
export interface CreateAddressRequest {
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  address: string;
  plaque: string;
  unit?: string;
  postalCode: string;
  isDefault?: boolean;
}

/**
 * Update Address Request
 */
export interface UpdateAddressRequest extends Partial<CreateAddressRequest> { }

/**
 * Address Service Response
 */
interface AddressResponse {
  success: boolean;
  message?: string;
  data?: Address;
}

interface AddressListResponse {
  success: boolean;
  message?: string;
  data?: Address[];
}

/**
 * Address Service
 *
 * Handles user shipping addresses for checkout
 *
 * Backend Endpoints:
 * - GET /api/addresses - Get all user addresses
 * - POST /api/addresses - Create new address
 * - PUT /api/addresses/:id - Update address
 * - DELETE /api/addresses/:id - Delete address
 * - PUT /api/addresses/:id/set-default - Set as default
 *
 * Status: ✅ Connected to Real Backend API
 */
export const addressService = {
  /**
   * Get All User Addresses
   * Retrieves all addresses for the authenticated user
   *
   * @returns Promise with list of addresses
   */
  getAll: async (): Promise<AddressListResponse> => {
    try {
      console.log("[ADDRESS] Fetching user addresses");

      const response = await api.get("/addresses");

      return response.data;
    } catch (error: any) {
      console.error("Error fetching addresses:", error);
      throw new Error(
        error.response?.data?.message || "خطا در دریافت لیست آدرس‌ها"
      );
    }
  },

  /**
   * Create New Address
   * Creates a new shipping address for the user
   *
   * @param addressData - Address details
   * @returns Promise with created address
   */
  create: async (
    addressData: CreateAddressRequest
  ): Promise<AddressResponse> => {
    try {
      console.log("[ADDRESS] Creating address:", addressData);

      const response = await api.post("/addresses", addressData);

      return response.data;
    } catch (error: any) {
      console.error("Error creating address:", error);
      throw new Error(
        error.response?.data?.message || "خطا در ایجاد آدرس"
      );
    }
  },

  /**
   * Update Address
   * Updates an existing address
   *
   * @param addressId - Address ID
   * @param addressData - Updated address details
   * @returns Promise with updated address
   */
  update: async (
    addressId: string,
    addressData: UpdateAddressRequest
  ): Promise<AddressResponse> => {
    try {
      console.log(`[ADDRESS] Updating address ${addressId}`, addressData);

      const response = await api.put(`/addresses/${addressId}`, addressData);

      return response.data;
    } catch (error: any) {
      console.error("Error updating address:", error);
      throw new Error(
        error.response?.data?.message || "خطا در ویرایش آدرس"
      );
    }
  },

  /**
   * Delete Address
   * Deletes an address
   *
   * @param addressId - Address ID to delete
   * @returns Promise with success status
   */
  delete: async (addressId: string): Promise<{ success: boolean }> => {
    try {
      console.log(`[ADDRESS] Deleting address ${addressId}`);

      const response = await api.delete(`/addresses/${addressId}`);

      return response.data;
    } catch (error: any) {
      console.error("Error deleting address:", error);
      throw new Error(
        error.response?.data?.message || "خطا در حذف آدرس"
      );
    }
  },

  /**
   * Set Default Address
   * Sets an address as the default shipping address
   *
   * @param addressId - Address ID to set as default
   * @returns Promise with updated address
   */
  setDefault: async (addressId: string): Promise<AddressResponse> => {
    try {
      console.log(`[ADDRESS] Setting address ${addressId} as default`);

      const response = await api.put(`/addresses/${addressId}/set-default`);

      return response.data;
    } catch (error: any) {
      console.error("Error setting default address:", error);
      throw new Error(
        error.response?.data?.message || "خطا در تنظیم آدرس پیش‌فرض"
      );
    }
  },
};
