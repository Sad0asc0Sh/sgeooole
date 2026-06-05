"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

type ScrollRestorationOptions = {
  enabled?: boolean;
  key?: string;
  restoreOnMount?: boolean;
  saveOnScroll?: boolean;
  observeLayoutShifts?: boolean;
};

type ScrollRestorationControls = {
  saveScroll: () => void;
  restoreScroll: () => Promise<void>;
  clearScroll: () => void;
};

const STORAGE_PREFIX = "ekgkala:scroll-restoration:";
const DEFAULT_RESTORE_DELAY_MS = 50;

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

const getScrollY = () => {
  if (typeof window === "undefined") return 0;
  return window.scrollY || window.pageYOffset || 0;
};

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });

export function useScrollRestoration({
  enabled = true,
  key,
  restoreOnMount = true,
  saveOnScroll = true,
  observeLayoutShifts = false,
}: ScrollRestorationOptions = {}): ScrollRestorationControls {
  const pathname = usePathname();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}${key || pathname || "default"}`,
    [key, pathname],
  );

  const saveScroll = useCallback(() => {
    if (!enabled) return;
    const storage = getStorage();
    if (!storage) return;

    storage.setItem(
      storageKey,
      JSON.stringify({
        y: getScrollY(),
        savedAt: Date.now(),
      }),
    );
  }, [enabled, storageKey]);

  const restoreScroll = useCallback(async () => {
    if (!enabled || typeof window === "undefined") return;

    const storage = getStorage();
    const rawValue = storage?.getItem(storageKey);
    if (!rawValue) return;

    try {
      const value = JSON.parse(rawValue) as { y?: unknown };
      const y = Number(value.y);
      if (!Number.isFinite(y) || y < 0) return;

      await waitForNextFrame();
      window.scrollTo({ top: y, behavior: "auto" });

      if (observeLayoutShifts) {
        window.setTimeout(
          () => window.scrollTo({ top: y, behavior: "auto" }),
          DEFAULT_RESTORE_DELAY_MS,
        );
      }
    } catch {
      storage?.removeItem(storageKey);
    }
  }, [enabled, observeLayoutShifts, storageKey]);

  const clearScroll = useCallback(() => {
    getStorage()?.removeItem(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !restoreOnMount) return;
    void restoreScroll();
  }, [enabled, restoreOnMount, restoreScroll]);

  useEffect(() => {
    if (!enabled || !saveOnScroll || typeof window === "undefined") return;

    const handleScroll = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(saveScroll, 150);
    };

    const handlePageHide = () => saveScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [enabled, saveOnScroll, saveScroll]);

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
