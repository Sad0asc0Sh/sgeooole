/**
 * Local Storage Helper with Expiration Support
 *
 * این ماژول localStorage را با قابلیت expiration مدیریت می‌کند
 * برای استفاده در سبد خرید و سایر داده‌های ماندگار
 */

interface StoredData<T> {
    data: T;
    timestamp: number;
    expirationDays?: number; // 0 = بی‌نهایت
}

/**
 * ذخیره داده در localStorage با تاریخ انقضا
 *
 * @param key - کلید localStorage
 * @param data - داده برای ذخیره
 * @param expirationDays - تعداد روز تا انقضا (0 = بی‌نهایت)
 */
export function setLocalStorageWithExpiry<T>(
    key: string,
    data: T,
    expirationDays: number = 30
): void {
    if (typeof window === "undefined") return;

    const storedData: StoredData<T> = {
        data,
        timestamp: Date.now(),
        expirationDays,
    };

    try {
        localStorage.setItem(key, JSON.stringify(storedData));
        console.log(
            `[LOCAL_STORAGE] Saved "${key}" with ${expirationDays === 0 ? "no expiration" : `${expirationDays} days expiry`
            }`
        );
    } catch (error) {
        console.error(`[LOCAL_STORAGE] Error saving "${key}":`, error);
    }
}

/**
 * دریافت داده از localStorage با بررسی تاریخ انقضا
 *
 * @param key - کلید localStorage
 * @returns داده یا null اگر منقضی شده باشد
 */
export function getLocalStorageWithExpiry<T>(key: string): T | null {
    if (typeof window === "undefined") return null;

    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const storedData: StoredData<T> = JSON.parse(item);

        // اگر expirationDays برابر 0 باشد، هیچ وقت منقضی نمیشود
        if (
            storedData.expirationDays === undefined ||
            storedData.expirationDays === 0
        ) {
            return storedData.data;
        }

        // بررسی تاریخ انقضا
        const now = Date.now();
        const expirationTime =
            storedData.timestamp + storedData.expirationDays * 24 * 60 * 60 * 1000;

        if (now > expirationTime) {
            console.log(`[LOCAL_STORAGE] "${key}" has expired. Removing...`);
            localStorage.removeItem(key);
            return null;
        }

        return storedData.data;
    } catch (error) {
        console.error(`[LOCAL_STORAGE] Error reading "${key}":`, error);
        return null;
    }
}

/**
 * حذف داده از localStorage
 *
 * @param key - کلید localStorage
 */
export function removeLocalStorage(key: string): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.removeItem(key);
        console.log(`[LOCAL_STORAGE] Removed "${key}"`);
    } catch (error) {
        console.error(`[LOCAL_STORAGE] Error removing "${key}":`, error);
    }
}

/**
 * بررسی وجود و اعتبار داده در localStorage
 *
 * @param key - کلید localStorage
 * @returns true اگر داده معتبر وجود داشته باشد
 */
export function hasValidLocalStorage(key: string): boolean {
    return getLocalStorageWithExpiry(key) !== null;
}

/**
 * به‌روزرسانی تاریخ انقضای یک داده موجود
 *
 * @param key - کلید localStorage
 * @param newExpirationDays - تعداد روز جدید تا انقضا
 */
export function updateLocalStorageExpiry(
    key: string,
    newExpirationDays: number
): void {
    if (typeof window === "undefined") return;

    try {
        const item = localStorage.getItem(key);
        if (!item) return;

        const storedData: StoredData<any> = JSON.parse(item);
        storedData.expirationDays = newExpirationDays;
        storedData.timestamp = Date.now(); // Reset timestamp

        localStorage.setItem(key, JSON.stringify(storedData));
        console.log(
            `[LOCAL_STORAGE] Updated "${key}" expiry to ${newExpirationDays === 0 ? "no expiration" : `${newExpirationDays} days`
            }`
        );
    } catch (error) {
        console.error(`[LOCAL_STORAGE] Error updating "${key}" expiry:`, error);
    }
}

/**
 * دریافت اطلاعات تاریخ انقضا برای یک کلید
 *
 * @param key - کلید localStorage
 * @returns اطلاعات انقضا یا null
 */
export function getLocalStorageExpiryInfo(key: string): {
    expiresAt: Date | null;
    daysRemaining: number | null;
    isExpired: boolean;
} | null {
    if (typeof window === "undefined") return null;

    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const storedData: StoredData<any> = JSON.parse(item);

        // اگر بی‌نهایت باشد
        if (
            storedData.expirationDays === undefined ||
            storedData.expirationDays === 0
        ) {
            return {
                expiresAt: null,
                daysRemaining: null,
                isExpired: false,
            };
        }

        const expirationTime =
            storedData.timestamp + storedData.expirationDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const daysRemaining = Math.ceil(
            (expirationTime - now) / (24 * 60 * 60 * 1000)
        );

        return {
            expiresAt: new Date(expirationTime),
            daysRemaining: Math.max(0, daysRemaining),
            isExpired: now > expirationTime,
        };
    } catch (error) {
        console.error(
            `[LOCAL_STORAGE] Error getting expiry info for "${key}":`,
            error
        );
        return null;
    }
}
