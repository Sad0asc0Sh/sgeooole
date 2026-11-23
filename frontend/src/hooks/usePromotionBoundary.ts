"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getNextPromotionExpiry, type ProductPromotionInput } from "@/lib/promotions/productPromotion";
import { getServerNow } from "@/lib/serverClock";

const subscribeToHydration = () => () => {};
const browserReady = () => true;
const serverRendering = () => false;

export function usePromotionBoundary(products: ProductPromotionInput[], onBoundary?: () => void, initialNow?: number) {
  const [now, setNow] = useState(() => getServerNow());
  const hydrated = useSyncExternalStore(subscribeToHydration, browserReady, serverRendering);

  useEffect(() => {
    const currentTime = getServerNow();
    const expiries = products
      .map((product) => getNextPromotionExpiry(product, currentTime))
      .filter((expiry): expiry is number => expiry !== null);
    if (!expiries.length) return;

    // Browser timers cannot represent delays greater than a signed 32-bit integer.
    const delay = Math.min(Math.max(0, Math.min(...expiries) - currentTime) + 50, 2_147_483_647);
    const timer = window.setTimeout(() => {
      setNow(getServerNow());
      onBoundary?.();
    }, delay);
    return () => window.clearTimeout(timer);
    // onBoundary is intentionally excluded: callers pass inline closures and must not
    // reschedule the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, now]);

  return !hydrated && initialNow !== undefined ? initialNow : Math.max(now, getServerNow());
}
