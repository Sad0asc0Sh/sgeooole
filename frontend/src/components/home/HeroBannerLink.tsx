"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { resolveNavigateTarget } from "@/lib/navigateHref";
import type { Banner } from "@/services/bannerService";

type HeroBannerLinkProps = {
  banner: Banner;
  children: ReactNode;
  className?: string;
  /** کلون‌های حلقهٔ اسلایدر از دسترس صفحه‌کلید خارج می‌شوند. */
  tabIndex?: number;
};

/**
 * کل اسلاید/بنر را به یک لینک واقعی (و نه div قابل کلیک) تبدیل می‌کند.
 * لینک‌های خارجی با rel امن و لینک‌های داخلی با next/link باز می‌شوند.
 */
export default function HeroBannerLink({
  banner,
  children,
  className = "absolute inset-0 block h-full w-full",
  tabIndex,
}: HeroBannerLinkProps) {
  const target = resolveNavigateTarget(banner.link);
  const label = banner.alt || banner.title || "بنر اصلی";

  if (target.kind === "internal") {
    return (
      <Link
        href={target.href}
        className={className}
        target={banner.openInNewTab ? "_blank" : undefined}
        rel={banner.openInNewTab ? "noopener noreferrer" : undefined}
        aria-label={label}
        tabIndex={tabIndex}
      >
        {children}
      </Link>
    );
  }

  if (target.kind === "external") {
    return (
      <a
        href={target.href}
        className={className}
        target={banner.openInNewTab ? "_blank" : "_self"}
        rel={banner.openInNewTab ? "noopener noreferrer" : undefined}
        aria-label={label}
        tabIndex={tabIndex}
      >
        {children}
      </a>
    );
  }

  return (
    <div className={className} aria-label={label}>
      {children}
    </div>
  );
}
