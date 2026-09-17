"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CATEGORY_FILTER_HASH } from "@/lib/categoryNavigation";

export function useCategoryFilterNavigation(setShowFilters: Dispatch<SetStateAction<boolean>>) {
  const desktopCategoryRef = useRef<HTMLDivElement>(null);
  const [categoryFilterRequest, setCategoryFilterRequest] = useState(0);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    let frame = 0;
    const openCategoryFilters = () => {
      if (window.location.hash !== CATEGORY_FILTER_HASH) return;
      setCategoryFilterRequest((request) => request + 1);
      setShowFilters(!desktop.matches);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (desktop.matches) {
          desktopCategoryRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
          desktopCategoryRef.current?.focus({ preventScroll: true });
        }
      });
    };
    const handleResize = () => {
      if (desktop.matches) setShowFilters(false);
    };
    openCategoryFilters();
    window.addEventListener("hashchange", openCategoryFilters);
    desktop.addEventListener("change", handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openCategoryFilters);
      desktop.removeEventListener("change", handleResize);
    };
  }, [setShowFilters]);

  return { desktopCategoryRef, categoryFilterRequest };
}
