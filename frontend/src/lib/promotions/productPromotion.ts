import { isFlashDealLabel } from "@/lib/flashDealUtils";

/**
 * Only the fields used by product cards to render promotion chrome and pricing.
 * Keeping this input narrow prevents the card layer from mutating or depending on
 * any unrelated product fields.
 */
export type ProductPromotionInput = {
  price: number;
  oldPrice?: number;
  discount?: number;
  isFlashDeal?: boolean;
  flashDealEndTime?: string;
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;
  campaignLabel?: string;
  campaignTheme?: string;
};

export type ProductPromotionKind = "flash" | "campaign" | "amazing" | "none";

export type ProductPromotionState = {
  kind: ProductPromotionKind;
  isFlashDealActive: boolean;
  isSpecialOfferActive: boolean;
  hasCampaignMetadata: boolean;
  effectiveDiscount: number;
  displayPrice: number;
  endTime?: string;
};

const toFutureTimestamp = (value: string | undefined, now: number): number | null => {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now ? timestamp : null;
};

/**
 * Resolves a card's visible promotion from explicit product state.
 *
 * Stable precedence is deliberate: active flash deal, active named campaign,
 * active special offer ("شگفت‌انگیز"), then ordinary discount without a header.
 * A raw numeric discount is never allowed to manufacture an "amazing" label.
 */
export function resolveProductPromotion(
  product: ProductPromotionInput,
  now: number = Date.now(),
): ProductPromotionState {
  const flashEndTimestamp = toFutureTimestamp(product.flashDealEndTime, now);
  const specialEndTimestamp = toFutureTimestamp(product.specialOfferEndTime, now);

  const isFlashDealActive = Boolean(product.isFlashDeal && flashEndTimestamp);
  const isSpecialOfferActive = Boolean(product.isSpecialOffer && specialEndTimestamp);
  const hasCampaignMetadata = Boolean(
    (product.campaignLabel || product.campaignTheme) &&
      !isFlashDealLabel(product.campaignLabel),
  );

  // A campaign backed by the special-offer flag must still have a live end time.
  const isCampaignActive = hasCampaignMetadata &&
    (!product.isSpecialOffer || isSpecialOfferActive);

  let kind: ProductPromotionKind = "none";
  let endTime: string | undefined;

  if (isFlashDealActive) {
    kind = "flash";
    endTime = product.flashDealEndTime;
  } else if (isCampaignActive) {
    kind = "campaign";
    endTime = product.specialOfferEndTime;
  } else if (isSpecialOfferActive) {
    kind = "amazing";
    endTime = product.specialOfferEndTime;
  }

  const hasPromotionFlag = Boolean(product.isFlashDeal || product.isSpecialOffer);
  const hasActiveTimedPromotion = kind !== "none";
  const rawDiscount = Number.isFinite(product.discount) && Number(product.discount) > 0
    ? Number(product.discount)
    : (product.oldPrice && product.oldPrice > product.price
        ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
        : 0);

  const effectiveDiscount = rawDiscount > 0 &&
    (hasActiveTimedPromotion || !hasPromotionFlag)
    ? rawDiscount
    : 0;

  const displayPrice = !hasActiveTimedPromotion && hasPromotionFlag && product.oldPrice
    ? product.oldPrice
    : product.price;

  return {
    kind,
    isFlashDealActive,
    isSpecialOfferActive,
    hasCampaignMetadata,
    effectiveDiscount,
    displayPrice,
    endTime,
  };
}

/**
 * Returns the closest future promotion boundary for one product. Card containers
 * can render once at that boundary instead of re-rendering every second.
 */
export function getNextPromotionExpiry(
  product: Pick<
    ProductPromotionInput,
    "isFlashDeal" | "flashDealEndTime" | "isSpecialOffer" | "specialOfferEndTime"
  >,
  now: number = Date.now(),
): number | null {
  const candidates = [
    product.isFlashDeal ? toFutureTimestamp(product.flashDealEndTime, now) : null,
    product.isSpecialOffer ? toFutureTimestamp(product.specialOfferEndTime, now) : null,
  ].filter((value): value is number => value !== null);

  return candidates.length > 0 ? Math.min(...candidates) : null;
}
