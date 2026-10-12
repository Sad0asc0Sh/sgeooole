import { findVariant, fromOptions } from "@/lib/variants";
import type { Product, ProductVariantOption } from "@/types/product";

/**
 * سقف موجودی در فرانت‌اند — فقط تجربه‌ی کاربری است، مرجع نهایی نیست.
 *
 * موجودی واقعی در بک‌اند هنگام «ثبت سفارش» به‌صورت اتمیک رزرو می‌شود؛
 * این توابع فقط جلوی انتخاب تعدادِ آشکارا بیشتر از موجودی را در صفحه‌ی
 * محصول و سبد می‌گیرند تا کاربر همان‌جا متوقف شود، نه در مرحله‌ی پرداخت.
 * وقتی موجودی معلوم نیست (undefined) هیچ سقفی اعمال نمی‌شود تا داده‌ی
 * ناقص، خرید را بی‌دلیل قفل نکند — بک‌اند در هر حال مرجع است.
 */

/** موجودی قابل سفارش برای یک محصول/ترکیب؛ undefined یعنی «نامعلوم». */
export function resolveAvailableStock(
    product: Pick<Product, "countInStock" | "variants"> | null | undefined,
    variantOptions?: ProductVariantOption[],
): number | undefined {
    if (!product) return undefined;

    if (variantOptions && variantOptions.length > 0 && Array.isArray(product.variants) && product.variants.length > 0) {
        const variant = findVariant(product.variants, fromOptions(variantOptions));
        if (variant) {
            const stock = Number(variant.stock);
            return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : undefined;
        }
        // ترکیب دقیق پیدا نشد: به موجودی سطح محصول (جمع ترکیب‌ها) برمی‌گردیم
    }

    const stock = Number(product.countInStock);
    return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : undefined;
}

/** تعداد درخواستی را به سقف موجودی محدود می‌کند؛ موجودی نامعلوم = بدون سقف. */
export function clampQuantity(requested: number, available: number | undefined): number {
    const qty = Math.max(0, Math.floor(Number(requested) || 0));
    if (available === undefined || !Number.isFinite(available)) return qty;
    return Math.min(qty, Math.max(0, Math.floor(available)));
}

/** آیا تعداد فعلی به سقف موجودی رسیده؟ (برای غیرفعال‌کردن دکمه‌ی +) */
export function isAtStockCap(quantity: number, available: number | undefined): boolean {
    if (available === undefined || !Number.isFinite(available)) return false;
    return Math.floor(Number(quantity) || 0) >= Math.max(0, Math.floor(available));
}
