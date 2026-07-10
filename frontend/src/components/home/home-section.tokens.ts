export type HomeSectionVariant =
  | "hero"
  | "promotion"
  | "discovery"
  | "products"
  | "trust";

type HomeSectionContainerStrategy = "none" | "page" | "wide";
type HomeSectionBackgroundStrategy = "none" | "soft" | "surface";

type HomeSectionLayoutToken = {
  /** Vertical rhythm owned by the homepage layout system. */
  spacingClassName: string;
  /** Reserved home-page container strategy; Phase 2.1 keeps existing component containers intact. */
  containerStrategy: HomeSectionContainerStrategy;
  /** Reserved background transition strategy; Phase 2.1 does not introduce visual color changes. */
  backgroundStrategy: HomeSectionBackgroundStrategy;
};

export const HOME_SECTION_LAYOUT_TOKENS: Record<HomeSectionVariant, HomeSectionLayoutToken> = {
  hero: {
    spacingClassName: "pt-0 pb-2 md:pb-3",
    containerStrategy: "none",
    backgroundStrategy: "none",
  },
  promotion: {
    spacingClassName: "py-1 md:py-2",
    containerStrategy: "none",
    backgroundStrategy: "none",
  },
  discovery: {
    spacingClassName: "py-0.5 md:py-1",
    containerStrategy: "none",
    backgroundStrategy: "none",
  },
  products: {
    spacingClassName: "py-1 md:py-2",
    containerStrategy: "none",
    backgroundStrategy: "none",
  },
  trust: {
    spacingClassName: "pt-2 pb-0 md:pt-4 md:pb-0",
    containerStrategy: "none",
    backgroundStrategy: "none",
  },
};

export const HOME_SECTION_CONTAINER_TOKENS: Record<HomeSectionContainerStrategy, string> = {
  none: "",
  page: "mx-auto w-full max-w-7xl px-4",
  wide: "mx-auto w-full max-w-screen-2xl px-4",
};

export const HOME_SECTION_BACKGROUND_TOKENS: Record<HomeSectionBackgroundStrategy, string> = {
  none: "",
  soft: "",
  surface: "",
};
