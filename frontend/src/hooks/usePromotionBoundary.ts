"use client";

import { useEffect, useState } from "react";
import { getNextPromotionExpiry, type ProductPromotionInput } from "@/lib/promotions/productPromotion";

export function usePromotionBoundary(products: ProductPromotionInput[]) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const currentTime = Date.now();
    const expiries = products
      .map((product) => getNextPromotionExpiry(product, currentTime))
      .filter((expiry): expiry is number => expiry !== null);
    if (!expiries.length) return;

    // Browser timers cannot represent delays greater than a signed 32-bit integer.
    const delay = Math.min(Math.max(0, Math.min(...expiries) - currentTime) + 50, 2_147_483_647);
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [products, now]);

  return Math.max(now, Date.now());
}
