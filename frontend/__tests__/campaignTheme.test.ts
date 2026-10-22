import {
  getPromotionThemeScheme,
  resolveCampaignThemeVariant,
  promotionPillClass,
} from "@/lib/campaignTheme";

/**
 * A «پیشنهاد لحظه‌ای» must look the same on the product card and on the product
 * page. The backend stores `campaignTheme = "gold-red"` on live flash deals
 * (pricingService FLASH_THEME / productListingService), so the resolver has to
 * key off the promotion kind — not the stored theme — or the detail page paints
 * a gold banner/pill while the card stripe stays amber→orange→red.
 */
describe("campaignTheme — promotion scheme resolution", () => {
    test("flash deal keeps the timed gradient even with the stored gold-red theme", () => {
        const scheme = getPromotionThemeScheme("flash", "gold-red");

        expect(scheme.pill).toBe("bg-kala-timed-gradient");
        expect(scheme.stripe).toBe("bg-kala-timed-gradient");
        expect(scheme.banner).toContain("bg-kala-timed-gradient");
        expect(scheme.banner).toContain("text-white");
        expect(scheme.pillStyle).toBe("linear-gradient(to right, #ffb900, #ff6900, #e7000b)");
        // The gold campaign wash must not leak into a flash deal.
        expect(scheme.banner).not.toContain("bg-yellow-50");
        expect(scheme.pill).not.toContain("bg-kala-gold-gradient");
    });

    test("a named campaign still uses the merchant-picked theme", () => {
        const gold = getPromotionThemeScheme("campaign", "gold-red");

        expect(gold.pill).toContain("bg-kala-gold-gradient");
        expect(gold.banner).toBe("bg-yellow-50 text-yellow-800");
        expect(gold.text).toBe("text-yellow-700");
    });

    test("«شگفت‌انگیز» keeps the red treatment on every surface", () => {
        const scheme = getPromotionThemeScheme("amazing", null);

        expect(scheme.pill).toBe("bg-red-500");
        expect(scheme.banner).toBe("bg-red-50 text-red-600");
        expect(scheme.text).toBe("text-red-500");
    });

    test("unknown/absent themes fall back to the blue campaign scheme", () => {
        expect(getPromotionThemeScheme("none", undefined).pill).toContain("from-blue-400");
        expect(resolveCampaignThemeVariant("green-orange")).toBe("spring");
        expect(resolveCampaignThemeVariant("red-purple")).toBe("fire");
    });

    test("helpers share one scheme per promotion kind", () => {
        expect(promotionPillClass("flash", "gold-red")).toBe(promotionPillClass("flash", null));
        expect(getPromotionThemeScheme("flash", "gold-red")).toBe(getPromotionThemeScheme("flash", undefined));
    });
});
