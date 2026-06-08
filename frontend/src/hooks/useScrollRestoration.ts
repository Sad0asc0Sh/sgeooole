"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getScrollManager } from "@/lib/scroll/ScrollManager";

type ScrollRestorationOptions = {
  enabled?: boolean;
  key?: string;
  restoreOnMount?: boolean;
  saveOnScroll?: boolean;
  observeLayoutShifts?: boolean;
  ready?: boolean;
};

type ScrollRestorationControls = {
  saveScroll: () => void;
  restoreScroll: () => Promise<void>;
  clearScroll: () => void;
};

export function useScrollRestoration({
  enabled = true,
  key,
  restoreOnMount = true,
  saveOnScroll = true,
  observeLayoutShifts = false,
  ready = true,
}: ScrollRestorationOptions = {}): ScrollRestorationControls {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasRestoredRef = useRef(false);
  const scrollKey = useMemo(() => {
    if (key) return key;
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname || "default";
  }, [key, pathname, searchParams]);

  const saveScroll = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;
    getScrollManager().saveScrollPositionImmediate(scrollKey);
  }, [enabled, scrollKey]);

  const restoreScroll = useCallback(async () => {
    if (!enabled || typeof window === "undefined") return;

    const restored = await getScrollManager().restoreScrollPosition(scrollKey);
    if (restored && observeLayoutShifts) {
      getScrollManager().observeLayoutShifts(scrollKey);
    }
  }, [enabled, observeLayoutShifts, scrollKey]);

  const clearScroll = useCallback(() => {
    getScrollManager().clearScrollPosition(scrollKey);
  }, [scrollKey]);

  useEffect(() => {
    hasRestoredRef.current = false;
  }, [scrollKey]);

  useEffect(() => {
    if (!enabled || !restoreOnMount || !ready || hasRestoredRef.current) return;

    hasRestoredRef.current = true;
    void restoreScroll();

    return () => {
      getScrollManager().stopObserving();
    };
  }, [enabled, ready, restoreOnMount, restoreScroll, scrollKey]);

  useEffect(() => {
    if (!enabled || !saveOnScroll || typeof window === "undefined") return;

    const manager = getScrollManager();
    const handleScroll = () => manager.saveScrollPosition(scrollKey);
    const handlePageHide = () => manager.saveScrollPositionImmediate(scrollKey);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        manager.saveScrollPositionImmediate(scrollKey);
      }
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      manager.saveScrollPositionImmediate(scrollKey);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", handleClick, true);
      manager.stopObserving();
    };
  }, [enabled, saveOnScroll, scrollKey]);

  return { saveScroll, restoreScroll, clearScroll };
}

export function useDisableScrollRestoration() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, behavior: "auto" });

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
}
