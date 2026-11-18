import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductDetailClient from "@/app/product/[...segments]/ProductDetailClient";
import { productService, type Product } from "@/services/productService";

const mockAddToCart = jest.fn();
const mockUpdateQuantity = jest.fn();
const mockRemoveFromCart = jest.fn();
const mockFetchProduct = jest.mocked(productService.getById);

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
    default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} />,
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
        mockFetchProduct.mockReset().mockResolvedValue(variableProduct);
    });

    it("در شروع اولین رنگ موجود را انتخاب و قیمتش را نشان می‌دهد", () => {
        render(<ProductDetailClient product={variableProduct} />);
        expect(screen.getByText("رنگ: مشکی")).toBeInTheDocument();
        expect(screen.getAllByText(FA(500000))).toHaveLength(2);
    });

    it("با انتخاب قرمز، قیمت/موجودی/گالری عوض می‌شود", async () => {
        render(<ProductDetailClient product={variableProduct} />);

        fireEvent.click(screen.getAllByRole("button", { name: "رنگ قرمز" })[0]);

        expect(screen.getByText("رنگ: قرمز")).toBeInTheDocument();
        expect(screen.getAllByText(FA(520000))).toHaveLength(2);
        // تگ اختلاف +۲۰٬۰۰۰ زیر دایره‌ی قرمز
        expect(screen.getAllByText(`+${FA(20000)}`).length).toBeGreaterThan(0);
        // گالری تصویر دوم قرمز را دارد
        await waitFor(() => {
            expect(screen.getByLabelText("تی‌شرت - نمای ۲")).toBeInTheDocument();
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

    it("با تغییر به نوع دارای تصاویر کمتر، گالری به تصویر اول برمی‌گردد", () => {
        render(<ProductDetailClient product={variableProduct} />);
        fireEvent.click(screen.getByRole("button", { name: "رنگ قرمز" }));
        fireEvent.click(screen.getByRole("button", { name: "نمایش تصویر ۲" }));
        expect(screen.getByRole("button", { name: "نمایش تصویر ۲" })).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", { name: "رنگ مشکی" }));
        expect(screen.getByRole("button", { name: "نمایش تصویر ۱" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.queryByRole("button", { name: "نمایش تصویر ۲" })).toBeNull();
    });

    it("رنگ ناموجود قابل انتخاب است و «ناموجود» نشان می‌دهد", () => {
        render(<ProductDetailClient product={variableProduct} />);

        fireEvent.click(screen.getAllByRole("button", { name: "رنگ زرد" })[0]);

        expect(screen.getByText("رنگ: زرد")).toBeInTheDocument();
        expect(screen.getAllByText("ناموجود").length).toBeGreaterThanOrEqual(2);
        expect(screen.queryByRole("button", { name: "افزودن به سبد خرید" })).toBeNull();
    });

    it("applies a gallery-only refresh to the selected variant and ignores an older response", async () => {
        const catalogWithPhoto = (src: string) => ({
            ...variableProduct,
            variants: variableProduct.variants!.map((variant) => variant.id === "v2"
                ? { ...variant, images: [src] }
                : variant),
        });
        let finishEarlier: (p: Product) => void = () => {};
        let finishLater: (p: Product) => void = () => {};

        render(<ProductDetailClient product={variableProduct} />);
        fireEvent.click(screen.getByRole("button", { name: "رنگ قرمز" }));
        await waitFor(() => expect(mockFetchProduct).toHaveBeenCalledTimes(1));
        mockFetchProduct
            .mockImplementationOnce(() => new Promise((resolve) => { finishEarlier = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { finishLater = resolve; }));
        fireEvent(document, new Event("visibilitychange"));
        fireEvent(document, new Event("visibilitychange"));
        await waitFor(() => expect(mockFetchProduct).toHaveBeenCalledTimes(3));

        await act(async () => finishLater(catalogWithPhoto("red-current.jpg")));
        await act(async () => finishEarlier(catalogWithPhoto("red-stale.jpg")));

        expect(screen.getByRole("img", { name: "خرید تی‌شرت" })).toHaveAttribute("data-src", "red-current.jpg");
        expect(screen.getByText("رنگ: قرمز")).toBeInTheDocument();
        expect(screen.getAllByText(FA(520000))).toHaveLength(2);
    });

    it("uses the first available catalog variant when a server refresh removes the selection", () => {
        const { rerender } = render(<ProductDetailClient product={variableProduct} />);
        fireEvent.click(screen.getByRole("button", { name: "رنگ قرمز" }));
        rerender(<ProductDetailClient product={{ ...variableProduct, variants: variableProduct.variants!.filter((variant) => variant.id !== "v2") }} />);

        expect(screen.getByText("رنگ: مشکی")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "خرید تی‌شرت" })).toHaveAttribute("data-src", "black.jpg");
        expect(screen.getAllByText(FA(500000))).toHaveLength(2);
    });
});
