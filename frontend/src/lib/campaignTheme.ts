/**
 * Single source of truth for promotion colours.
 *
 * Every surface (product-card stripe, detail countdown banner, gallery badge,
 * price discount pill, cart badge) must read from here so that the colour of a
 * promotion is the exact same colour shoppers see everywhere — card and
 * product detail alike.
 *
 * Two families live here:
 *  - merchant campaigns («تخفیف‌های زمان‌دار»)، whose scheme the admin picks
 *    (`Sale.badgeTheme`), resolved by `getCampaignThemeScheme`;
 *  - fixed promotions that must never borrow a campaign colour:
 *      `flash`   «پیشنهاد لحظه‌ای» — amber → orange → red
 *      `amazing` «شگفت‌انگیز»    — solid red
 *    resolved by `getPromotionThemeScheme(kind, …)`.
 *
 * Resolving by *promotion kind* is what keeps a flash deal identical on the
 * card and on the product page. The backend pins `campaignTheme = "gold-red"`
 * on live flash deals (pricingService FLASH_THEME, productListingService), so
 * reading the stored theme alone painted a gold banner/badge/pill in the
 * detail while the card stripe stayed amber→orange→red.
 *
 * Browser-compat contract: gradients here use only plain hex colours inside
 * linear-gradient(), never oklch()/color-mix(); the `legacy-*` classes in
 * legacy-compat.generated.css render the same hex gradient (or a solid
 * fallback colour) on engines without oklch support.
 */

export type CampaignThemeVariant = "spring" | "gold" | "fire" | "blue";

/** Promotion kinds emitted by `resolveProductPromotion` (lib/promotions). */
export type PromotionSurfaceKind = "flash" | "campaign" | "amazing" | "none";

export type CampaignThemeScheme = {
  /** ProductCard top stripe (bg gradient classes with legacy fallback). */
  stripe: string;
  /** Solid accent bar colour used behind stripes when gradients fail. */
  stripeFallback: string;
  /** Text colour class for card labels / built-in timer text. */
  text: string;
  /**
   * Complete treatment of the product-detail countdown banner: background AND
   * foreground. Saturated schemes (flash) paint the very same gradient as the
   * card stripe; campaign schemes keep a soft wash so the countdown stays
   * legible on every hue.
   */
  banner: string;
  /** Optional capsule around the countdown digits on saturated banners. */
  bannerChip: string;
  /** Solid gradient pill (discount %, gallery badge) + legacy fallback. */
  pill: string;
  /** Inline style literal for React style props (old-browser safe). */
  pillStyle: string;
};

const SPRING: CampaignThemeScheme = {
  // lime → green: the «بهاره» gradient, identical on card + detail.
  stripe: "legacy-grad-lime bg-kala-spring-gradient",
  stripeFallback: "#00c950",
  text: "text-lime-700",
  banner: "kala-theme-spring-banner",
  bannerChip: "",
  pill: "legacy-grad-lime bg-kala-spring-gradient",
  pillStyle: "linear-gradient(to right, #9ae600, #00c950)",
};

const GOLD: CampaignThemeScheme = {
  // champagne → gold → deep bronze: keeps clear of the flash deal's
  // amber→orange→red band so «نوروزی/لوکس» is unmistakable everywhere.
  stripe: "legacy-grad-gold bg-kala-gold-gradient",
  stripeFallback: "#f0b100",
  text: "text-yellow-700",
  banner: "bg-yellow-50 text-yellow-800",
  bannerChip: "",
  pill: "legacy-grad-gold bg-kala-gold-gradient",
  pillStyle: "linear-gradient(to right, #fff085, #f0b100 45%, #894b00)",
};

const FIRE: CampaignThemeScheme = {
  stripe: "legacy-grad-fire bg-gradient-to-r from-rose-500 to-purple-700",
  stripeFallback: "#e11d48",
  text: "text-rose-600",
  banner: "bg-rose-50 text-rose-700",
  bannerChip: "",
  pill: "legacy-grad-fire bg-gradient-to-r from-rose-500 to-purple-700",
  pillStyle: "linear-gradient(to left, #f43f5e, #7e22ce)",
};

