import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// محصول متغیرِ مپ‌شده (خروجی mapBackendToFrontend): ارزان‌ترین قیمت + مجموع موجودی
const variableProduct: Product = {
    id: "var1",
    name: "تی‌شرت",
    title: "تی‌شرت",
    price: 500000,
    discount: 0,
    image: "base.jpg",
    images: ["base.jpg"],
    category: "پوشاک",
    categoryPath: [],
    rating: 0,
    reviewCount: 0,
    countInStock: 5,
    productType: "variable",
    attributes: [{ name: "رنگ", values: ["مشکی", "قرمز", "زرد"], displayType: "color" }],
    variants: [
        { id: "v1", price: 500000, stock: 3, options: [{ name: "رنگ", value: "مشکی" }], images: ["black.jpg"] },
        { id: "v2", price: 520000, stock: 2, options: [{ name: "رنگ", value: "قرمز" }], images: ["red1.jpg", "red2.jpg"] },
        { id: "v3", price: 500000, stock: 0, options: [{ name: "رنگ", value: "زرد" }], images: [] },
    ],
};

const FA = (n: number) => n.toLocaleString("fa-IR");

describe("ProductDetailClient — محصول متغیر", () => {
    beforeEach(() => {
        mockAddToCart.mockClear();
        mockUpdateQuantity.mockClear();
        mockRemoveFromCart.mockClear();
    });

    it("در شروع اولین رنگ موجود را انتخاب و قیمتش را نشان می‌دهد", () => {
        render(<ProductDetailClient product={variableProduct} />);
        // دسکتاپ + موبایل
        expect(screen.getAllByText("رنگ: مشکی")).toHaveLength(2);
        expect(screen.getAllByText(FA(500000))).toHaveLength(2);
    });

    it("با انتخاب قرمز، قیمت/موجودی/گالری عوض می‌شود", async () => {
        render(<ProductDetailClient product={variableProduct} />);

        fireEvent.click(screen.getAllByRole("button", { name: "رنگ قرمز" })[0]);

        expect(screen.getAllByText("رنگ: قرمز")).toHaveLength(2);
        expect(screen.getAllByText(FA(520000))).toHaveLength(2);
        // تگ اختلاف +۲۰٬۰۰۰ زیر دایره‌ی قرمز
        expect(screen.getAllByText(`+${FA(20000)}`).length).toBeGreaterThan(0);
        // گالری تصویر دوم قرمز را دارد (دسکتاپ + موبایل)
        await waitFor(() => {
            expect(screen.getAllByLabelText("تی‌شرت - نمای ۲")).toHaveLength(2);
        });
    });

    it("افزودن به سبد، variant انتخاب‌شده (نه مینیمم) را می‌فرستد", async () => {
        render(<ProductDetailClient product={variableProduct} />);

        fireEvent.click(screen.getAllByRole("button", { name: "رنگ قرمز" })[0]);
        fireEvent.click(screen.getAllByRole("button", { name: "افزودن به سبد خرید" })[0]);

        await waitFor(() => {
            expect(mockAddToCart).toHaveBeenCalledWith(
                expect.objectContaining({ id: "var1", price: 520000, countInStock: 2 }),
                1,
                [{ name: "رنگ", value: "قرمز" }],
            );
        });
    });

    it("رنگ ناموجود قابل انتخاب است و «ناموجود» نشان می‌دهد", () => {
        render(<ProductDetailClient product={variableProduct} />);

        fireEvent.click(screen.getAllByRole("button", { name: "رنگ زرد" })[0]);

        expect(screen.getAllByText("رنگ: زرد")).toHaveLength(2);
        // باکس موجودی (×۲) + دکمه‌های خرید (×۲)
        expect(screen.getAllByText("ناموجود").length).toBeGreaterThanOrEqual(4);
        expect(screen.queryByRole("button", { name: "افزودن به سبد خرید" })).toBeNull();
    });
});
