import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FlashOfferRail from "@/components/home/FlashOfferRail";
import SpecialOfferRail from "@/components/home/SpecialOfferRail";
import { useFlashDeals, useSpecialOffers } from "@/hooks/useProducts";
import type { Product } from "@/types/product";

jest.mock("@/hooks/useProducts", () => ({
  useFlashDeals: jest.fn(),
  useSpecialOffers: jest.fn(),
}));
jest.mock("@/lib/scroll/ScrollManager", () => ({
  getScrollManager: () => ({ getHorizontal: () => 0, saveHorizontal: jest.fn() }),
}));
jest.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div data-testid="carousel">{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("swiper/modules", () => ({ Navigation: {} }));

const now = Date.parse("2026-09-17T10:00:00Z");
const future = new Date(now + 3_600_000).toISOString();

// محصول متغیر rail-shaped: ارزان‌ترین مدل مستثنی (پایه ۷۰۰٬۰۰۰)،
// ارزان‌ترین مدل تخفیف‌دار ۸۰۰٬۰۰۰ با مبنای ۱٬۰۰۰٬۰۰۰.
const variableProduct = (extra: Partial<Product> = {}): Product => ({
  id: "var1",
  name: "محصول متغیر",
  title: "محصول متغیر",
  image: "/placeholder.png",
  images: ["/placeholder.png"],
  category: "c",
  rating: 0,
  reviewCount: 0,
  countInStock: 10,
  price: 700000,
  discount: 20,
  productType: "variable",
  variants: [
    { id: "cheap", price: 700000, stock: 5, options: [], excludeFromPromotion: true as const },
    { id: "a", price: 800000, oldPrice: 1000000, stock: 5, options: [] },
  ],
  ...extra,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe("ریل‌های صفحه اصلی با محصول متغیر جزئی", () => {
  test("ریل لحظه‌ای: نماینده ارزان‌ترین تخفیف‌دار + چیپ و «از»", () => {
    jest.mocked(useFlashDeals).mockReturnValue({
      flashDeals: [variableProduct({ isFlashDeal: true, flashDealEndTime: future })],
      isLoading: false,
      isValidating: false,
      error: undefined,
      refresh: jest.fn(),
    } as any);

    const { container } = render(<FlashOfferRail />);

    // نماینده در context=promo مدل تخفیف‌دار است، نه قیمت پایه‌ی مستثنی
    expect(screen.getByText((800000).toLocaleString("fa-IR"))).toBeInTheDocument();
    expect(screen.queryByText((700000).toLocaleString("fa-IR"))).not.toBeInTheDocument();
    expect(container.querySelector(".line-through")).toHaveTextContent(
      (1000000).toLocaleString("fa-IR"),
    );
    expect(screen.getByText("۲۰٪")).toBeInTheDocument();
    expect(screen.getByText("از")).toBeInTheDocument();
    expect(screen.getByText("تخفیف روی چند مدل")).toBeInTheDocument();
  });

  test("ریل لحظه‌ای: محصولی که همه‌ی مدل‌هایش مستثنی است حذف می‌شود", () => {
    jest.mocked(useFlashDeals).mockReturnValue({
      flashDeals: [
        variableProduct({
          isFlashDeal: true,
          flashDealEndTime: future,
          variants: [
            { id: "a", price: 700000, stock: 5, options: [], excludeFromPromotion: true as const },
          ],
        }),
      ],
      isLoading: false,
      isValidating: false,
      error: undefined,
      refresh: jest.fn(),
    } as any);

    const { container } = render(<FlashOfferRail />);

    expect(container.firstChild).toBeNull();
  });

  test("ریل شگفت‌انگیز: نماینده ارزان‌ترین تخفیف‌دار + چیپ و «از»", () => {
    jest.mocked(useSpecialOffers).mockReturnValue({
      specialOffers: [variableProduct({ isSpecialOffer: true, specialOfferEndTime: future })],
      isLoading: false,
      isValidating: false,
      error: undefined,
      refresh: jest.fn(),
    } as any);

    const { container } = render(<SpecialOfferRail />);

    expect(screen.getByText((800000).toLocaleString("fa-IR")).closest("[aria-label]")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("شروع از"),
    );
    expect(container.querySelector(".line-through")).toHaveTextContent(
      (1000000).toLocaleString("fa-IR"),
    );
    expect(screen.getByText("از")).toBeInTheDocument();
    expect(screen.getByText("تخفیف روی چند مدل")).toBeInTheDocument();
  });

  test("ریل شگفت‌انگیز: محصولی که همه‌ی مدل‌هایش مستثنی است حذف می‌شود", () => {
    jest.mocked(useSpecialOffers).mockReturnValue({
      specialOffers: [
        variableProduct({
          isSpecialOffer: true,
          specialOfferEndTime: future,
          variants: [
            { id: "a", price: 700000, stock: 5, options: [], excludeFromPromotion: true as const },
          ],
        }),
      ],
      isLoading: false,
      isValidating: false,
      error: undefined,
      refresh: jest.fn(),
    } as any);

    const { container } = render(<SpecialOfferRail />);

    expect(container.firstChild).toBeNull();
  });
});
