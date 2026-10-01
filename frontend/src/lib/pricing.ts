export interface PricingInput {
  price: number;
  discount?: number;
  compareAtPrice?: number;
  isFlashDeal?: boolean;
  flashDealEndTime?: string;
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;
  campaignLabel?: string;
  now?: number;
}

import { getServerNow } from "./serverClock";

export interface PricingResult {
  basePrice: number;
  finalPrice: number;
  discount: number;
  flashActive: boolean;
  specialActive: boolean;
  hasActivePromotion: boolean;
  oldPrice?: number;
}

// تلرانس تشخیص داده‌ی قدیمی (خطای رُند شدن، به تومان) — آینه‌ی resolveBasePrice بک‌اند
const LEGACY_BASE_TOLERANCE = 1;

/**
 * مبنای واحد تخفیف — آینه‌ی resolveBasePrice بک‌اند (services/pricingService.js).
 * مبنای تخفیف درصدی همیشه «price» است؛ compareAtPrice فقط قیمت خط‌خورده‌ی نمایشی است.
 * تنها استثنا (سازگاری با داده‌ی قدیمی): اگر price از قبل تخفیف‌خورده ذخیره شده باشد،
 * یعنی compareAtPrice > price و رابطه‌ی price ≈ compareAtPrice × (1 − storedDiscount/100)
 * برقرار باشد، compareAtPrice مبناست. تخفیف کمپین برای این تشخیص استفاده نمی‌شود.
 */
export function resolveBasePrice(price: number, compareAtPrice: number, storedDiscount = 0): number {
  const p = Number.isFinite(price) ? price : 0;
  const c = Number.isFinite(compareAtPrice) ? compareAtPrice : 0;
  // قیمت صفر/نامعتبر: رفتار قبلی (max) حفظ می‌شود
  if (p <= 0) return Math.max(p, c);
  if (c > p) {
    const d = Number.isFinite(storedDiscount) ? storedDiscount : 0;
    if (d > 0 && d <= 100 && Math.abs(p - c * (1 - d / 100)) <= LEGACY_BASE_TOLERANCE) {
      return c;
    }
  }
  return p;
}

/**
 * Normalize pricing for products and cart items.
 * - Applies time-based eligibility for discounts.
 * - Restores base price when countdowns expire.
 * - Never inflates the final price to a stale compareAtPrice.
 */
export function resolvePricing(input: PricingInput): PricingResult {
  // ساعت تصحیح‌شده‌ی سرور: اختلاف ساعت دستگاه نباید کارت را روی قیمت تخفیفی قفل کند.
  const now = input.now ?? getServerNow();
  const isFuture = (value?: string) => {
    if (!value) return false;
    const ts = Date.parse(value);
    return Number.isFinite(ts) && ts > now;
  };

  const rawPrice = Number.isFinite(input.price) ? input.price : 0;
  const rawDiscount = Number.isFinite(input.discount ?? 0) ? (input.discount as number) : 0;

  const flashFlag = Boolean(input.isFlashDeal);
  const specialFlag = Boolean(input.isSpecialOffer);
  const flashActive = Boolean(flashFlag && (!input.flashDealEndTime || isFuture(input.flashDealEndTime)));
  const specialActive = Boolean(specialFlag && (!input.specialOfferEndTime || isFuture(input.specialOfferEndTime)));

  // Only treat campaign label as an active promotion when it is NOT tied to a timed flash/special flag.
  const labelActive = Boolean(input.campaignLabel) && !flashFlag && !specialFlag;
  const hasPromotionFlag = Boolean(flashFlag || specialFlag || input.campaignLabel);
  const hasActivePromotion = flashActive || specialActive || labelActive;

  // Discount comes ONLY from the real stored percentage (DB / campaign).
  // NEVER derive a percentage from compareAtPrice gap: a stale inflated
  // compareAtPrice with discount=0 would otherwise fabricate an 80%+ badge.
  // e.g. price=100, compareAtPrice=500 -> (500-100)/500 = 80% phantom off.
  const effectiveRawDiscount = rawDiscount;

  const discountEligible = hasActivePromotion || (!hasPromotionFlag && effectiveRawDiscount > 0);
  const discount = discountEligible ? effectiveRawDiscount : 0;

  // مبنای واحد طبق قرارداد مرکزی — تشخیص داده‌ی قدیمی فقط با تخفیف ثبت‌شده‌ی خود محصول
  const basePrice = resolveBasePrice(rawPrice, input.compareAtPrice ?? 0, rawDiscount);

  // If no discount is active, the final selling price is the product's BASE price.
  //
  // IMPORTANT: the server already returns promotion snapshots with a DISCOUNTED `price`
  // (+ `compareAtPrice` = base and `discount`). If this client decides the countdown has
  // already ended (payload older than its end time, a cached/restored snapshot, or a
  // device clock slightly ahead of the server), `rawPrice` is the discounted price, so
  // using it would pin the card to the discounted amount with no badge. `basePrice` above
  // restores the base ONLY for such a snapshot (price ≈ compareAtPrice × (1 − discount)),
  // exactly as the backend does on expiry; a stale/inflated compareAtPrice that does not
  // match the stored discount is still ignored, so it can never inflate the price.
  if (discount <= 0) {
    return {
      basePrice,
      finalPrice: basePrice,
      discount: 0,
      flashActive: false,
      specialActive: false,
      hasActivePromotion: false,
      // No markdown without a real discount: stale compareAtPrice must not
      // leak as oldPrice, otherwise cards derive a phantom % from the gap.
      oldPrice: undefined,
    };
  }

  // If a discount is active: final = round(base × (1 − discount/100)), old = base.
  const finalPrice = Math.round(basePrice * (1 - discount / 100));

  return {
    basePrice,
    finalPrice,
    discount,
    flashActive,
    specialActive,
    hasActivePromotion: true,
    oldPrice: basePrice > finalPrice ? basePrice : undefined,
  };
}
