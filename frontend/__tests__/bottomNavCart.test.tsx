import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BottomNav from "@/components/layout/BottomNav";
import { useCartStore } from "@/store/cartStore";

jest.mock("@/store/cartStore", () => ({
    useCartStore: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({ user: null }),
}));

jest.mock("@/components/features/categories/CategoriesSheet", () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock("@/lib/scroll/ScrollManager", () => ({
    getScrollManager: () => ({ clear: jest.fn() }),
}));

type FakeCartState = {
    cartItems: Array<{ qty: number }>;
    initialized: boolean;
};

const mockedUseCartStore = useCartStore as unknown as jest.Mock;

/** BottomNav subscribes with primitive selectors — feed the fake state into them. */
const setCartState = (state: FakeCartState) => {
    mockedUseCartStore.mockImplementation((selector: (value: FakeCartState) => unknown) => selector(state));
};

const navProps = { onNavClick: jest.fn(), isServicesOpen: false };

const cartLink = () => screen.getByRole("link", { name: /سبد خرید/ });
const cartGlyph = () => cartLink().querySelector("svg");

describe("BottomNav — وضعیت سبد خرید", () => {
    beforeEach(() => {
        setCartState({ cartItems: [], initialized: true });
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    test("سبد خالی: آیکون outline، بدون بج و بدون انیمیشن", () => {
        render(<BottomNav {...navProps} />);

        expect(cartGlyph()).toHaveAttribute("fill", "none");
        expect(screen.queryByText("۱")).toBeNull();
        expect(cartLink().querySelector(".bump")).toBeNull();
        expect(cartLink()).toHaveAttribute("aria-label", "سبد خرید");
    });

    test("سبد پر: آیکون توپر + بج شمارش فارسی", () => {
        setCartState({ cartItems: [{ qty: 3 }], initialized: true });
        render(<BottomNav {...navProps} />);

        expect(cartGlyph()).toHaveAttribute("fill", "currentColor");
        expect(screen.getByText("۳")).toBeInTheDocument();
        expect(cartLink()).toHaveAttribute("aria-label", "سبد خرید، ۳ کالا");
    });

    test("افزودن محصول: آیکون پر می‌شود و پالس/بج یک‌بار اجرا و سپس پاک می‌شود", () => {
        const { rerender } = render(<BottomNav {...navProps} />);
        expect(cartLink().querySelector(".bump")).toBeNull();

        // یک قلم به سبد اضافه می‌شود (همان state بعد از addToCart).
        setCartState({ cartItems: [{ qty: 1 }], initialized: true });
        rerender(<BottomNav {...navProps} />);

        expect(cartGlyph()).toHaveAttribute("fill", "currentColor");
        expect(screen.getByText("۱")).toBeInTheDocument();
        expect(cartLink().querySelector(".bump")).toBeInTheDocument();
        expect(cartLink().querySelector(".badgeBump")).toBeInTheDocument();

        // انیمیشن کوتاه است و نباید به‌صورت دائمی روی عنصر بماند.
        act(() => {
            jest.advanceTimersByTime(700);
        });
        expect(cartLink().querySelector(".bump")).toBeNull();
    });

    test("لود اول با سبد پر، انیمیشن «افزودن» را اجرا نمی‌کند", () => {
        setCartState({ cartItems: [{ qty: 2 }], initialized: true });
        render(<BottomNav {...navProps} />);

        expect(cartLink().querySelector(".bump")).toBeNull();
    });
});
