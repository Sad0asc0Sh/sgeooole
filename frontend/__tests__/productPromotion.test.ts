import {
  getNextPromotionExpiry,
  resolveProductPromotion,
} from "@/lib/promotions/productPromotion";

const now = Date.parse("2026-08-21T00:00:00.000Z");
const future = "2026-08-21T00:10:00.000Z";
const later = "2026-08-21T00:20:00.000Z";
const past = "2026-08-20T23:59:00.000Z";

const baseProduct = {
  price: 80000,
  oldPrice: 100000,
  discount: 20,
};

describe("resolveProductPromotion", () => {
  test("gives an active flash deal precedence over stale or concurrent campaign metadata", () => {
    const promotion = resolveProductPromotion(
      {
        ...baseProduct,
        isFlashDeal: true,
        flashDealEndTime: future,
        isSpecialOffer: true,
        specialOfferEndTime: later,
        campaignLabel: "جشنواره بهاری",
        campaignTheme: "lime-orange",
      },
      now,
    );

    expect(promotion.kind).toBe("flash");
    expect(promotion.endTime).toBe(future);
    expect(promotion.effectiveDiscount).toBe(20);
  });

  test("uses the named campaign after flash is absent", () => {
    const promotion = resolveProductPromotion(
      {
        ...baseProduct,
        isSpecialOffer: true,
        specialOfferEndTime: future,
        campaignLabel: "جشنواره آتیشی",
        campaignTheme: "fire",
      },
      now,
    );

    expect(promotion.kind).toBe("campaign");
    expect(promotion.endTime).toBe(future);
  });

  test("uses the amazing label only for an active special offer without campaign metadata", () => {
    const promotion = resolveProductPromotion(
      {
        ...baseProduct,
        isSpecialOffer: true,
        specialOfferEndTime: future,
      },
      now,
    );

    expect(promotion.kind).toBe("amazing");
    expect(promotion.effectiveDiscount).toBe(20);
  });

  test("does not turn an ordinary numeric discount into an amazing label", () => {
    const promotion = resolveProductPromotion(baseProduct, now);

    expect(promotion.kind).toBe("none");
    expect(promotion.effectiveDiscount).toBe(20);
    expect(promotion.displayPrice).toBe(80000);
  });

  test("removes expired special-offer campaign chrome and restores the original price", () => {
    const promotion = resolveProductPromotion(
      {
        ...baseProduct,
        isSpecialOffer: true,
        specialOfferEndTime: past,
        campaignLabel: "جشنواره بهاری",
      },
      now,
    );

    expect(promotion.kind).toBe("none");
    expect(promotion.effectiveDiscount).toBe(0);
    expect(promotion.displayPrice).toBe(100000);
  });
});

describe("getNextPromotionExpiry", () => {
  test("selects the earliest active promotion boundary", () => {
    const expiry = getNextPromotionExpiry(
      {
        isFlashDeal: true,
        flashDealEndTime: future,
        isSpecialOffer: true,
        specialOfferEndTime: later,
      },
      now,
    );

    expect(expiry).toBe(Date.parse(future));
  });

  test("ignores expired and invalid timers", () => {
    expect(
      getNextPromotionExpiry(
        {
          isFlashDeal: true,
          flashDealEndTime: past,
          isSpecialOffer: true,
          specialOfferEndTime: "not-a-date",
        },
        now,
      ),
    ).toBeNull();
  });
});
