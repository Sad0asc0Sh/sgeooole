/**
 * قرارداد end-to-end کارت‌های ریل صفحه اصلی:
 * خروجی شکل‌پایپ‌لاین بک‌اند (featured) و شکل جدید /bestsellers (با variants)
 * باید بعد از mapper به قیمت کارت درست در هر دو context برسد.
 */
import api from "@/lib/api";
import { productService } from "@/services/productService";
import { mapBackendProduct } from "@/lib/productData";
import { resolveCardPricing } from "@/lib/promotions/variantCardPricing";
import type { Product } from "@/types/product";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
const mockedApi = api as unknown as { get: jest.Mock };

const future = "2099-01-01T00:00:00.000Z";

// خروجی pipeline لیست برای محصول متغیر جزئی (ارزان‌ترین مدل مستثنی است)
const featuredPayload = {
  _id: "var1",
  name: "دوربین متغیر",
  slug: "var1",
  productType: "variable",
  price: 700000,
  compareAtPrice: null,
  discount: 20,
  stock: 10,
  images: ["/uploads/a.png"],
  isSpecialOffer: true,
  specialOfferEndTime: future,
  variants: [
    { _id: "cheap", price: 700000, compareAtPrice: null, stock: 5, options: [], images: [], excludeFromPromotion: true },
    { _id: "a", price: 800000, compareAtPrice: 1000000, stock: 5, options: [], images: [] },
  ],
};

describe("rail pricing contract", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
  });

  test("featured variable: listing «از ۷۰۰٬۰۰۰» بدون بج + promo نماینده‌ی تخفیف‌دار", async () => {
    mockedApi.get.mockResolvedValue({ data: { success: true, data: featuredPayload } });
    const product = await productService.getById("var1");

    const listing = resolveCardPricing(product, { context: "listing" });
    expect(listing.displayPrice).toBe(700000);
    expect(listing.originalPrice).toBeUndefined();
    expect(listing.discountPercent).toBe(0);
    expect(listing.isFrom).toBe(true);
    expect(listing.isPartial).toBe(true);
    expect(listing.hasDiscountedVariant).toBe(true);

    const promo = resolveCardPricing(product, { context: "promo" });
    expect(promo.displayPrice).toBe(800000);
    expect(promo.originalPrice).toBe(1000000);
    expect(promo.discountPercent).toBe(20);
    expect(promo.isFrom).toBe(true);
    expect(promo.isPartial).toBe(true);
  });

  test("bestsellers variable (شکل جدید با variants): قیمت هر مدل درست مپ می‌شود", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: "var2",
            name: "متغیر پرفروش",
            slug: "var2",
            image: "/uploads/a.png",
            price: 700000,
            discount: 20,
            compareAtPrice: undefined,
            isSpecialOffer: true,
            specialOfferEndTime: future,
            productType: "variable",
            variants: [
              { _id: "cheap", price: 700000, stock: 5, options: [], images: [], excludeFromPromotion: true },
              { _id: "a", price: 800000, compareAtPrice: 1000000, stock: 5, options: [], images: [] },
            ],
            stock: 10,
            average_rating: 4,
            review_count: 3,
          },
        ],
      },
    });

    const [product] = await productService.getBestSellers(1);

    expect(product.productType).toBe("variable");
    expect(product.variants![0].price).toBe(700000);
    expect(product.variants![0].oldPrice).toBeUndefined();
    expect(product.variants![1].price).toBe(800000);
    expect(product.variants![1].oldPrice).toBe(1000000);

    // کارت ریل پرفروش‌ترین‌ها (listing): قیمت واقعی ارزان‌ترین موجود، بدون بج فانتوم
    const listing = resolveCardPricing(product, { context: "listing" });
    expect(listing.displayPrice).toBe(700000);
    expect(listing.originalPrice).toBeUndefined();
    expect(listing.isFrom).toBe(true);
    expect(listing.isPartial).toBe(true);
  });

  test("SSR mapper با همان payload سازگار است", () => {
    const product = mapBackendProduct(featuredPayload as any, "http://127.0.0.1:5000/api") as Product;

    expect(product.productType).toBe("variable");
    expect(product.price).toBe(700000);
    const promo = resolveCardPricing(product, { context: "promo" });
    expect(promo.displayPrice).toBe(800000);
    expect(promo.originalPrice).toBe(1000000);
  });
});
