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

export interface PricingResult {
  basePrice: number;
  finalPrice: number;
  discount: number;
  flashActive: boolean;
  specialActive: boolean;
  hasActivePromotion: boolean;
  oldPrice?: number;
}

/**
 * Normalize pricing for products and cart items.
 * - Applies time-based eligibility for discounts.
 * - Restores base price when countdowns expire.
 * - Avoids re-discounting prices that are already discounted.
 */
export function resolvePricing(input: PricingInput): PricingResult {
  const now = input.now ?? Date.now();
  const isFuture = (value?: string) => {
    if (!value) return false;
    const ts = Date.parse(value);
    return Number.isFinite(ts) && ts > now;
  };

  const rawPrice = Number.isFinite(input.price) ? input.price : 0;
  const rawDiscount = Number.isFinite(input.discount ?? 0) ? (input.discount as number) : 0;

  const flashActive = Boolean(input.isFlashDeal && (!input.flashDealEndTime || isFuture(input.flashDealEndTime)));
  const specialActive = Boolean(input.isSpecialOffer && (!input.specialOfferEndTime || isFuture(input.specialOfferEndTime)));
  const hasPromotionFlag = Boolean(input.isFlashDeal || input.isSpecialOffer || input.campaignLabel);
  const hasActivePromotion = flashActive || specialActive || Boolean(input.campaignLabel);
  const discountEligible = hasActivePromotion || (!hasPromotionFlag && rawDiscount > 0);
  const discount = discountEligible ? rawDiscount : 0;

  // Derive base price (original) first
  const basePrice = (() => {
    if (input.compareAtPrice && input.compareAtPrice > 0) {
      return Math.round(input.compareAtPrice);
    }
    if (rawDiscount > 0 && rawDiscount < 100 && rawPrice > 0) {
      return Math.round(rawPrice / (1 - rawDiscount / 100));
    }
    return rawPrice;
  })();

  // Decide which price to expose right now
  let finalPrice = basePrice;
  if (discount > 0 && basePrice > 0) {
    const discountedFromBase = Math.round(basePrice * (1 - discount / 100));
    const looksAlreadyDiscounted = Math.abs(discountedFromBase - rawPrice) <= 1;
    finalPrice = looksAlreadyDiscounted ? rawPrice : discountedFromBase;
  }

  return {
    basePrice,
    finalPrice,
    discount,
    flashActive,
    specialActive,
    hasActivePromotion: discountEligible,
    oldPrice: discount > 0 ? basePrice : undefined,
  };
}
