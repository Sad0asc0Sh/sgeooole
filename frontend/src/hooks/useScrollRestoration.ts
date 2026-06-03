"use client";

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getScrollManager } from '@/lib/scroll/ScrollManager';

interface UseScrollRestorationOptions {
  enabled?: boolean;
  restoreOnMount?: boolean;
  saveOnScroll?: boolean;
  observeLayoutShifts?: boolean;
  key?: string;
}

/**
 * Hook to manage scroll restoration for a page
 * Automatically saves scroll position and restores on back navigation
 */
export function useScrollRestoration(options: UseScrollRestorationOptions = {}) {
  const {
    enabled = true,
    restoreOnMount = true,
    saveOnScroll = true,
    observeLayoutShifts = true,
    key: customKey,
  } = options;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollManager = getScrollManager();
  const hasRestoredRef = useRef(false);
  const scrollListenerRef = useRef<(() => void) | null>(null);

  // Generate unique key for this page
  const scrollKey = customKey || `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  /**
   * Save current scroll position
   */
  const saveScroll = useCallback(() => {
    if (enabled) {
      scrollManager.saveScrollPosition(scrollKey);
    }
  }, [enabled, scrollKey, scrollManager]);

  /**
   * Restore scroll position
   */
  const restoreScroll = useCallback(async () => {
    if (enabled && !hasRestoredRef.current) {
      const restored = await scrollManager.restoreScrollPosition(scrollKey);
      if (restored) {
        hasRestoredRef.current = true;
        
        // Observe layout shifts after restore
        if (observeLayoutShifts) {
          scrollManager.observeLayoutShifts(scrollKey);
        }
      }
    }
  }, [enabled, scrollKey, scrollManager, observeLayoutShifts]);

  /**
   * Clear saved scroll position
   */
  const clearScroll = useCallback(() => {
    scrollManager.clearScrollPosition(scrollKey);
    hasRestoredRef.current = false;
  }, [scrollKey, scrollManager]);

  /**
   * Manually trigger scroll save
   */
  const manualSave = useCallback(() => {
    saveScroll();
  }, [saveScroll]);

  /**
   * Manually trigger scroll restore
   */
  const manualRestore = useCallback(async () => {
    hasRestoredRef.current = false;
    await restoreScroll();
  }, [restoreScroll]);

  // Setup scroll listener to save position
  useEffect(() => {
    if (!enabled || !saveOnScroll) return;

    const handleScroll = () => {
      saveScroll();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    scrollListenerRef.current = handleScroll;

    return () => {
      window.removeEventListener('scroll', handleScroll);
      scrollListenerRef.current = null;
    };
  }, [enabled, saveOnScroll, saveScroll]);

  // Restore scroll on mount
  useEffect(() => {
    if (enabled && restoreOnMount) {
      // Use setTimeout to ensure DOM is fully ready
      const timer = setTimeout(() => {
        restoreScroll();
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [enabled, restoreOnMount, restoreScroll]);

  // Save scroll position before navigation
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      saveScroll();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save on unmount (navigation)
      saveScroll();
      // Stop observing
      scrollManager.stopObserving();
    };
  }, [enabled, saveScroll, scrollManager]);

  // Reset restoration flag when key changes
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [scrollKey]);

  return {
    saveScroll: manualSave,
    restoreScroll: manualRestore,
    clearScroll,
    scrollKey,
  };
}

/**
 * Hook to disable scroll restoration temporarily
 * Useful for pages that should always start at top (e.g., search results)
 */
export function useDisableScrollRestoration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      const original = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';

      return () => {
        window.history.scrollRestoration = original;
      };
    }
  }, []);
}
