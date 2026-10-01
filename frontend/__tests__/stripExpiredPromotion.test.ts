import { stripExpiredPromotion, resolveProductPromotion } from "@/lib/promotions/productPromotion";

const now = Date.parse("2026-09-30T10:00:00Z");
const past = new Date(now - 60_000).toISOString();
const future = new Date(now + 6 * 86_400_000).toISOString();

describe("stripExpiredPromotion", () => {
  const sale = {
    price: 4512000, oldPrice: 4800000, compareAtPrice: 4800000, discount: 6,
    isSpecialOffer: true, campaignLabel: "تخفیفات پاییزه", campaignTheme: "green-orange",
  };

  it("removes label, theme, flags, discount and struck-through price once the Sale countdown ended, and restores the pre-discount price", () => {
    const stale = { ...sale, specialOfferEndTime: past };
    const clean = stripExpiredPromotion(stale, now);
    expect(clean.campaignLabel).toBeUndefined();
    expect(clean.campaignTheme).toBeUndefined();
    expect(clean.isSpecialOffer).toBe(false);
    expect(clean.discount).toBe(0);
    expect(clean.oldPrice).toBeUndefined();
    expect(clean.compareAtPrice).toBeUndefined();
    expect(clean.price).toBe(4800000);
  });

  it("returns the same reference while the promotion is still live", () => {
    const live = { ...sale, specialOfferEndTime: future };
    expect(stripExpiredPromotion(live, now)).toBe(live);
  });

  it("cleans an expired flash deal", () => {
    const flash = { price: 800, oldPrice: 1000, discount: 20, isFlashDeal: true, flashDealEndTime: past, campaignLabel: "پیشنهاد لحظه‌ای" };
    expect(stripExpiredPromotion(flash, now).price).toBe(1000);
    expect(stripExpiredPromotion(flash, now).campaignLabel).toBeUndefined();
  });

  it("keeps a label-only campaign (no flags, no end time): resolveProductPromotion treats it as active by design", () => {
    const labelOnly = { price: 4800000, campaignLabel: "تخفیفات پاییزه" };
    expect(stripExpiredPromotion(labelOnly, now)).toBe(labelOnly);
  });

  it("does not touch an ordinary discounted product without timer flags or campaign metadata", () => {
    const plain = { price: 900, oldPrice: 1000, discount: 10 };
    expect(stripExpiredPromotion(plain, now)).toBe(plain);
  });

  it("is consistent with resolveProductPromotion: a cleaned product resolves to kind none", () => {
    const clean = stripExpiredPromotion({ ...sale, specialOfferEndTime: past }, now);
    expect(resolveProductPromotion(clean, now).kind).toBe("none");
  });
});
