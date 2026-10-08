import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/types/product";

jest.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({
    toggleWishlist: jest.fn(),
    isInWishlist: () => false,
  }),
}));

jest.mock("@/components/ui/ResilientImage", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const future = new Date(Date.now() + 3_600_000).toISOString();

const variableProduct: Product = {
  id: "p1",
  name: "محصول متغیر",
  title: "محصول متغیر",
  image: "/a.png",
  images: ["/a.png"],
  category: "c",
  rating: 0,
  reviewCount: 0,
  countInStock: 10,
  price: 70000,
  discount: 20,
  productType: "variable",
  isSpecialOffer: true,
  specialOfferEndTime: future,
  variants: [
    // ارزان‌ترین مدل مستثنی از تخفیف → نماینده بدون تخفیف
    { id: "cheap", price: 70000, stock: 5, options: [], excludeFromPromotion: true as const },
    { id: "a", price: 800000, oldPrice: 1000000, stock: 5, options: [] },
  ],
};

describe("ProductCard با مدل مستثنی ارزان", () => {
  test("هدر هست، درصد و خط‌خورده نیست، «از» و «تخفیف روی چند مدل» هست", () => {
    const { container } = render(<ProductCard product={variableProduct} />);
    // هدر شگفت‌انگیز می‌ماند چون حداقل یک مدل تخفیف دارد
    expect(screen.getByText("شگفت‌انگیز")).toBeInTheDocument();
    // بج درصد و قیمت خط‌خورده نباید باشد (قیمت نماینده تخفیف ندارد)
    expect(container.querySelector("del")).toBeNull();
    expect(screen.queryByText("۲۰٪")).not.toBeInTheDocument();
    // پیشوند «از» و چیپ جزئی
    expect(screen.getByText("از")).toBeInTheDocument();
    expect(screen.getByText("تخفیف روی چند مدل")).toBeInTheDocument();
    // قیمت نماینده (پایه‌ی مدل مستثنی)
    expect(screen.getByText((70000).toLocaleString("fa-IR"))).toBeInTheDocument();
  });

  test("همه‌ی مدل‌ها مستثنی: کارت عادی بدون هدر", () => {
    const { container } = render(
      <ProductCard
        product={{ ...variableProduct, variants: [{ id: "a", price: 70000, stock: 5, options: [], excludeFromPromotion: true as const }] }}
      />,
    );
    expect(screen.queryByText("شگفت‌انگیز")).not.toBeInTheDocument();
    expect(container.querySelector("del")).toBeNull();
    expect(screen.queryByText("تخفیف روی چند مدل")).not.toBeInTheDocument();
  });
});
