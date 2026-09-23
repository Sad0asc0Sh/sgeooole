import { resolvePricing } from "@/lib/pricing";

describe("resolvePricing", () => {
  test("removes discount when special offer expires", () => {
    const now = Date.parse("2025-01-01T00:00:00.000Z");
    const past = "2024-12-31T23:59:00.000Z";

    const pricing = resolvePricing({
      price: 100000,
      compareAtPrice: 100000,
      discount: 20,
      isSpecialOffer: true,
      specialOfferEndTime: past,
      now,
    });

    expect(pricing.discount).toBe(0);
    expect(pricing.finalPrice).toBe(100000);
    expect(pricing.oldPrice).toBeUndefined();
  });

  test("keeps discount when special offer is active", () => {
    const now = Date.parse("2025-01-01T00:00:00.000Z");
    const future = "2025-01-01T00:01:00.000Z";

    const pricing = resolvePricing({
      price: 100000,
      compareAtPrice: 100000,
      discount: 20,
      isSpecialOffer: true,
      specialOfferEndTime: future,
      now,
    });

    expect(pricing.discount).toBe(20);
    expect(pricing.finalPrice).toBe(80000);
    expect(pricing.oldPrice).toBe(100000);
  });

  test("removes discount when flash deal expires", () => {
    const now = Date.parse("2025-01-01T00:00:00.000Z");
    const past = "2024-12-31T23:59:00.000Z";

    const pricing = resolvePricing({
      price: 50000,
      compareAtPrice: 50000,
      discount: 30,
      isFlashDeal: true,
      flashDealEndTime: past,
      now,
    });

    expect(pricing.discount).toBe(0);
    expect(pricing.finalPrice).toBe(50000);
    expect(pricing.oldPrice).toBeUndefined();
  });

  test("does NOT invent discount from stale compareAtPrice gap (discount=0)", () => {
    // Regression: price=100k with stale compareAtPrice=500k must NOT show 80% off.
    const pricing = resolvePricing({
      price: 100000,
      compareAtPrice: 500000,
      discount: 0,
      now: Date.parse("2025-01-01T00:00:00.000Z"),
    });

    expect(pricing.discount).toBe(0);
    expect(pricing.finalPrice).toBe(100000);
    expect(pricing.oldPrice).toBeUndefined();
    expect(pricing.hasActivePromotion).toBe(false);
  });
});

