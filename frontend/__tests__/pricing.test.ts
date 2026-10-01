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

  const nowAfter = Date.parse("2026-09-30T10:31:00.000Z");
  const endedAt = "2026-09-30T10:30:00.000Z";
  const endsLater = "2026-09-30T11:30:00.000Z";

  test("regression: a discounted live snapshot mapped AFTER the flash ended restores the base price (card showed 970,000)", () => {
    // Server payload built while the flash deal was live: price already discounted, compareAtPrice = base.
    const pricing = resolvePricing({ price: 970000, compareAtPrice: 1000000, discount: 3, isFlashDeal: true, flashDealEndTime: endedAt, now: nowAfter });
    expect(pricing.discount).toBe(0);
    expect(pricing.finalPrice).toBe(1000000);
    expect(pricing.basePrice).toBe(1000000);
    expect(pricing.oldPrice).toBeUndefined();
    expect(pricing.hasActivePromotion).toBe(false);
  });

  test("the same snapshot while the flash deal is still live keeps the discounted price and struck-through base", () => {
    const pricing = resolvePricing({ price: 970000, compareAtPrice: 1000000, discount: 3, isFlashDeal: true, flashDealEndTime: endsLater, now: nowAfter });
    expect(pricing.finalPrice).toBe(970000);
    expect(pricing.oldPrice).toBe(1000000);
    expect(pricing.discount).toBe(3);
  });

  test("an expired payload from the server (price = base, discount 0) stays at the base price", () => {
    const pricing = resolvePricing({ price: 1000000, discount: 0, isFlashDeal: true, flashDealEndTime: endedAt, now: nowAfter });
    expect(pricing.finalPrice).toBe(1000000);
    expect(pricing.oldPrice).toBeUndefined();
  });

  test("a stale inflated compareAtPrice that does not match the stored discount never inflates an expired price", () => {
    const pricing = resolvePricing({ price: 4800000, compareAtPrice: 30000000, discount: 6, isFlashDeal: true, flashDealEndTime: endedAt, now: nowAfter });
    expect(pricing.finalPrice).toBe(4800000);
    expect(pricing.oldPrice).toBeUndefined();
  });
});

