import type { Product } from "@/types/product";
import { getServerNow } from "@/lib/serverClock";
import {
  resolveProductPromotion,
  type ProductPromotionKind,
} from "./productPromotion";

export type CardPricingContext = "listing" | "promo";

export type CardPricing = {
  /** "none" وقتی هیچ مدل موجودِ تخفیف‌داری وجود ندارد */
  kind: ProductPromotionKind;
  endTime?: string;
  displayPrice: number;
  /** فقط وقتی خودِ displayPrice تخفیف‌دار است */
  originalPrice?: number;
  discountPercent: number;
  /** پیشوند «از» */
  isFrom: boolean;
  /** بعضی مدل‌های موجود تخفیف ندارند → چیپ «تخفیف روی چند مدل» */
  isPartial: boolean;
  hasDiscountedVariant: boolean;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * قیمت واحد کارت برای محصولات ساده و متغیر.
 *
 * اصل: هر چیزی که روی کارت می‌آید (هدر، تایمر، درصد، قیمت خط‌خورده، قیمت)
 * باید متعلق به یک مدلِ مشخص و واقعاً تخفیف‌دار باشد.
 *
 * - محصول ساده: رفتار فعلی بدون تغییر (خروجی resolveProductPromotion).
 * - محصول متغیر، context=listing: نماینده = ارزان‌ترین مدل موجود.
 * - محصول متغیر، context=promo: نماینده = ارزان‌ترین مدل موجود و تخفیف‌دار.
 * - درصد فقط از discount ثبت‌شده (promo.effectiveDiscount) می‌آید، هرگز از
 *   اختلاف قیمت‌ها محاسبه نمی‌شود.
 * - فقط می‌خواند؛ هیچ فیلد محصول را تغییر نمی‌دهد.
 */
export function resolveCardPricing(
  product: Product,
  opts: { now?: number; context?: CardPricingContext } = {},
): CardPricing {
  const now = opts.now ?? getServerNow();
  const context = opts.context ?? "listing";
  const promo = resolveProductPromotion(product, now);
  const variants = (product.variants ?? []).filter(Boolean);

  // محصول ساده: رفتار فعلی بدون تغییر
  if (product.productType !== "variable" || variants.length === 0) {
    const hasMarkdown =
      promo.effectiveDiscount > 0 &&
      Boolean(product.oldPrice) &&
      toNumber(product.oldPrice, NaN) > promo.displayPrice;
    return {
      kind: promo.kind,
      endTime: promo.endTime,
      displayPrice: promo.displayPrice,
      originalPrice: hasMarkdown ? product.oldPrice : undefined,
      discountPercent: hasMarkdown ? promo.effectiveDiscount : 0,
      isFrom: false,
      isPartial: false,
      hasDiscountedVariant: hasMarkdown,
    };
  }

  const promoLive = promo.kind !== "none";
  const hasPromotionFlag = Boolean(
    product.isFlashDeal || product.isSpecialOffer,
  );
  // snapshot قبل از انقضا ساخته شده ولی الان تایمر تمام شده
  const expired = !promoLive && hasPromotionFlag;

  const rows = variants.map((v) => {
    const excluded = v.excludeFromPromotion === true;
    const price = toNumber(v.price, 0);
    const oldPrice = toNumber(v.oldPrice, NaN);
    const hasMarkdown =
      Number.isFinite(oldPrice) && oldPrice > price;
    const discounted = promoLive && !excluded && hasMarkdown;
    // بعد از انقضا قیمت پایه‌ی مدل (oldPrice) مبناست، مثل withSelectedVariant
    const effectivePrice =
      expired && !excluded && hasMarkdown ? oldPrice : price;
    return {
      v,
      price: effectivePrice,
      discounted,
      sellable: toNumber(v.stock, 0) > 0,
    };
  });

  const pool =
    rows.some((r) => r.sellable) ? rows.filter((r) => r.sellable) : rows;
  const discountedPool = pool.filter((r) => r.discounted);
  const hasDiscountedVariant = discountedPool.length > 0;

  const cheapest = (list: typeof rows) =>
    list.reduce((a, b) => (b.price < a.price ? b : a));
  const rep =
    context === "promo" && hasDiscountedVariant
      ? cheapest(discountedPool)
      : cheapest(pool);

  return {
    kind: hasDiscountedVariant ? promo.kind : "none",
    endTime: hasDiscountedVariant ? promo.endTime : undefined,
    displayPrice: rep.price,
    originalPrice: rep.discounted ? rep.v.oldPrice : undefined,
    discountPercent: rep.discounted ? promo.effectiveDiscount : 0,
    isFrom: new Set(pool.map((r) => r.price)).size > 1,
    isPartial: hasDiscountedVariant && pool.some((r) => !r.discounted),
    hasDiscountedVariant,
  };
}
