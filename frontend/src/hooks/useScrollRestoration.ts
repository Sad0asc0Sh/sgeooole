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
  key,
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

