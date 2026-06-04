"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

const SCROLL_POSITION_PREFIX = "ekgkala:category-scroll:";

const getScrollKey = (category: string | null) =>
  `${SCROLL_POSITION_PREFIX}${category || "all"}`;

/**
 * Small production-safe example for preserving list scroll per category.
 *
 * This file is included by Next/TypeScript during production builds, so every
 * React hook used here must be imported explicitly. Keeping this example typed
 * prevents hidden documentation/example code from breaking VPS builds.
 */
export function CategoryScrollRestorationExample() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const previousCategory = useRef<string | null>(null);

  useEffect(() => {
    const shouldRestore = category === previousCategory.current;
    previousCategory.current = category;

    if (!shouldRestore || typeof window === "undefined") return;

    const savedPosition = Number(sessionStorage.getItem(getScrollKey(category)) || 0);
    if (Number.isFinite(savedPosition) && savedPosition > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: savedPosition }));
    }
  }, [category]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saveScrollPosition = () => {
      sessionStorage.setItem(getScrollKey(category), String(window.scrollY));
    };

    window.addEventListener("pagehide", saveScrollPosition);
    return () => window.removeEventListener("pagehide", saveScrollPosition);
  }, [category]);

  return null;
}
