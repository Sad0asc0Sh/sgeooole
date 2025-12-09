import api from "@/lib/api";

/**
 * User Interface - Frontend representation
 */
export interface User {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  wallet?: number;
  role?: string;
  isActive: boolean;
  addresses?: any[];
  avatar?: string;
  googleId?: string;
  // Personal Info
  nationalCode?: string;
  birthDate?: string | Date;
  landline?: string;
  shebaNumber?: string;
  province?: string;
  city?: string;
  // Legal Info
  isLegal?: boolean;
  companyName?: string;
  companyNationalId?: string;
  companyRegistrationId?: string;
  companyLandline?: string;
  companyProvince?: string;
  companyCity?: string;
  orderStats?: {
    processing: number;
    delivered: number;
    returned: number;
    cancelled: number;
  };
}

// ... (rest of the file)



/**
 * Auth Response from Backend
 */
interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: any;
    token: string;
    isProfileComplete?: boolean;
  };
  token?: string;
  accessToken?: string;
  isProfileComplete?: boolean;
}

/**
 * OTP Response from Backend
 */
interface OtpResponse {
  success: boolean;
  message: string;
  expiresIn?: number;
}

/**
 * Authentication Service
 *
 * OTP-based authentication for customer users.
 *
 * Backend Endpoints:
 * - POST /api/auth/send-otp - Send OTP to mobile number
 * - POST /api/auth/verify-otp - Verify OTP and return JWT token
 * - GET /api/auth/profile - Get current user profile (requires token)
 *
 * Status: ✅ Connected to Real Backend API
 */