const BLUE: CampaignThemeScheme = {
  stripe: "legacy-grad-blue bg-gradient-to-r from-blue-400 to-indigo-500",
  stripeFallback: "#2563eb",
  text: "text-blue-600",
  banner: "bg-blue-50 text-blue-700",
  bannerChip: "",
  pill: "legacy-grad-blue bg-gradient-to-r from-blue-400 to-indigo-500",
  pillStyle: "linear-gradient(to left, #60a5fa, #6366f1)",
};

/**
 * «پیشنهاد لحظه‌ای» — amber-400 → orange-500 → red-600.
 *
 * One gradient, five surfaces: the card stripe, the card/cart badge, the gallery
 * badge, the discount pill and the detail countdown banner. `.bg-kala-timed-gradient`
 * lives in globals.css with the exact hex stops, so no engine has to interpolate
 * the gradient in oklab and no surface can drift from another.
 */
const FLASH: CampaignThemeScheme = {
  stripe: "bg-kala-timed-gradient",
  stripeFallback: "#ff6900",
  text: "text-orange-600",
  banner: "bg-kala-timed-gradient text-white shadow-sm",
  // White capsule keeps the digits legible over the yellow end of the gradient.
  bannerChip: "rounded-lg bg-white/95 px-2.5 py-1 text-orange-700 shadow-sm",
  pill: "bg-kala-timed-gradient",
  pillStyle: "linear-gradient(to right, #ffb900, #ff6900, #e7000b)",
};

const AMAZING: CampaignThemeScheme = {
  stripe: "bg-red-500",
  stripeFallback: "#fb2c36",
  text: "text-red-500",
  banner: "bg-red-50 text-red-600",
  bannerChip: "",
  pill: "bg-red-500",
  pillStyle: "linear-gradient(to right, #ef394e, #e7000b)",
};

const SCHEMES: Record<CampaignThemeVariant, CampaignThemeScheme> = {
  spring: SPRING,
  gold: GOLD,
  fire: FIRE,
  blue: BLUE,
};

const PROMOTION_SCHEMES: Partial<Record<PromotionSurfaceKind, CampaignThemeScheme>> = {
  flash: FLASH,
  amazing: AMAZING,
};

/**
 * Resolve the theme string persisted on a campaign (Sale.badgeTheme) to
 * a colour variant. Aliases cover legacy values that other tags used
 * before the schemes were consolidated.
 */
export function resolveCampaignThemeVariant(
  theme?: string | null,
): CampaignThemeVariant {
  switch (theme) {
    case "lime-blue":
    case "green-orange":
    case "lime-orange":
    case "lime":
    case "green":
      return "spring";
    case "gold-red":
    case "gold":
      return "gold";
    case "red-purple":
    case "fire":
    case "red":
      return "fire";
    default:
      return "blue";
  }
}

export function getCampaignThemeScheme(theme?: string | null): CampaignThemeScheme {
  return SCHEMES[resolveCampaignThemeVariant(theme)];
}

/**
 * The single resolver every surface should use.
 *
 * `flash` / `amazing` own their scheme regardless of the stored
 * `campaignTheme`; an explicit campaign (or no promotion at all) falls back to
 * the merchant-picked theme — the historical `blue` default included.
 */
export function getPromotionThemeScheme(
  kind: PromotionSurfaceKind,
  campaignTheme?: string | null,
): CampaignThemeScheme {
  return PROMOTION_SCHEMES[kind] ?? getCampaignThemeScheme(campaignTheme);
}

/** Product-card stripe + label colour for a promotion. */
export function promotionStripeClass(
  kind: PromotionSurfaceKind,
  campaignTheme?: string | null,
) {
  const scheme = getPromotionThemeScheme(kind, campaignTheme);
  return { stripe: scheme.stripe, text: scheme.text };
}

/** Solid gradient pill classes (gallery badge, discount pill). */
export function promotionPillClass(
  kind: PromotionSurfaceKind,
  campaignTheme?: string | null,
) {
  return getPromotionThemeScheme(kind, campaignTheme).pill;
}
