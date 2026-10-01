import { isFlashDealLabel } from "@/lib/flashDealUtils";
import { resolveBasePrice } from "@/lib/pricing";
import { getServerNow } from "@/lib/serverClock";

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
  now: number = getServerNow(),
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
  // Discount comes ONLY from the stored percentage. Never derive it from
  // oldPrice/price gap — stale compareAtPrice would fabricate 80%+ badges.
  const rawDiscount = Number.isFinite(product.discount) && Number(product.discount) > 0
    ? Number(product.discount)
    : 0;

  const effectiveDiscount = rawDiscount > 0 &&
    (hasActiveTimedPromotion || !hasPromotionFlag)
    ? rawDiscount
    : 0;

  // قیمت نمایان بعد از انقضا = قیمت پایه‌ی بازیابی‌شده (قرارداد واحد با resolvePricing
  // و بک‌اند). oldPrice فقط وقتی مبناست که snapshot تخفیف‌خورده باشد؛ یک oldPrice
  // کهنه/بزرگ که با تخفیف ثبت‌شده نخواند هرگز قیمت را بالا نمی‌برد.
  const displayPrice = !hasActiveTimedPromotion && hasPromotionFlag && product.oldPrice
    ? resolveBasePrice(product.price, product.oldPrice, rawDiscount)
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
  now: number = getServerNow(),
): number | null {
  const candidates = [
    product.isFlashDeal ? toFutureTimestamp(product.flashDealEndTime, now) : null,
    product.isSpecialOffer ? toFutureTimestamp(product.specialOfferEndTime, now) : null,
  ].filter((value): value is number => value !== null);

  return candidates.length > 0 ? Math.min(...candidates) : null;
}

/**
 * Removes every trace of an EXPIRED timed promotion (label, theme, flags, discount,
 * struck-through price) from a product snapshot and restores the pre-discount price.
 *
 * Why: ISR (revalidate=600) + the backend response cache mean a page can be rendered
 * from a snapshot taken BEFORE a Sale / flash / special offer ended. Without this,
 * components that only look at `campaignLabel` keep showing the badge after the
 * countdown reached zero while the price already reverted.
 *
 * Rules:
 *  - a live promotion, or a plain product with an ordinary discount (no timer flags,
 *    no campaign metadata), is returned untouched (same reference → no re-render);
 *  - only snapshots that carry timer flags / campaign metadata AND resolve to
 *    kind === "none" are cleaned.
 */
export function stripExpiredPromotion<T extends ProductPromotionInput & { compareAtPrice?: number }>(
  product: T,
  now: number = getServerNow(),
): T {
  const state = resolveProductPromotion(product, now);
  if (state.kind !== "none") return product;

  const hasTimerFlag = Boolean(product.isFlashDeal || product.isSpecialOffer);
  const hasCampaignTrace = Boolean(product.campaignLabel || product.campaignTheme);
  if (!hasTimerFlag && !hasCampaignTrace) return product;

  return {
    ...product,
    price: state.displayPrice,
    oldPrice: undefined,
    compareAtPrice: undefined,
    discount: 0,
    isFlashDeal: false,
    flashDealEndTime: undefined,
    isSpecialOffer: false,
    specialOfferEndTime: undefined,
    campaignLabel: undefined,
    campaignTheme: undefined,
  } as T;
}
