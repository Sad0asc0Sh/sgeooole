import api from "./api";

/**
 * سرویس ردیابی بازدید دسته‌بندی‌ها
 * برای تحلیل محبوبیت دسته‌بندی‌ها
 */

// Session ID generator for anonymous users
const getSessionId = (): string => {
    if (typeof window === "undefined") return "";

    let sessionId = sessionStorage.getItem("category_view_session");
    if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem("category_view_session", sessionId);
    }
    return sessionId;
};

// Cache to prevent duplicate tracking in same session
const trackedCategories = new Set<string>();

/**
 * ثبت بازدید دسته‌بندی
 * @param categoryId شناسه دسته‌بندی
 * @param source منبع بازدید (homepage, search, menu, etc.)
 * @param viewType نوع بازدید (view, click)
 */
export const trackCategoryView = async (
    categoryId: string,
    source: "homepage" | "search" | "menu" | "sidebar" | "footer" | "related" | "other" = "other",
    viewType: "view" | "click" = "view"
): Promise<void> => {
    // Don't track if already tracked in this session (for same category + type)
    const trackKey = `${categoryId}_${viewType}`;
    if (trackedCategories.has(trackKey)) {
        return;
    }

    try {
        const sessionId = getSessionId();

        await api.post("/category-views/track", {
            categoryId,
            source,
            viewType,
        }, {
            headers: {
                "x-session-id": sessionId,
            },
        });

        // Mark as tracked
        trackedCategories.add(trackKey);
    } catch (error) {
        // Silently fail - tracking should not affect user experience
        console.debug("[CategoryTracking] Failed to track view:", error);
    }
};

/**
 * ثبت کلیک روی دسته‌بندی
 * @param categoryId شناسه دسته‌بندی
 * @param source منبع کلیک
 */
export const trackCategoryClick = async (
    categoryId: string,
    source: "homepage" | "search" | "menu" | "sidebar" | "footer" | "related" | "other" = "other"
): Promise<void> => {
    return trackCategoryView(categoryId, source, "click");
};

/**
 * Reset tracking cache (useful for testing)
 */
export const resetTrackingCache = (): void => {
    trackedCategories.clear();
};
