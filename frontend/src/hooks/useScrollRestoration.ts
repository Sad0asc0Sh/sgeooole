"use client";

import { useCallback, useEffect } from "react";
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
  ready = false,
}: ScrollRestorationOptions = {}): ScrollRestorationControls {
  const saveScroll = useCallback(() => {
    if (key && typeof window !== "undefined") {
      getScrollManager().save(key);
    }
  }, [key]);

  const restoreScroll = useCallback(async () => {
    if (key && typeof window !== "undefined") {
      getScrollManager().restore(key);
    }
  }, [key]);

  const clearScroll = useCallback(() => {
    if (key && typeof window !== "undefined") {
      getScrollManager().clear(key);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled || !restoreOnMount || !ready || !key || typeof window === "undefined") return;

    const manager = getScrollManager();
    const savedY = manager.getSavedY(key);
    if (typeof savedY === "number" && savedY > 0) {
      manager.restore(key);
      return;
    }

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [enabled, key, ready, restoreOnMount]);

  return { saveScroll, restoreScroll, clearScroll };
}

export function useDisableScrollRestoration() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);
}
