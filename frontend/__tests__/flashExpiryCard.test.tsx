import React from "react";
import { render, screen } from "@testing-library/react";
import HomeProductCard from "@/components/home/HomeProductCard";
import { resolvePricing } from "@/lib/pricing";
import type { Product } from "@/types/product";

jest.mock("@/components/ui/ResilientImage", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

// A live server snapshot taken while the flash deal was active: the backend
// already discounted `price` and kept the base in `compareAtPrice`.
const ENDS_AT = "2026-09-30T10:30:00.000Z";

const mapSnapshotAt = (now: number): Product => {
  const pricing = resolvePricing({
    price: 970000,
    discount: 3,
    compareAtPrice: 1000000,
    isFlashDeal: true,
    flashDealEndTime: ENDS_AT,
    now,
  });
  return {
    id: "flash-one",
    name: "کالای لحظه‌ای",
    title: "کالای لحظه‌ای",
    price: pricing.finalPrice,
    oldPrice: pricing.oldPrice,
    compareAtPrice: pricing.basePrice,
    discount: pricing.discount,
    image: "/placeholder.png",
    images: [],
    category: "test",
    rating: 0,
    reviewCount: 0,
    countInStock: 5,
    isFlashDeal: true,
    flashDealEndTime: ENDS_AT,
  };
};

describe("flash expiry on home cards (970,000 regression)", () => {
  const endsAt = Date.parse(ENDS_AT);

  test("the same snapshot shows the deal while live and the base price after the boundary", () => {
    const before = endsAt - 60_000;
    const { container, rerender } = render(<HomeProductCard product={mapSnapshotAt(before)} now={before} />);
    expect(screen.getByText("پیشنهاد لحظه‌ای")).toBeInTheDocument();
    expect(container.querySelector("del")).toHaveTextContent((1000000).toLocaleString("fa-IR"));
    expect(screen.getByText((970000).toLocaleString("fa-IR"))).toBeInTheDocument();

    // One minute after the flash ended, the card mapped from the SAME live
    // snapshot restores the base price with no badge and no strike-through.
    const after = endsAt + 60_000;
    rerender(<HomeProductCard product={mapSnapshotAt(after)} now={after} />);
    expect(screen.queryByText("پیشنهاد لحظه‌ای")).not.toBeInTheDocument();
    expect(container.querySelector("del")).toBeNull();
    expect(screen.getByText((1000000).toLocaleString("fa-IR"))).toBeInTheDocument();
    expect(screen.queryByText((970000).toLocaleString("fa-IR"))).not.toBeInTheDocument();
  });
});