export const authService = {
  /**
   * Step 1: Request OTP Code
   * Sends OTP to the provided mobile number
   *
   * @param mobile - Mobile number (e.g., "09123456789")
   * @returns Promise with success status and message
   */
  sendOtp: async (mobile: string): Promise<OtpResponse> => {
    try {
      console.log(`[AUTH] Sending OTP to ${mobile}`);

      const response = await api.post("/auth/send-otp", { mobile });

      return response.data;
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      throw new Error(error.response?.data?.message || "خطا در ارسال کد تایید");
    }
  },

  /**
   * Step 2: Verify OTP and Login
   * Verifies the OTP code and returns JWT token
   *
   * @param mobile - Mobile number
   * @param code - OTP code (4 digits)
   * @returns Promise with user data and token
   */
  verifyOtp: async (mobile: string, code: string): Promise<AuthResponse> => {
    try {
      console.log(`[AUTH] Verifying OTP for ${mobile}: ${code}`);

      const response = await api.post("/auth/verify-otp", { mobile, code });

      if (response.data.success && response.data.data?.token) {
        const token = response.data.data.token;
        const user = response.data.data.user;

        // Persist authentication
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        // Set authorization header
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }

      return response.data;
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      throw new Error(error.response?.data?.message || "کد تایید نامعتبر است");
    }
  },

  /**
   * Get Current User Profile
   * Fetches authenticated user's profile data
   *
   * @returns Promise with user data
   */
  getProfile: async (): Promise<User> => {
    try {
      const token = authService.getToken();

      if (!token) {
        throw new Error("لطفا ابتدا وارد حساب کاربری خود شوید");
      }

      console.log("[AUTH] Fetching user profile");

      const response = await api.get("/auth/profile");
      const userData = response.data.data || response.data;
      const rawStats = userData.orderStats || {};
      const mappedOrderStats = {
        processing: Number(rawStats.processing) || 0,
        delivered: Number(rawStats.delivered) || 0,
        returned: Number(rawStats.returned) || 0,
        cancelled: Number(
          rawStats.cancelled !== undefined
            ? rawStats.cancelled
            : rawStats.canceled
        ) || 0,
      };

      // Map backend user to frontend User interface
      return {
        id: userData._id || userData.id,
        name: userData.name,
        mobile: userData.mobile,
        email: userData.email,
        wallet: userData.wallet ?? userData.walletBalance ?? 0,
        role: userData.role || "user",
        isActive: userData.isActive !== false,
        addresses: userData.addresses || [],
        avatar: userData.avatar,
        // Personal Info
        nationalCode: userData.nationalCode,
        birthDate: userData.birthDate,
        landline: userData.landline,
        shebaNumber: userData.shebaNumber,
        province: userData.province,
        city: userData.city,
        // Legal Info
        isLegal: userData.isLegal,
        companyName: userData.companyName,
        companyNationalId: userData.companyNationalId,
        companyRegistrationId: userData.companyRegistrationId,
        companyLandline: userData.companyLandline,
        companyProvince: userData.companyProvince,
        companyCity: userData.companyCity,
        orderStats: mappedOrderStats,
        googleId: userData.googleId,
      };
    } catch (error: any) {
      console.error("Error fetching profile:", error);

      // If unauthorized, clear auth data
      if (error.response?.status === 401) {
        authService.logout();
      }

      throw new Error(error.response?.data?.message || "خطا در دریافت اطلاعات کاربر");
    }
  },

  /**
   * Check if user is authenticated
   * @returns boolean
   */
  isAuthenticated: (): boolean => {
    const token = authService.getToken();
    return !!token;
  },

  /**
   * Get stored authentication token
   * @returns token string or null
   */
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  },

  /**
   * Get stored user data
   * @returns User object or null
   */
  getUser: (): User | null => {
    if (typeof window === "undefined") return null;
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;

    try {
      const userData = JSON.parse(userStr);
      const rawStats = userData.orderStats || {};
      const mappedOrderStats = {
        processing: Number(rawStats.processing) || 0,
        delivered: Number(rawStats.delivered) || 0,
        returned: Number(rawStats.returned) || 0,
        cancelled: Number(
          rawStats.cancelled !== undefined
            ? rawStats.cancelled
            : rawStats.canceled
        ) || 0,
      };
      return {
        id: userData._id || userData.id,
        name: userData.name,
        mobile: userData.mobile,
        email: userData.email,
        wallet: userData.wallet ?? userData.walletBalance ?? 0,
        role: userData.role || "user",
        isActive: userData.isActive !== false,
        addresses: userData.addresses || [],
        avatar: userData.avatar,
        // Personal Info
        nationalCode: userData.nationalCode,
        birthDate: userData.birthDate,
        landline: userData.landline,
        shebaNumber: userData.shebaNumber,
        province: userData.province,
        city: userData.city,
        // Legal Info
        isLegal: userData.isLegal,
        companyName: userData.companyName,
        companyNationalId: userData.companyNationalId,
        companyRegistrationId: userData.companyRegistrationId,
        companyLandline: userData.companyLandline,
        companyProvince: userData.companyProvince,
        companyCity: userData.companyCity,
        orderStats: mappedOrderStats,
      };
    } catch {
      return null;
    }
  },

  /**
   * Logout
   * Clears authentication data and redirects to home
   */
  logout: (): void => {
    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Clear axios default header
    delete api.defaults.headers.common["Authorization"];

    // Redirect to home
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  },

  /**
   * Google Login
   * Authenticates user with Google ID token
   *
   * @param token - Google ID token (credential)
   * @returns Promise with user data and token
   */
  loginWithGoogle: async (token: string): Promise<AuthResponse> => {
    try {
      console.log("[AUTH] Logging in with Google");

      const response = await api.post("/auth/google", { token });

      if (response.data.success && response.data.data?.token) {
        const appToken = response.data.data.token;
        const user = response.data.data.user;

        // Persist authentication
        localStorage.setItem("token", appToken);
        localStorage.setItem("user", JSON.stringify(user));

        // Set authorization header
        api.defaults.headers.common["Authorization"] = `Bearer ${appToken}`;

        console.log("[AUTH] Google login successful");
      }

      return response.data;
    } catch (error: any) {
      console.error("Error logging in with Google:", error);
      throw new Error(
        error.response?.data?.message || "خطا در ورود با گوگل"
      );
    }
  },

  /**
   * Login with Password
   * Authenticates user with username/mobile/email + password
   *
   * @param identifier - Username, mobile number, or email
   * @param password - User password
   * @returns Promise with user data and token
   */
  loginWithPassword: async (
    identifier: string,
    password: string
  ): Promise<AuthResponse> => {
    try {
      console.log("[AUTH] Logging in with password");

      const response = await api.post("/auth/login-password", {
        identifier,
        password,
      });

      if (response.data.success && response.data.data?.token) {
        const token = response.data.data.token;
        const user = response.data.data.user;

        // Persist authentication
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        // Set authorization header
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        console.log("[AUTH] Password login successful");
      }

      return response.data;
    } catch (error: any) {
      console.error("Error logging in with password:", error);
      throw new Error(
        error.response?.data?.message || "خطا در ورود با رمز عبور"
      );
    }
  },

  /**
   * Complete Profile
   * Sets password, username, and name for user after OTP/Google login
   *
   * @param data - Profile completion data
   * @returns Promise with success status
   */
  completeProfile: async (data: {
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log("[AUTH] Completing user profile");

      const response = await api.put("/auth/complete-profile", data);

      // Update user in localStorage
      if (response.data.success && response.data.data?.user) {
        const user = response.data.data.user;
        localStorage.setItem("user", JSON.stringify(user));
      }

      return response.data;
    } catch (error: any) {
      console.error("Error completing profile:", error);
      throw new Error(
        error.response?.data?.message || "خطا در تکمیل پروفایل"
      );
    }
  },

  /**
   * Update Profile (including password and extended info)
   * @param data - Profile data
   */
  updateProfile: async (data: Partial<User> & { password?: string }): Promise<any> => {
    try {
      console.log("[AUTH] Updating profile");
      const response = await api.put("/auth/me/update", data);
      return response.data;
    } catch (error: any) {
      console.error("Error updating profile:", error);
      throw new Error(error.response?.data?.message || "خطا در بروزرسانی پروفایل");
    }
  },

  /**
   * Update Avatar
   * Uploads a new profile picture
   * @param file - Image file
   */
  updateAvatar: async (file: File): Promise<{ success: boolean; data: User; message?: string }> => {
    try {
      console.log("[AUTH] Updating avatar");
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await api.put("/auth/me/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error: any) {
      console.error("Error updating avatar:", error);
      throw new Error(error.response?.data?.message || "خطا در آپلود تصویر پروفایل");
    }
  },

  /**
   * Forgot Password
   * Sends password reset email to user
   *
   * @param email - User email address
   * @returns Promise with success status
   */
  forgotPassword: async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log("[AUTH] Requesting password reset for:", email);

      const response = await api.post("/auth/forgot-password", { email });

      return response.data;
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      throw new Error(
        error.response?.data?.message || "خطا در ارسال ایمیل بازیابی"
      );
    }
  },

  /**
   * Reset Password
   * Resets user password using token from email
   *
   * @param token - Reset token from email link
   * @param password - New password
   * @returns Promise with success status
   */
  resetPassword: async (token: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log("[AUTH] Resetting password with token");

      const response = await api.put(`/auth/reset-password/${token}`, { password });

      return response.data;
    } catch (error: any) {
      console.error("Error resetting password:", error);
      throw new Error(
        error.response?.data?.message || "خطا در تغییر رمز عبور"
      );
    }
  },

  /**
   * Add Address
   * @param address - Address object
   */
  addAddress: async (address: any): Promise<{ success: boolean; data: any[] }> => {
    try {
      console.log("[AUTH] Adding address");
      const response = await api.post("/auth/addresses", address);
      return response.data;
    } catch (error: any) {
      console.error("Error adding address:", error);
      throw new Error(error.response?.data?.message || "خطا در ثبت آدرس");
    }
  },

  /**
   * Update Address
   * @param addressId - Address ID
   * @param address - Updated address object
   */
  updateAddress: async (addressId: string, address: any): Promise<{ success: boolean; data: any[] }> => {
    try {
      console.log("[AUTH] Updating address:", addressId);
      const response = await api.put(`/auth/addresses/${addressId}`, address);
      return response.data;
    } catch (error: any) {
      console.error("Error updating address:", error);
      throw new Error(error.response?.data?.message || "خطا در ویرایش آدرس");
    }
  },

  /**
   * Delete Address
   * @param addressId - Address ID
   */
  deleteAddress: async (addressId: string): Promise<{ success: boolean; data: any[] }> => {
    try {
      console.log("[AUTH] Deleting address:", addressId);
      const response = await api.delete(`/auth/addresses/${addressId}`);
      return response.data;
    } catch (error: any) {
      console.error("Error deleting address:", error);
      throw new Error(error.response?.data?.message || "خطا در حذف آدرس");
    }
  },



  /**
   * Get My Orders
   */
  getMyOrders: async (): Promise<{ success: boolean; data: any[] }> => {
    try {
      console.log("[AUTH] Fetching my orders");
      const response = await api.get("/orders/my-orders");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching my orders:", error);
      throw new Error(error.response?.data?.message || "خطا در دریافت سفارشات");
    }
  },

  /**
   * Get My Order Stats (FAST)
   * Optimized endpoint for profile page order counts
   */
  getMyOrderStats: async (): Promise<{ success: boolean; data: { processing: number; delivered: number; returned: number; cancelled: number; total: number } }> => {
    try {
      const response = await api.get("/orders/my-stats");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching order stats:", error);
      // Return default stats on error instead of throwing
      return { success: false, data: { processing: 0, delivered: 0, returned: 0, cancelled: 0, total: 0 } };
    }
  },

  /**
   * Get Single Order
   */
  getOrder: async (id: string): Promise<{ success: boolean; data: any }> => {
    try {
      console.log("[AUTH] Fetching order:", id);
      const response = await api.get(`/orders/${id}`);
      return response.data;
    } catch (error: any) {
      console.error("Error fetching order:", error);
      throw new Error(error.response?.data?.message || "خطا در دریافت جزئیات سفارش");
    }
  },

  /**
   * Initialize auth state
   * Sets up axios interceptor with stored token
   * Call this on app initialization
   */
  initializeAuth: (): void => {
    const token = authService.getToken();
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  },
  /**
   * Admin: Get All Orders
   */
  getAllOrders: async (): Promise<{ success: boolean; data: any[] }> => {
    try {
      console.log("[AUTH] Fetching all orders (Admin)");
      const response = await api.get("/orders");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching all orders:", error);
      throw new Error(error.response?.data?.message || "خطا در دریافت لیست سفارشات");
    }
  },

  /**
   * Admin: Update Order Status
   */
  updateOrderStatus: async (id: string, status: string, trackingCode?: string): Promise<{ success: boolean; data: any }> => {
    try {
      console.log(`[AUTH] Updating order ${id} status to ${status}`);
      const payload: any = { status };
      if (trackingCode) payload.trackingCode = trackingCode;

      const response = await api.put(`/orders/${id}/status`, payload);
      return response.data;
    } catch (error: any) {
      console.error("Error updating order status:", error);
      throw new Error(error.response?.data?.message || "خطا در تغییر وضعیت سفارش");
    }
  },

  /**
   * Bind Mobile: Send OTP
   */
  sendBindOtp: async (mobile: string): Promise<OtpResponse> => {
    try {
      console.log(`[AUTH] Sending bind OTP to ${mobile}`);
      const response = await api.post("/auth/bind-mobile/send-otp", { mobile });
      return response.data;
    } catch (error: any) {
      console.error("Error sending bind OTP:", error);
      throw new Error(error.response?.data?.message || "خطا در ارسال کد تایید");
    }
  },

  /**
   * Bind Mobile: Verify OTP
   */
  verifyBindOtp: async (mobile: string, code: string): Promise<AuthResponse> => {
    try {
      console.log(`[AUTH] Verifying bind OTP for ${mobile}`);
      const response = await api.post("/auth/bind-mobile/verify", { mobile, code });

      // Update local user data if successful
      if (response.data.success && response.data.data?.user) {
        const user = response.data.data.user;
        localStorage.setItem("user", JSON.stringify(user));
      }

      return response.data;
    } catch (error: any) {
      console.error("Error verifying bind OTP:", error);
      throw new Error(error.response?.data?.message || "کد تایید نامعتبر است");
    }
  },

  /**
   * Change Email: Send OTP
   */
  sendEmailOtp: async (email: string): Promise<OtpResponse> => {
    try {
      console.log(`[AUTH] Sending email OTP to ${email}`);
      const response = await api.post("/auth/change-email/send-otp", { email });
      return response.data;
    } catch (error: any) {
      console.error("Error sending email OTP:", error);
      throw new Error(error.response?.data?.message || "خطا در ارسال کد تایید");
    }
  },

  /**
   * Change Email: Verify OTP
   */
  verifyEmailOtp: async (email: string, code: string): Promise<AuthResponse> => {
    try {
      console.log(`[AUTH] Verifying email OTP for ${email}`);
      const response = await api.post("/auth/change-email/verify", { email, code });

      // Update local user data if successful
      if (response.data.success && response.data.data?.user) {
        const user = response.data.data.user;
        localStorage.setItem("user", JSON.stringify(user));
      }

      return response.data;
    } catch (error: any) {
      console.error("Error verifying email OTP:", error);
      throw new Error(error.response?.data?.message || "کد تایید نامعتبر است");
    }
  },
};

// Initialize auth on service load
if (typeof window !== "undefined") {
  authService.initializeAuth();
}
