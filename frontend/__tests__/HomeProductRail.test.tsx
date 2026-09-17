import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import HomeProductCard from "@/components/home/HomeProductCard";
import HomeProductRail from "@/components/home/HomeProductRail";
import SpecialOfferRail from "@/components/home/SpecialOfferRail";
import { useSpecialOffers } from "@/hooks/useProducts";
import type { Product } from "@/types/product";

jest.mock("@/components/ui/ResilientImage", () => ({ __esModule: true, default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
jest.mock("@/hooks/useProducts", () => ({ useSpecialOffers: jest.fn() }));
jest.mock("@/lib/scroll/ScrollManager", () => ({ getScrollManager: () => ({ getHorizontal: () => 0, saveHorizontal: jest.fn() }) }));
jest.mock("swiper/react", () => ({
  Swiper: ({ children, breakpointsBase, slidesPerView }: { children: React.ReactNode; breakpointsBase: string; slidesPerView: number }) => <div data-testid="carousel" data-breakpoints-base={breakpointsBase} data-slides-per-view={slidesPerView}>{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("swiper/modules", () => ({ A11y: {} }));

const now = Date.parse("2026-09-17T10:00:00Z");
const product: Product = { id: "one", name: "دوربین مداربسته", title: "دوربین مداربسته", price: 800000, oldPrice: 1000000, compareAtPrice: 1000000, discount: 20, image: "/placeholder.png", images: [], category: "camera", rating: 0, reviewCount: 0, countInStock: 5 };

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
afterEach(() => { jest.useRealTimers(); });

test("uses the shared product URL and correct comparison price", () => {
  const { container } = render(<HomeProductCard product={product} now={now} />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/product/one/one");
  expect(container.querySelector("del")).toHaveTextContent((1000000).toLocaleString("fa-IR"));
  expect(screen.getByText((800000).toLocaleString("fa-IR"))).toBeInTheDocument();
});

test("removes expired pricing and promotion labels", () => {
  const { container } = render(<HomeProductCard product={{ ...product, isFlashDeal: true, flashDealEndTime: new Date(now - 1000).toISOString() }} now={now} />);
  expect(container.querySelector("del")).toBeNull();
  expect(screen.queryByText("زمان‌دار")).not.toBeInTheDocument();
  expect(screen.getByText((1000000).toLocaleString("fa-IR"))).toBeInTheDocument();
});

test("does not advertise a purchasable price for an out-of-stock item", () => {
  render(<HomeProductCard product={{ ...product, countInStock: 0 }} now={now} />);
  expect(screen.queryByText((800000).toLocaleString("fa-IR"))).not.toBeInTheDocument();
  expect(screen.getAllByText("ناموجود").length).toBeGreaterThan(0);
});

test("uses container breakpoints, accessible navigation, and local retry", () => {
  const props = { title: "جدیدترین‌ها", description: "تازه‌ترین محصولات", products: [product], viewAllHref: "/products", railKey: "newest", now };
  const { rerender } = render(<HomeProductRail {...props} />);
  expect(screen.getByTestId("carousel")).toHaveAttribute("data-breakpoints-base", "container");
  expect(screen.getByTestId("carousel")).toHaveAttribute("data-slides-per-view", "2.3");
  expect(screen.getByRole("button", { name: "محصولات قبلی جدیدترین‌ها" })).toBeDisabled();
  const retry = jest.fn();
  rerender(<HomeProductRail {...props} error onRetry={retry} />);
  fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("preserves the original curated section expiry behavior", () => {
  jest.mocked(useSpecialOffers).mockReturnValue({
    specialOffers: [
      { ...product, isSpecialOffer: true, specialOfferEndTime: new Date(now + 1000).toISOString() },
      { ...product, id: "two", name: "دوربین دوم", isSpecialOffer: true, specialOfferEndTime: new Date(now + 2000).toISOString() },
    ], isLoading: false, isValidating: false, error: undefined, refresh: jest.fn(),
  });
  render(<SpecialOfferRail />);
  expect(screen.getByRole("heading", { name: product.name })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "دوربین دوم" })).toBeInTheDocument();
  expect(screen.getByTestId("carousel")).toHaveAttribute("data-slides-per-view", "2.3");
  act(() => { jest.advanceTimersByTime(1100); });
  expect(screen.queryByRole("heading", { name: "پیشنهادهای منتخب" })).not.toBeInTheDocument();
});
