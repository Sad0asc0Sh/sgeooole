import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { wishlistItemToProduct } from "@/lib/wishlistCard";
import { resolveCardPricing } from "@/lib/promotions/variantCardPricing";
import type { WishlistItem } from "@/services/wishlistService";
import ListsPage from "@/app/profile/lists/page";
import { wishlistService } from "@/services/wishlistService";

jest.mock("@/services/wishlistService", () => ({
  wishlistService: { getWishlist: jest.fn(), removeFromWishlist: jest.fn() },
}));
jest.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    addToCart: jest.fn(),
    updateQuantity: jest.fn(),
    removeFromCart: jest.fn(),
    getItemQuantity: () => 0,
  }),
}));
jest.mock("@/components/ui/ResilientImage", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const future = new Date(Date.now() + 3_600_000).toISOString();

const simpleOnSale: WishlistItem = {
  _id: "s1",
  name: "کالای ساده",
  price: 800000,
  compareAtPrice: 1000000,
  discount: 20,
  stock: 5,
  images: [{ url: "/a.png" }],
  isSpecialOffer: true,
  specialOfferEndTime: future,
};

// محصول متغیر جزئی: ارزان‌ترین مدل مستثنی (پایه‌ی ۷۰۰٬۰۰۰)
const partialVariable: WishlistItem = {
  _id: "v1",
  name: "کالای متغیر",
  price: 700000,
  discount: 20,
  stock: 10,
  images: [{ url: "/a.png" }],
  isSpecialOffer: true,
  specialOfferEndTime: future,
  productType: "variable",
  variants: [
    { _id: "cheap", price: 700000, stock: 5, options: [], images: [], excludeFromPromotion: true },
    { _id: "a", price: 800000, compareAtPrice: 1000000, stock: 5, options: [], images: [] },
  ],
};

describe("wishlistItemToProduct", () => {
  test("محصول ساده دقیقاً مثل قبل مپ می‌شود", () => {
    const card = wishlistItemToProduct(simpleOnSale);
    expect(card.productType).toBe("simple");
    expect(card.variants).toEqual([]);
    expect(card.price).toBe(800000);
    expect(card.oldPrice).toBe(1000000);
    const pricing = resolveCardPricing(card, { context: "listing" });
    expect(pricing.displayPrice).toBe(800000);
    expect(pricing.originalPrice).toBe(1000000);
    expect(pricing.discountPercent).toBe(20);
  });

  test("محصول متغیر جزئی: «از» + بدون بج + چیپ، با ارزان‌ترین موجود", () => {
    const card = wishlistItemToProduct(partialVariable);
    expect(card.productType).toBe("variable");
    expect(card.price).toBe(700000);
    expect(card.countInStock).toBe(10);
    const pricing = resolveCardPricing(card, { context: "listing" });
    expect(pricing.displayPrice).toBe(700000);
    expect(pricing.originalPrice).toBeUndefined();
    expect(pricing.discountPercent).toBe(0);
    expect(pricing.isFrom).toBe(true);
    expect(pricing.isPartial).toBe(true);
  });

  test("ورودی خراب کرش نمی‌کند", () => {
    expect(() =>
      wishlistItemToProduct({ _id: "x", name: "y", price: NaN, variants: [null] } as any),
    ).not.toThrow();
  });
});

describe("ListsPage card", () => {
  beforeEach(() => {
    jest.mocked(wishlistService.getWishlist).mockReset();
  });

  test("کارت متغیر جزئی: بج ندارد، «از» و چیپ دارد و قیمت نماینده را نشان می‌دهد", async () => {
    jest.mocked(wishlistService.getWishlist).mockResolvedValue([partialVariable]);

    const { container } = render(<ListsPage />);
    await waitFor(() => expect(screen.getByText("کالای متغیر")).toBeInTheDocument());

    // بج درصد نباید باشد (نماینده تخفیف ندارد) و del هم نیست
    expect(container.querySelector("del")).toBeNull();
    expect(screen.queryByText("۲۰٪")).not.toBeInTheDocument();
    expect(screen.queryByText("20%")).not.toBeInTheDocument();
    // «از» + قیمت پایه‌ی مدل مستثنی + چیپ
    expect(screen.getByText("از")).toBeInTheDocument();
    expect(screen.getByText((700000).toLocaleString("fa-IR"))).toBeInTheDocument();
    expect(screen.getByText("تخفیف روی چند مدل")).toBeInTheDocument();
  });

  test("کارت ساده‌ی تخفیف‌دار: بج فارسی + خط‌خورده، بدون سرریز", async () => {
    jest.mocked(wishlistService.getWishlist).mockResolvedValue([simpleOnSale]);

    const { container } = render(<ListsPage />);
    await waitFor(() => expect(screen.getByText("کالای ساده")).toBeInTheDocument());

    expect(screen.getByText("۲۰٪")).toBeInTheDocument();
    expect(container.querySelector("del")).toHaveTextContent((1000000).toLocaleString("fa-IR"));
    expect(screen.getByText((800000).toLocaleString("fa-IR"))).toBeInTheDocument();
    expect(screen.queryByText("از")).not.toBeInTheDocument();
  });
});
