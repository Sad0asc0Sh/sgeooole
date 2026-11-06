import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductDetailClient from "@/app/product/[...segments]/ProductDetailClient";
import type { Product } from "@/services/productService";

jest.mock("@/providers/LayoutStateProvider", () => ({
  useLayoutState: () => ({ setIsProductPage: jest.fn() }),
}));

jest.mock("@/hooks/useScrollRestoration", () => ({
  useDisableScrollRestoration: jest.fn(),
}));

jest.mock("@/services/productService", () => ({
  productService: {
    getById: jest.fn().mockImplementation(() => Promise.resolve(null)),
  },
}));

jest.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    cartItems: [],
    addToCart: jest.fn(),
    updateQuantity: jest.fn(),
    removeFromCart: jest.fn(),
  }),
}));

jest.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({
    toggleWishlist: jest.fn(),
    isInWishlist: () => false,
  }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

jest.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        return ({ children, whileTap: _whileTap, whileHover: _whileHover, transition: _transition, initial: _initial, animate: _animate, exit: _exit, ...props }: any) =>
          React.createElement(prop, props, children);
      },
    },
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

jest.mock("@/components/ui/ResilientImage", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

jest.mock("swiper/react", () => ({
  Swiper: ({ children }: any) => <div data-testid="swiper">{children}</div>,
  SwiperSlide: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("swiper/modules", () => ({
  Navigation: {},
  Thumbs: {},
  FreeMode: {},
}));

jest.mock("@/components/ui/CountdownTimer", () => {
  function MockCountdownTimer() {
    return <div data-testid="countdown-timer" />;
  }
  return MockCountdownTimer;
});
jest.mock("@/components/product/ProductTabs", () => () => null);
jest.mock("@/app/product/[...segments]/ProductHistoryTracker", () => () => null);
jest.mock("@/app/product/[...segments]/ProductHeader", () => () => null);
jest.mock("@/app/product/[...segments]/ProductSocialActions", () => () => null);
jest.mock("@/app/product/[...segments]/ColorSelector", () => () => null);

const baseTime = Date.parse("2026-09-30T10:00:00Z");
const endTime = new Date(baseTime + 5000).toISOString();

const productWithSale: Product = {
  id: "prod-1",
  name: "دوربین مداربسته تست",
  title: "دوربین مداربسته تست",
  price: 4512000,
  oldPrice: 4800000,
  compareAtPrice: 4800000,
  discount: 6,
  isSpecialOffer: true,
  specialOfferEndTime: endTime,
  campaignLabel: "تخفیفات پاییزه",
  campaignTheme: "green-orange",
  image: "/placeholder.png",
  images: ["/placeholder.png"],
  category: "camera",
  categoryPath: [],
  rating: 0,
  reviewCount: 0,
  countInStock: 5,
};

describe("ProductDetailClient promotion expiry transition", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(baseTime);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("removes campaign label, badge, struck-through price, and restores base price when countdown ends", () => {
    const { container } = render(<ProductDetailClient product={productWithSale} />);

    // Before expiry: campaign label and discount badge are visible
    expect(screen.getAllByText("تخفیفات پاییزه").length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${(6).toLocaleString("fa-IR")}٪`).length).toBeGreaterThan(0);
    expect(container.querySelector(".line-through")).toBeInTheDocument();
    expect(screen.getAllByText((4512000).toLocaleString("fa-IR")).length).toBeGreaterThan(0);

    // Fast-forward past the countdown boundary
    act(() => {
      jest.advanceTimersByTime(5100);
    });

    // After expiry: campaign label and badge disappear
    expect(screen.queryByText("تخفیفات پاییزه")).toBeNull();
    expect(screen.queryByText(`${(6).toLocaleString("fa-IR")}٪`)).toBeNull();
    expect(container.querySelector(".line-through")).toBeNull();

    // Discounted price is gone; base price is restored
    expect(screen.queryByText((4512000).toLocaleString("fa-IR"))).toBeNull();
    expect(screen.getAllByText((4800000).toLocaleString("fa-IR")).length).toBeGreaterThan(0);
  });
});
