import type { Product, ProductAttribute, ProductVariant, ProductVariantOption } from "@/types/product";

/**
 * منطق انتخاب variant برای محصولات متغیر — خالص و بدون وابستگی به UI،
 * تا هم در کامپوننت‌ها و هم در تست‌ها قابل استفاده باشد.
 *
 * قرارداد کم‌ریسک: همه‌ی توابع در برابر ورودی خراب (آرایه‌ی null، گزینه‌ی
 * ناقص، قیمت NaN) سقوط نمی‌کنند؛ در بدترین حالت انتخاب خالی/قیمت پایه
 * برمی‌گردانند و محصول ساده دقیقاً مثل قبل رفتار می‌کند.
 */

/** انتخاب کاربر: { "رنگ": "قرمز", "سایز": "L" } */
export type Selection = Record<string, string>;

const norm = (v: unknown) => String(v ?? "").trim();

const num = (v: unknown, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

/** نگاشت رنگ‌های رایج فارسی به hex (وقتی پنل swatch نداده باشد). */
const FA_COLOR_HEX: Record<string, string> = {
    "مشکی": "#18181b",
    "سفید": "#ffffff",
    "قرمز": "#dc2626",
    "زرشکی": "#881337",
    "آبی": "#2563eb",
    "سرمه‌ای": "#1e3a8a",
    "آبی آسمانی": "#38bdf8",
    "سبز": "#16a34a",
    "سبز یشمی": "#047857",
    "زرد": "#eab308",
    "نارنجی": "#ea580c",
    "بنفش": "#9333ea",
    "صورتی": "#ec4899",
    "طوسی": "#6b7280",
    "خاکستری": "#6b7280",
    "قهوه‌ای": "#78350f",
    "کرم": "#fef3c7",
    "بژ": "#e7d8b7",
    "طلایی": "#d4af37",
    "نقره‌ای": "#c0c0c0",
    "نقره ای": "#c0c0c0",
};

export function colorHexFor(value: string, swatches?: Record<string, string>): string {
    const v = norm(value);
    if (swatches && swatches[v]) return swatches[v];
    if (FA_COLOR_HEX[v]) return FA_COLOR_HEX[v];
    // اگر خود مقدار یک رنگ CSS معتبر است (مثل #fff که ادمین دستی زده)
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
    return "#e5e7eb";
}

export function isColorAttribute(attr: ProductAttribute): boolean {
    if (!attr || !Array.isArray(attr.values)) return false;
    if (attr.displayType === "color") return true;
    if (attr.displayType === "button") return false;
    const n = norm(attr.name);
    if (/رنگ|color|colour/i.test(n)) return true;
    // اگر همه‌ی مقادیر رنگ شناخته‌شده باشند، دایره‌ای نمایش بده
    return (
        attr.values.length > 0 &&
        attr.values.every(
            (v) =>
                FA_COLOR_HEX[norm(v)] !== undefined ||
                (attr.swatches && attr.swatches[norm(v)] !== undefined),
        )
    );
}

const validVariants = (variants: ProductVariant[] | undefined | null): ProductVariant[] =>
    (Array.isArray(variants) ? variants : []).filter(
        (v): v is ProductVariant => Boolean(v) && typeof v === "object",
    );

/** اولین variant موجود (وگرنه ارزان‌ترین) را به‌عنوان انتخاب اولیه برگردان. */
export function initialSelection(variants: ProductVariant[]): Selection {
    const list = validVariants(variants);
    if (list.length === 0) return {};
    const inStock =
        list.find((v) => num(v.stock) > 0) ??
        [...list].sort((a, b) => num(a.price) - num(b.price))[0];
    const sel: Selection = {};
    for (const o of inStock.options ?? []) {
        if (norm(o?.name) && norm(o?.value)) sel[o.name] = o.value;
    }
    return sel;
}

/** پیدا کردن variant منطبق بر انتخاب (تطبیق دقیق همه‌ی گزینه‌ها). */
export function findVariant(
    variants: ProductVariant[],
    selection: Selection,
): ProductVariant | undefined {
    const list = validVariants(variants);
    if (list.length === 0) return undefined;
    const keys = Object.keys(selection ?? {}).filter((k) => norm(selection[k]) !== "");
    if (keys.length === 0) return undefined;
    return list.find(
        (v) =>
            (v.options ?? []).length === keys.length &&
            (v.options ?? []).every((o) => norm(selection[o.name]) === norm(o.value)),
    );
}

/**
 * اعمال یک انتخاب + اصلاح خودکار بقیه‌ی گزینه‌ها وقتی ترکیب نامعتبر است.
 * ترکیب‌های موجودِ دارای موجودی اولویت دارند.
 */
export function applyChoice(
    variants: ProductVariant[],
    selection: Selection,
    name: string,
    value: string,
): Selection {
    const list = validVariants(variants);
    const next: Selection = { ...(selection ?? {}), [name]: value };
    if (list.length === 0) return next;
    if (findVariant(list, next)) return next;

    const candidates = list.filter((v) =>
        (v.options ?? []).some(
            (o) => norm(o.name) === norm(name) && norm(o.value) === norm(value),
        ),
    );
    if (candidates.length === 0) return next; // مقدار ناشناخته؛ همان را نگه دار

    const inStock = candidates.filter((v) => num(v.stock) > 0);
    const pool = inStock.length > 0 ? inStock : candidates;
    // کاندیدی که بیشترین هم‌پوشانی با انتخاب فعلی دارد
    let best = pool[0];
    let bestScore = -1;
    for (const c of pool) {
        let score = 0;
        for (const o of c.options ?? []) {
            if (norm(o.name) === norm(name)) continue;
            if (norm(next[o.name]) === norm(o.value)) score += 1;
        }
        if (score > bestScore) {
            bestScore = score;
            best = c;
        }
    }
    const fixed: Selection = {};
    for (const o of best.options ?? []) {
        if (norm(o?.name)) fixed[o.name] = o.value;
    }
    return fixed;
}

/** کلید پایدار برای تطبیق آیتم سبد (مرتب‌شده، بدون حساسیت به ترتیب). */
export function optionsKey(
    options: ProductVariantOption[] | Selection | undefined | null,
): string {
    if (!options) return "";
    const arr: ProductVariantOption[] = Array.isArray(options) ? options : toOptions(options);
    return arr
        .filter((o) => o && norm(o.name) && norm(o.value))
        .map((o) => `${norm(o.name)}:${norm(o.value)}`)
        .sort()
        .join("|");
}

export function toOptions(selection: Selection): ProductVariantOption[] {
    return Object.entries(selection ?? {})
        .filter(([, v]) => norm(v) !== "")
        .map(([name, value]) => ({ name, value }));
}

export function fromOptions(options: ProductVariantOption[] | undefined | null): Selection {
    const sel: Selection = {};
    for (const o of options ?? []) {
        if (o && norm(o.name) && norm(o.value)) sel[o.name] = o.value;
    }
    return sel;
}

/**
 * محصول نمایشی: قیمت/موجودی/تصویر variant انتخاب‌شده روی محصول سوار می‌شود
 * تا بقیه‌ی UI (قیمت، دکمه‌ی خرید، گالری) بدون تغییر درست کار کند.
 * اگر پروموشن محصول منقضی شده باشد (discount صفر و بدون فلگ تایمری)،
 * قیمت پایه‌ی variant (oldPrice) مبناست نه قیمت تخفیف‌خورده‌ی کش‌شده.
 */
export function withSelectedVariant<T extends Product>(
    product: T,
    variant: ProductVariant | undefined | null,
): T {
    if (!variant || typeof variant !== "object") return product;
    // متغیر مستثنی از تخفیف (تیک تخفیف در پنل ادمین خاموش): قیمت پایه‌ی خودش نمایش
    // داده می‌شود و هیچ اثری از پروموشن محصول (لیبل، تم، تایمر، درصد، قیمت خط‌خورده)
    // روی آن نمی‌ماند؛ هم برای تخفیف زمان‌دار (Sale) و هم لحظه‌ای/شگفت‌انگیز.
    if (variant.excludeFromPromotion === true) {
        const exImages =
            variant.images && variant.images.length > 0 ? variant.images : product.images;
        return {
            ...product,
            price: num(variant.price, num(product.price)),
            oldPrice: undefined,
            compareAtPrice: undefined,
            discount: 0,
            isFlashDeal: false,
            flashDealEndTime: undefined,
            isSpecialOffer: false,
            specialOfferEndTime: undefined,
            campaignLabel: undefined,
            campaignTheme: undefined,
            countInStock: num(variant.stock),
            image: exImages[0] ?? product.image,
            images: exImages,
            sku: variant.sku ?? product.sku,
        };
    }
    const promotionDead =
        !(num(product.discount) > 0) && !product.isFlashDeal && !product.isSpecialOffer;
    const basePrice = num(variant.oldPrice, NaN);
    const hasBase = Number.isFinite(basePrice);
    const finalPrice = num(variant.price, num(product.price));
    const price = promotionDead ? (hasBase ? basePrice : finalPrice) : finalPrice;
    const oldPrice = promotionDead ? undefined : variant.oldPrice;
    const images =
        variant.images && variant.images.length > 0 ? variant.images : product.images;
    return {
        ...product,
        price,
        oldPrice,
        compareAtPrice: oldPrice ?? product.compareAtPrice,
        countInStock: num(variant.stock),
        image: images[0] ?? product.image,
        images,
        sku: variant.sku ?? product.sku,
    };
}

/** بازه‌ی قیمت variants برای سئو (AggregateOffer) و راهنمای «قیمت از …». */
export function priceRange(variants: ProductVariant[] | undefined | null): {
    min: number;
    max: number;
} | null {
    const prices = validVariants(variants)
        .map((v) => num(v.price, NaN))
        .filter((p) => Number.isFinite(p));
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** اختلاف قیمت یک variant نسبت به ارزان‌ترین variant (برای تگ «+۲۰٬۰۰۰»). */
export function priceDiffFromMin(
    variants: ProductVariant[],
    variant: ProductVariant | undefined | null,
): number {
    if (!variant) return 0;
    const range = priceRange(variants);
    if (!range) return 0;
    return num(variant.price) - range.min;
}

/**
 * آیا مقدار `value` برای ویژگی `name` با توجه به بقیه‌ی انتخاب‌ها ناموجود است؟
 * (همه‌ی variantهای سازگار با این مقدار + بقیه‌ی انتخاب‌ها stock صفر دارند)
 */
export function isOptionOutOfStock(
    variants: ProductVariant[],
    selection: Selection,
    name: string,
    value: string,
): boolean {
    const list = validVariants(variants);
    if (list.length === 0) return false;
    const others = Object.entries(selection ?? {}).filter(
        ([k, v]) => norm(k) !== norm(name) && norm(v) !== "",
    );
    const compatible = list.filter((v) => {
        const opts = v.options ?? [];
        const hasTarget = opts.some(
            (o) => norm(o.name) === norm(name) && norm(o.value) === norm(value),
        );
        if (!hasTarget) return false;
        return others.every(([k, val]) =>
            opts.some((o) => norm(o.name) === norm(k) && norm(o.value) === norm(val)),
        );
    });
    if (compatible.length === 0) return false; // ترکیب تعریف‌نشده → غیرفعال نکن
    return compatible.every((v) => num(v.stock) <= 0);
}

/** همه‌ی مقادیر ناموجود یک ویژگی (برای استایل خط‌خورده). */
export function outOfStockValues(
    variants: ProductVariant[],
    selection: Selection,
    attrName: string,
): Set<string> {
    const attrValues = new Set<string>();
    for (const v of validVariants(variants)) {
        for (const o of v.options ?? []) {
            if (norm(o.name) === norm(attrName) && norm(o.value)) attrValues.add(o.value);
        }
    }
    const out = new Set<string>();
    for (const val of attrValues) {
        if (isOptionOutOfStock(variants, selection, attrName, val)) out.add(val);
    }
    return out;
}
