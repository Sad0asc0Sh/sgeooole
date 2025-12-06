import api from "@/lib/api";

/**
 * Settings Interface
 */
export interface Settings {
    // Store Information
    storeName?: string;
    storeEmail?: string;
    storePhone?: string;
    storeAddress?: string;

    // AI Configuration
    aiConfig?: {
        enabled: boolean;
        userDailyLimit: number;
        maxTokens: number;
    };

    // Cart Persistence Configuration
    cartConfig?: {
        persistCart: boolean; // آیا سبد خرید باید ماندگار باشد
        cartExpirationDays: number; // تعداد روزهایی که سبد خرید نگهداری میشود (0 = بی‌نهایت)
    };
}

/**
 * Settings Service
 *
 * Manages application-wide settings including cart persistence
 *
 * Backend Endpoints:
 * - GET /api/settings - Get current settings
 * - PUT /api/settings - Update settings
 *
 * Status: ✅ Connected to Real Backend API
 */
export const settingsService = {
    /**
     * Get Current Settings
     * Fetches all application settings from the server
     *
     * @returns Promise with settings data
     */
    getSettings: async (): Promise<{ success: boolean; data: Settings }> => {
        try {
            console.log("[SETTINGS] Fetching settings");

            const response = await api.get("/settings");

            return response.data;
        } catch (error: any) {
            console.error("Error fetching settings:", error);
            throw new Error(
                error.response?.data?.message || "خطا در دریافت تنظیمات"
            );
        }
    },

    /**
     * Update Settings
     * Updates application settings on the server
     *
     * @param settings - Settings object to update
     * @returns Promise with success status
     */
    updateSettings: async (
        settings: Partial<Settings>
    ): Promise<{ success: boolean; message?: string }> => {
        try {
            console.log("[SETTINGS] Updating settings");

            const response = await api.put("/settings", settings);

            return response.data;
        } catch (error: any) {
            console.error("Error updating settings:", error);
            throw new Error(
                error.response?.data?.message || "خطا در به‌روزرسانی تنظیمات"
            );
        }
    },

    /**
     * Get Cart Persistence Settings
     * Convenience method to get only cart-related settings
     *
     * @returns Promise with cart config
     */
    getCartConfig: async (): Promise<{
        persistCart: boolean;
        cartExpirationDays: number;
    }> => {
        try {
            const response = await settingsService.getSettings();
            return (
                response.data.cartConfig || {
                    persistCart: true,
                    cartExpirationDays: 30, // Default: 30 days
                }
            );
        } catch (error) {
            // Return default config if failed
            return {
                persistCart: true,
                cartExpirationDays: 30,
            };
        }
    },
};
