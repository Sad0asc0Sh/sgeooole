/**
 * User-facing promotion language.
 * ============================================================================
 * The backend has several distinct promotion mechanisms — `isFlashDeal`,
 * `isSpecialOffer`, `campaignLabel`/`campaignTheme`, plain `discount`. Those are
 * *internal* concepts. Customers should never have to learn the difference
 * between "شگفت‌انگیز" and "پیشنهاد لحظه‌ای" and "فروش ویژه" to understand
 * whether an offer applies to them.
 *
 * So the storefront speaks one language, built on two questions a buyer of
 * security equipment actually asks:
 *
 *   1. Is this offer time-limited?  → «فرصت زمان‌دار»
 *   2. Why is this product here?     → «انتخاب کارشناسی»
 *
 * Tone rules, applied throughout:
 *   - state facts, never shout («فرصت‌های زمان‌دار», not «حراج بزرگ!!!»)
 *   - no invented scarcity; stock language only appears when stock is really low
 *   - no translated marketing English («سوپر آفر», «مگا سیل», «آف»)
 *   - correct ZWNJ (نیم‌فاصله) throughout, which most of the old strings missed
 */

export type PromotionCopyKey =
  // Sections
  | "promotion.section.timed.title"
  | "promotion.section.timed.description"
  | "promotion.section.curated.title"
  | "promotion.section.curated.description"
  // Actions
  | "promotion.action.viewAll"
  | "promotion.action.viewAllOpportunities"
  // Reasons a product is highlighted
  | "promotion.reason.timed.label"
  | "promotion.reason.curated.label"
  | "promotion.reason.limitedStock.label"
  | "promotion.reason.campaign.label"
  | "promotion.reason.discount.label"
  // Time
  | "promotion.time.endsIn"
  | "promotion.time.remaining"
  // Countdown units (kept for callers that render units themselves)
  | "countdown.unit.day"
  | "countdown.unit.hour"
  | "countdown.unit.minute"
  | "countdown.unit.second"
  // Availability
  | "availability.outOfStock"
  | "availability.lowStock";

const PROMOTION_COPY_FA: Record<PromotionCopyKey, string> = {
  /* --- Sections -----------------------------------------------------------
     "فرصت" (opportunity) rather than "حراج" (sale): this is a specialist
     supplier presenting a buying window, not a bazaar. */
  "promotion.section.timed.title": "فرصت‌های زمان‌دار",
  "promotion.section.timed.description":
    "قیمت این کالاها تا پایان زمان اعلام‌شده معتبر است.",
  "promotion.section.curated.title": "انتخاب کارشناسی",
  "promotion.section.curated.description":
    "کالاهایی که کارشناسان ما برای پروژه‌های رایج پیشنهاد می‌کنند.",

  /* --- Actions ----------------------------------------------------------- */
  "promotion.action.viewAll": "مشاهده همه",
  "promotion.action.viewAllOpportunities": "همه فرصت‌های فعال",

  /* --- Reasons ----------------------------------------------------------- */
  "promotion.reason.timed.label": "زمان‌دار",
  "promotion.reason.curated.label": "پیشنهاد کارشناس",
  "promotion.reason.limitedStock.label": "موجودی محدود",
  "promotion.reason.campaign.label": "کمپین فعال",
  "promotion.reason.discount.label": "تخفیف فعال",

  /* --- Time -------------------------------------------------------------- */
  "promotion.time.endsIn": "پایان تا",
  "promotion.time.remaining": "باقی‌مانده",

  "countdown.unit.day": "روز",
  "countdown.unit.hour": "ساعت",
  "countdown.unit.minute": "دقیقه",
  "countdown.unit.second": "ثانیه",

  /* --- Availability ------------------------------------------------------
     «ناموجود» is the plain, non-apologetic Persian term. The old
     «فعلاً ناموجود» hedged without adding information. */
  "availability.outOfStock": "ناموجود",
  "availability.lowStock": "موجودی محدود",
};

export function getPromotionCopy(key: PromotionCopyKey): string {
  return PROMOTION_COPY_FA[key];
}
