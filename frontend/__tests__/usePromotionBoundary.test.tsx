import { act, renderHook } from "@testing-library/react";
import { usePromotionBoundary } from "@/hooks/usePromotionBoundary";
import { resolveProductPromotion, type ProductPromotionInput } from "@/lib/promotions/productPromotion";

describe("usePromotionBoundary", () => {
  const start = Date.parse("2026-09-17T10:00:00Z");
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(start); });
  afterEach(() => { jest.useRealTimers(); });

  it("updates at each successive expiry without ticking the entire rail each second", () => {
    const products: ProductPromotionInput[] = [1, 2].map((seconds) => ({
      price: 800, oldPrice: 1000, discount: 20, isSpecialOffer: true,
      specialOfferEndTime: new Date(start + seconds * 1000).toISOString(),
    }));
    const { result } = renderHook(() => usePromotionBoundary(products));
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe(start);
    act(() => { jest.advanceTimersByTime(551); });
    expect(resolveProductPromotion(products[0], result.current).displayPrice).toBe(1000);
    expect(resolveProductPromotion(products[1], result.current).displayPrice).toBe(800);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(resolveProductPromotion(products[1], result.current).displayPrice).toBe(1000);
  });

  it("cleans up its timer on unmount and safely handles long promotions", () => {
    const products = [{ price: 100, isFlashDeal: true, flashDealEndTime: new Date(start + 90 * 86400000).toISOString() }];
    const { result, unmount } = renderHook(() => usePromotionBoundary(products));
    act(() => { jest.advanceTimersByTime(10000); });
    expect(result.current).toBe(start);
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
