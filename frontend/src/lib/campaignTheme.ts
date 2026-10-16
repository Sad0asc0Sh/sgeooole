/**
 * Single source of truth for campaign-badge theme colours.
 *
 * Every surface (product card stripe, detail countdown banner, gallery
 * badge, price discount pill) must read from here so that the colour a
 * merchant picks in the admin «تخفیف‌های زمان‌دار» panel is the exact
 * colour shoppers see everywhere — card and product detail alike.
 *
 * Browser-compat contract: gradients here use only plain hex colours
 * inside linear-gradient(), never oklch()/color-mix(), and every scheme
 * also carries a legacy-* class from legacy-compat.generated.css that
 * renders the same hex gradient (or a solid fallback colour) on engines
 * without oklch support.
 */

export type CampaignThemeVariant = "spring" | "gold" | "fire" | "blue";

type Scheme = {
  /** ProductCard top stripe (bg gradient classes with legacy fallback). */
  stripe: string;
  /** Solid accent bar colour used behind stripes when gradients fail. */
  stripeFallback: string;
  /** Text colour class for card labels / built-in timer text. */
  text: string;
  /** Soft wash classes for the product-detail countdown banner. */
  banner: string;
  /** Solid gradient pill (discount %, gallery badge) + legacy fallback. */
  pill: string;
  /** Inline style literal for React style props (old-browser safe). */
  pillStyle: string;
};

const SPRING: Scheme = {
  // lime → green: the «بهاره» gradient, identical on card + detail.
  stripe: "legacy-grad-lime bg-kala-spring-gradient",
  stripeFallback: "#00c950",
  text: "text-lime-700",
  banner: "kala-theme-spring-banner",
  pill: "legacy-grad-lime bg-kala-spring-gradient",
  pillStyle: "linear-gradient(to right, #9ae600, #00c950)",
};

const GOLD: Scheme = {
  stripe: "legacy-grad-gold bg-gradient-to-r from-amber-400 to-orange-500",
  stripeFallback: "#f97316",
  text: "text-amber-600",
  banner: "bg-amber-50 text-amber-700",
  pill: "legacy-grad-gold bg-gradient-to-r from-amber-400 to-orange-500",
  pillStyle: "linear-gradient(to left, #fbbf24, #f97316)",
};

const FIRE: Scheme = {
  stripe: "legacy-grad-fire bg-gradient-to-r from-rose-500 to-purple-700",
  stripeFallback: "#e11d48",
  text: "text-rose-600",
  banner: "bg-rose-50 text-rose-700",
  pill: "legacy-grad-fire bg-gradient-to-r from-rose-500 to-purple-700",
  pillStyle: "linear-gradient(to left, #f43f5e, #7e22ce)",
};

const BLUE: Scheme = {
  stripe: "legacy-grad-blue bg-gradient-to-r from-blue-400 to-indigo-500",
  stripeFallback: "#2563eb",
  text: "text-blue-600",
  banner: "bg-blue-50 text-blue-700",
  pill: "legacy-grad-blue bg-gradient-to-r from-blue-400 to-indigo-500",
  pillStyle: "linear-gradient(to left, #60a5fa, #6366f1)",
};

const SCHEMES: Record<CampaignThemeVariant, Scheme> = {
  spring: SPRING,
  gold: GOLD,
  fire: FIRE,
  blue: BLUE,
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

export function getCampaignThemeScheme(theme?: string | null): Scheme {
  return SCHEMES[resolveCampaignThemeVariant(theme)];
}

/** Product-card stripe + label colour for the given campaign theme. */
export function campaignStripeClass(theme?: string | null) {
  const scheme = getCampaignThemeScheme(theme);
  return { stripe: scheme.stripe, text: scheme.text };
}

/** Solid gradient pill classes (gallery badge, desktop discount pill). */
export function campaignPillClass(theme?: string | null) {
  return getCampaignThemeScheme(theme).pill;
}

/** Soft banner classes for the product-detail countdown box. */
export function campaignBannerClass(theme?: string | null) {
  return getCampaignThemeScheme(theme).banner;
}

/** Inline gradient (React style prop) — old-browser safe hex values. */
export function campaignPillStyle(
  theme?: string | null,
): React.CSSProperties {
  return { backgroundImage: getCampaignThemeScheme(theme).pillStyle };
}
