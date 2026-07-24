"use client";

import { useRef, useCallback } from "react";
import type { Swiper as SwiperClass } from "swiper";

/**
 * Hook for velocity-sensitive card-snap scrolling in Swiper.
 *
 * Usage: Pair with `shortSwipes={false}` and `longSwipes={false}` on Swiper.
 *
 * - Slow swipe → snaps to next/prev 1 card
 * - Fast swipe (> velocityThreshold px/ms) → snaps 2 cards at once
 */
export function useVelocitySnap(velocityThreshold = 0.5) {
  const touchStartX = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const touchStartIndex = useRef<number>(0);

  const onTouchStart = useCallback((swiper: SwiperClass) => {
    touchStartX.current = swiper.touches.startX;
    touchStartTime.current = performance.now();
    touchStartIndex.current = swiper.activeIndex;
  }, []);

  const onTouchEnd = useCallback(
    (swiper: SwiperClass) => {
      const deltaX = touchStartX.current - swiper.touches.currentX;
      const deltaTime = performance.now() - touchStartTime.current;

      // Ignore taps / tiny movements — let Swiper snap back naturally
      if (Math.abs(deltaX) < 15) return;

      const velocity = Math.abs(deltaX) / Math.max(deltaTime, 1); // px / ms

      // In RTL layouts Swiper reverses its translate; invert direction accordingly
      const rawDirection = deltaX > 0 ? 1 : -1;
      const direction = swiper.rtlTranslate ? -rawDirection : rawDirection;

      // Slow → 1 card, fast → 2 cards
      const cardsToAdvance = velocity > velocityThreshold ? 2 : 1;
      const targetIndex = touchStartIndex.current + direction * cardsToAdvance;
      const clampedTarget = Math.max(
        0,
        Math.min(swiper.slides.length - 1, targetIndex)
      );

      // rAF ensures our slideTo runs *after* Swiper's internal snap-back logic
      requestAnimationFrame(() => {
        swiper.slideTo(clampedTarget, 300);
      });
    },
    [velocityThreshold]
  );

  return { onTouchStart, onTouchEnd } as const;
}
