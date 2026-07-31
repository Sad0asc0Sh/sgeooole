import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductCard from "@/components/product/ProductCard";

jest.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    addToCart: jest.fn(),
    updateQuantity: jest.fn(),
    removeFromCart: jest.fn(),
    itemCount: 0,
    cartItems: [],
  }),
}));

jest.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({
    toggleWishlist: jest.fn(),
    isInWishlist: () => false,
  }),
}));

jest.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div data-testid="swiper">{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div data-testid="swiper-slide">{children}</div>,
}));
jest.mock("swiper/modules", () => ({}));

const productMock = {
  id: "1",
  title: "Test Product",
  name: "Test Product",
  price: 100000,
  discount: 0,
  image: "/test.png",
  images: ["/test.png"],
  category: "Test Category",
  rating: 4.5,
  reviewCount: 10,
  countInStock: 5,
  categoryPath: [],
};

describe("ProductCard", () => {
  it("renders product title and price", () => {
    render(<ProductCard product={productMock as any} />);
    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText((100000).toLocaleString("fa-IR"), { exact: false })).toBeInTheDocument();
  });
});
