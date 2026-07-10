import type { ReactNode } from "react";
import {
  HOME_SECTION_BACKGROUND_TOKENS,
  HOME_SECTION_CONTAINER_TOKENS,
  HOME_SECTION_LAYOUT_TOKENS,
  type HomeSectionVariant,
} from "./home-section.tokens";

type HomeSectionProps = {
  variant: HomeSectionVariant;
  children: ReactNode;
};

export default function HomeSection({ variant, children }: HomeSectionProps) {
  const token = HOME_SECTION_LAYOUT_TOKENS[variant];
  const backgroundClassName = HOME_SECTION_BACKGROUND_TOKENS[token.backgroundStrategy];
  const containerClassName = HOME_SECTION_CONTAINER_TOKENS[token.containerStrategy];

  return (
    <div
      data-home-section={variant}
      className={[
        "w-full empty:hidden",
        token.spacingClassName,
        backgroundClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {containerClassName ? (
        <div className={containerClassName}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
