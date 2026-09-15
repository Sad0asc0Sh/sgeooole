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

  const flashFlag = Boolean(input.isFlashDeal);
  const specialFlag = Boolean(input.isSpecialOffer);
  const flashActive = Boolean(flashFlag && (!input.flashDealEndTime || isFuture(input.flashDealEndTime)));
  const specialActive = Boolean(specialFlag && (!input.specialOfferEndTime || isFuture(input.specialOfferEndTime)));

  // Only treat campaign label as an active promotion when it is NOT tied to a timed flash/special flag.
  const labelActive = Boolean(input.campaignLabel) && !flashFlag && !specialFlag;
  const hasPromotionFlag = Boolean(flashFlag || specialFlag || input.campaignLabel);
  const hasActivePromotion = flashActive || specialActive || labelActive;

  const discountEligible = hasActivePromotion || (!hasPromotionFlag && rawDiscount > 0);
  const discount = discountEligible ? rawDiscount : 0;

  // If no discount is active, the final selling price MUST ALWAYS be the product's actual price (rawPrice)
  if (discount <= 0) {
    const hasValidComparePrice = Boolean(
      input.compareAtPrice &&
      input.compareAtPrice > rawPrice
    );

    // If a timed promotion was configured but is now expired, revert selling price to the base price (compareAtPrice)
    const wasTimedPromotionExpired = hasPromotionFlag && hasValidComparePrice;
    const finalPrice = wasTimedPromotionExpired ? Math.round(input.compareAtPrice!) : rawPrice;
    const basePrice = wasTimedPromotionExpired ? finalPrice : rawPrice;

    return {
      basePrice,
      finalPrice,
      discount: 0,
      flashActive: false,
      specialActive: false,
      hasActivePromotion: false,
      oldPrice: !wasTimedPromotionExpired && hasValidComparePrice ? Math.round(input.compareAtPrice!) : undefined,
    };
  }

  // If a discount is active:
  // If compareAtPrice is explicitly provided and greater than rawPrice, rawPrice was already precomputed/discounted.
  // Otherwise, rawPrice is the base price from which discount should be calculated.
  const hasPrecomputedDiscount = Boolean(
    input.compareAtPrice && input.compareAtPrice > rawPrice
  );

  const basePrice = hasPrecomputedDiscount
    ? Math.round(input.compareAtPrice!)
    : rawPrice;

  const finalPrice = hasPrecomputedDiscount
    ? rawPrice
    : Math.round(basePrice * (1 - discount / 100));

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
