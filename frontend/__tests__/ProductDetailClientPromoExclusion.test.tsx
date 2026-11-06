import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductDetailClient from "@/app/product/[...segments]/ProductDetailClient";
import type { Product } from "@/services/productService";

const mockAddToCart = jest.fn();
const mockUpdateQuantity = jest.fn();
const mockRemoveFromCart = jest.fn();

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
        addToCart: mockAddToCart,
        updateQuantity: mockUpdateQuantity,
        removeFromCart: mockRemoveFromCart,
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
                    React.createElement(prop as any, props, children);
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

const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

// محصول متغیر داخل Sale فعال: «مشکی» مشمول تخفیف، «قرمز» مستثنی (تیک تخفیف خاموش)
const saleVariableProduct: Product = {
    id: "sale1",
    name: "تی‌شرت",
    title: "تی‌شرت",
    price: 400000,
    oldPrice: 500000,
    discount: 20,
    isSpecialOffer: true,
    specialOfferEndTime: future,
    campaignLabel: "فروش ویژه عید",
    campaignTheme: "red-purple",
    image: "base.jpg",
    images: ["base.jpg"],
    category: "پوشاک",
    categoryPath: [],
    rating: 0,
    reviewCount: 0,
    countInStock: 5,
    productType: "variable",
    attributes: [{ name: "رنگ", values: ["مشکی", "قرمز"], displayType: "color" }],
    variants: [
        { id: "v1", price: 400000, oldPrice: 500000, stock: 3, options: [{ name: "رنگ", value: "مشکی" }] },
        { id: "v2", price: 520000, stock: 2, options: [{ name: "رنگ", value: "قرمز" }], excludeFromPromotion: true },
    ],
} as unknown as Product;

describe("ProductDetailClient — ظاهر تخفیف زمان‌دار و متغیر مستثنی", () => {
    it("متغیر مشمول: بنر لیبل Sale و تایمر نمایش داده می‌شود", () => {
        render(<ProductDetailClient product={saleVariableProduct} />);
        expect(screen.getAllByText("فروش ویژه عید").length).toBeGreaterThan(0);
        expect(screen.getAllByTestId("countdown-timer").length).toBeGreaterThan(0);
    });

    it("متغیر مستثنی: نه بنر Sale، نه تایمر، نه قیمت تخفیفی", () => {
        render(<ProductDetailClient product={saleVariableProduct} />);
        fireEvent.click(screen.getAllByRole("button", { name: "رنگ قرمز" })[0]);

        expect(screen.queryByText("فروش ویژه عید")).toBeNull();
        expect(screen.queryAllByTestId("countdown-timer")).toHaveLength(0);
        expect(screen.getAllByText((520000).toLocaleString("fa-IR")).length).toBeGreaterThan(0);
    });

    it("برگشت به متغیر مشمول، بنر را دوباره نشان می‌دهد", () => {
        render(<ProductDetailClient product={saleVariableProduct} />);
        fireEvent.click(screen.getAllByRole("button", { name: "رنگ قرمز" })[0]);
        fireEvent.click(screen.getAllByRole("button", { name: "رنگ مشکی" })[0]);
        expect(screen.getAllByText("فروش ویژه عید").length).toBeGreaterThan(0);
    });
});
