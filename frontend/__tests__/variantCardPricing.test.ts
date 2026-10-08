import { resolveCardPricing } from "@/lib/promotions/variantCardPricing";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import type { Product, ProductVariant } from "@/types/product";

const future = new Date(Date.now() + 3_600_000).toISOString();
const past = new Date(Date.now() - 3_600_000).toISOString();

const base: Product = {
  id: "p1",
  name: "x",
  title: "x",
  image: "/a.png",
  images: ["/a.png"],
  category: "c",
  rating: 0,
  reviewCount: 0,
  countInStock: 10,
  price: 80_000,
  discount: 20,
  productType: "variable",
  isSpecialOffer: true,
  specialOfferEndTime: future,
} as Product;

const disc = (id: string, final: number, old: number, stock = 5): ProductVariant => ({
  id,
  price: final,
  oldPrice: old,
  stock,
  options: [],
});

const plain = (id: string, price: number, stock = 5): ProductVariant => ({
  id,
  price,
  stock,
  options: [],
  excludeFromPromotion: true as const,
});

describe("resolveCardPricing", () => {
  test("همه‌ی مدل‌ها تخفیف‌دار: هدر + درصد و خط‌خورده‌ی نماینده", () => {
    const p: Product = {
      ...base,
      variants: [disc("a", 80000, 100000), disc("b", 96000, 120000)],
    };
    const r = resolveCardPricing(p, { context: "listing" });
    expect(r.kind).toBe("amazing");
    expect(r.hasDiscountedVariant).toBe(true);
    expect(r.displayPrice).toBe(80000);
    expect(r.originalPrice).toBe(100000);
    expect(r.discountPercent).toBe(20);
    expect(r.isPartial).toBe(false);
  });

  test("نماینده مستثنی (ارزان‌ترین پایه): هدر هست ولی درصد و خط‌خورده نیست", () => {
    const p: Product = {
      ...base,
      variants: [plain("cheap", 70000), disc("a", 800000, 1000000), disc("c", 960000, 1200000)],
    };
    const r = resolveCardPricing(p, { context: "listing" });
    // حداقل یک مدل تخفیف دارد → هدر می‌ماند
    expect(r.kind).not.toBe("none");
    expect(r.hasDiscountedVariant).toBe(true);
    // نماینده ارزان‌ترین پایه است و خودش تخفیف ندارد
    expect(r.displayPrice).toBe(70000);
    expect(r.originalPrice).toBeUndefined();
    expect(r.discountPercent).toBe(0);
    expect(r.isPartial).toBe(true);
    expect(r.isFrom).toBe(true);
  });

  test("همه‌ی مدل‌ها مستثنی: کارت عادی بدون هدر", () => {
    const p: Product = {
      ...base,
      variants: [plain("a", 70000), plain("b", 90000)],
    };
    const r = resolveCardPricing(p, { context: "listing" });
    expect(r.kind).toBe("none");
    expect(r.endTime).toBeUndefined();
    expect(r.hasDiscountedVariant).toBe(false);
    expect(r.originalPrice).toBeUndefined();
    expect(r.discountPercent).toBe(0);
    expect(r.displayPrice).toBe(70000);
  });

  test("context=promo: نماینده ارزان‌ترین مدل تخفیف‌دار است", () => {
    const p: Product = {
      ...base,
      variants: [plain("cheap", 70000), disc("a", 800000, 1000000)],
    };
    const r = resolveCardPricing(p, { context: "promo" });
    expect(r.kind).not.toBe("none");
    expect(r.displayPrice).toBe(800000);
    expect(r.originalPrice).toBe(1000000);
    expect(r.discountPercent).toBe(20);
  });

  test("مدل‌های تخفیف‌دار ناموجود و مستثنی موجود: بدون هدر", () => {
    const p: Product = {
      ...base,
      variants: [disc("a", 80000, 100000, 0), plain("b", 70000, 5)],
    };
    const r = resolveCardPricing(p, { context: "listing" });
    // فقط مدل‌های موجود حساب می‌شوند
    expect(r.kind).toBe("none");
    expect(r.hasDiscountedVariant).toBe(false);
    expect(r.displayPrice).toBe(70000);
  });

  test("تایمر منقضی: بدون هدر و قیمت پایه‌ی مدل", () => {
    const p: Product = {
      ...base,
      specialOfferEndTime: past,
      variants: [disc("a", 80000, 100000)],
    };
    const r = resolveCardPricing(p, { context: "listing" });
    expect(r.kind).toBe("none");
    expect(r.displayPrice).toBe(100000);
    expect(r.originalPrice).toBeUndefined();
  });

  test("محصول ساده: خروجی با رفتار قبلی یکی است", () => {
    const p: Product = {
      ...base,
      productType: "simple",
      variants: [],
      price: 80000,
      oldPrice: 100000,
    };
    const promo = resolveProductPromotion(p);
    const r = resolveCardPricing(p, { context: "listing" });
    expect(r.kind).toBe(promo.kind);
    expect(r.endTime).toBe(promo.endTime);
    expect(r.displayPrice).toBe(promo.displayPrice);
    expect(r.originalPrice).toBe(100000);
    expect(r.discountPercent).toBe(promo.effectiveDiscount);
  });

  test("ورودی خراب کرش نمی‌کند", () => {
    const p = {
      ...base,
      variants: [null],
      price: NaN,
    } as unknown as Product;
    expect(() => resolveCardPricing(p)).not.toThrow();
  });
});
