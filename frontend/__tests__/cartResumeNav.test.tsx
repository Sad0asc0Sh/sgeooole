import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BottomNav from "@/components/layout/BottomNav";
import { useCartSync } from "@/hooks/useCartSync";
import { useCartStore, type LocalCartItem } from "@/store/cartStore";
import { setLocalStorageWithExpiry } from "@/lib/localStorageHelper";

/**
 * Regression for the reported flow: the product page was opened in a new
 * document, a product was added there, and the browser restored the previous
 * document from the bfcache — its in-memory cart still said "empty", so the
 * bottom-nav cart looked cached and never updated.
 *
 * The resume sync must rebuild the badge from the source of truth without a
 * reload (bfcache restore fires `pageshow` with persisted=true).
 */

jest.mock("@/services/authService", () => ({
    authService: { isAuthenticated: jest.fn(() => false) },
}));

jest.mock("@/services/cartService", () => ({
    cartService: {
        getCart: jest.fn().mockResolvedValue({ success: true, data: { items: [], version: 0 } }),
        addItem: jest.fn(),
        updateItem: jest.fn(),
        removeItem: jest.fn(),
        clearCart: jest.fn(),
    },
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

function Shell() {
    useCartSync();
    return <BottomNav onNavClick={jest.fn()} isServicesOpen={false} />;
}

const cartLink = () => screen.getByRole("link", { name: /سبد خرید/ });

const item = (id: string, qty: number): LocalCartItem => ({
    id,
    name: "کالای سبد",
    price: 100_000,
    image: "/placeholder.svg",
    qty,
});

describe("بازگشت از صفحه محصول (bfcache) — بج سبد خرید نویگیشن", () => {
    beforeEach(() => {
        localStorage.clear();
        useCartStore.setState({ cartItems: [], initialized: true, cartVersion: 0 });
    });

    it("صفحه‌ی بازیابی‌شده از کش، بج سبد را از snapshot واقعی می‌سازد", async () => {
        render(<Shell />);

        // Restored document: the in-memory cart missed the add made elsewhere.
        expect(cartLink()).toHaveAttribute("aria-label", "سبد خرید");
        expect(cartLink().querySelector("svg")).toHaveAttribute("fill", "none");

        // ...but localStorage (source of truth for guests) already has the line.
        setLocalStorageWithExpiry("ekgkala_cart", [item("p1", 1)], 30);

        await act(async () => {
            window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        });

        expect(screen.getByText("۱")).toBeInTheDocument();
        expect(cartLink()).toHaveAttribute("aria-label", "سبد خرید، ۱ کالا");
        expect(cartLink().querySelector("svg")).toHaveAttribute("fill", "currentColor");
    });
});
