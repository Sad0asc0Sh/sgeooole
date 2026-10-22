import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductPromotionBanner from "@/components/promotion/ProductPromotionBanner";
import type { Product } from "@/types/product";

jest.mock("@/components/ui/CountdownTimer", () => ({
    __esModule: true,
    default: () => <div data-testid="countdown-timer" />,
}));

const future = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString();

const baseProduct = {
    id: "promo-1",
    name: "کالای تخفیف‌دار",
    title: "کالای تخفیف‌دار",
    price: 970000,
    oldPrice: 1000000,
    compareAtPrice: 1000000,
    discount: 3,
    image: "/placeholder.png",
    images: ["/placeholder.png"],
    category: "cctv",
    categoryPath: [],
    rating: 0,
    reviewCount: 0,
    countInStock: 4,
};

// The backend pins campaignTheme "gold-red" on live flash deals.
const flashProduct = {
    ...baseProduct,
    isFlashDeal: true,
    flashDealEndTime: future(),
    campaignLabel: "پیشنهاد لحظه‌ای",
    campaignTheme: "gold-red",
} as unknown as Product;

const saleProduct = {
    ...baseProduct,
    isSpecialOffer: true,
    specialOfferEndTime: future(),
    campaignLabel: "تخفیفات پاییزه",
    campaignTheme: "gold-red",
} as unknown as Product;

describe("ProductPromotionBanner — بنر شمارش معکوس صفحه محصول", () => {
    test("«پیشنهاد لحظه‌ای» همان گرادیان کارت را می‌گیرد، نه واش طلایی کمپین", () => {
        const { container } = render(<ProductPromotionBanner product={flashProduct} />);

        const banner = container.querySelector("[data-promotion-banner='flash']");
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveClass("bg-kala-timed-gradient");
        expect(banner).toHaveClass("text-white");
        expect(banner).not.toHaveClass("bg-yellow-50");
        expect(screen.getByText("پیشنهاد لحظه‌ای")).toBeInTheDocument();
        expect(screen.getByTestId("countdown-timer")).toBeInTheDocument();
    });

    test("کمپین تجاری همچنان واش رنگ انتخابی ادمین را نگه می‌دارد", () => {
        const { container } = render(<ProductPromotionBanner product={saleProduct} />);

        const banner = container.querySelector("[data-promotion-banner='campaign']");
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveClass("bg-yellow-50");
        expect(banner).not.toHaveClass("bg-kala-timed-gradient");
    });

    test("پس از پایان شمارش معکوس، بنر رندر نمی‌شود", () => {
        const expired = {
            ...flashProduct,
            flashDealEndTime: new Date(Date.now() - 60_000).toISOString(),
        };

        const { container } = render(<ProductPromotionBanner product={expired} />);
        expect(container.querySelector("[data-promotion-banner]")).toBeNull();
    });

    test("کمپین بدون فلگ شگفت‌انگیز با زمان پایان گذشته، بنر منقضی نشان نمی‌دهد", () => {
        const staleCampaign = {
            ...baseProduct,
            campaignLabel: "تخفیفات پاییزه",
            campaignTheme: "gold-red",
            specialOfferEndTime: new Date(Date.now() - 60_000).toISOString(),
        } as unknown as Product;

        const { container } = render(<ProductPromotionBanner product={staleCampaign} />);
        expect(container.querySelector("[data-promotion-banner]")).toBeNull();
    });
});
