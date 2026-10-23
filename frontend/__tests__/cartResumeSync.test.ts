import { act } from "react";
import { useCartStore, type LocalCartItem } from "@/store/cartStore";
import { authService } from "@/services/authService";
import { cartService } from "@/services/cartService";
import { setLocalStorageWithExpiry } from "@/lib/localStorageHelper";

jest.mock("@/services/authService", () => ({
    authService: { isAuthenticated: jest.fn(() => false) },
}));

jest.mock("@/services/cartService", () => ({
    cartService: {
        getCart: jest.fn(),
        addItem: jest.fn(),
        updateItem: jest.fn(),
        removeItem: jest.fn(),
        clearCart: jest.fn(),
    },
}));

const LOCAL_CART_KEY = "ekgkala_cart";

const line = (id: string, qty: number): LocalCartItem => ({
    id,
    name: `محصول ${id}`,
    price: 100_000,
    image: "/placeholder.svg",
    qty,
});

const setCart = (cartItems: LocalCartItem[]) => {
    useCartStore.setState({ cartItems, initialized: true, cartVersion: 0 });
};

describe("cartStore.syncCartFromSource — همگام‌سازی سبد هنگام بازگشت به صفحه", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.mocked(authService.isAuthenticated).mockReturnValue(false);
        jest.mocked(cartService.getCart).mockResolvedValue({ success: true, data: { items: [], version: 0 } } as never);
        useCartStore.setState({
            cartItems: [],
            initialized: true,
            cartVersion: 0,
            cartConfig: { persistCart: true, cartExpirationDays: 30 },
        });
    });

    it("مهمان: سبدِ ذخیره‌شده در localStorage را برمی‌گرداند (بدون فراخوانی بک‌اند)", async () => {
        setLocalStorageWithExpiry(LOCAL_CART_KEY, [line("p1", 2)], 30);
        setCart([]);

        await act(async () => {
            await useCartStore.getState().syncCartFromSource();
        });

        expect(useCartStore.getState().cartItems).toHaveLength(1);
        expect(useCartStore.getState().cartItems[0].id).toBe("p1");
        expect(useCartStore.getState().cartItems[0].qty).toBe(2);
        expect(cartService.getCart).not.toHaveBeenCalled();
    });

    it("مهمان: نبودِ snapshot در حافظه، سبد فعلی را پاک نمی‌کند", async () => {
        setCart([line("p1", 1)]);

        await act(async () => {
            await useCartStore.getState().syncCartFromSource();
        });

        expect(useCartStore.getState().cartItems).toHaveLength(1);
    });

    it("مهمان: وقتی خطوط تغییری نکرده‌اند، state دست‌نخورده می‌ماند (بدون رندر اضافه)", async () => {
        const items = [line("p1", 1)];
        setLocalStorageWithExpiry(LOCAL_CART_KEY, items, 30);
        setCart(items);
        const before = useCartStore.getState().cartItems;

        await act(async () => {
            await useCartStore.getState().syncCartFromSource();
        });

        expect(useCartStore.getState().cartItems).toBe(before);
    });

    it("کاربر لاگین‌شده: snapshot سرور را (با ادغام تغییرات در انتظار) اعمال می‌کند", async () => {
        jest.mocked(authService.isAuthenticated).mockReturnValue(true);
        jest.mocked(cartService.getCart).mockResolvedValue({
            success: true,
            data: {
                items: [
                    {
                        product: { _id: "server-1", name: "کالای سرور", price: 250_000, images: [] },
                        quantity: 3,
                        price: 250_000,
                    },
                ],
                totalPrice: 750_000,
                version: 7,
            },
        } as never);

        await act(async () => {
            await useCartStore.getState().syncCartFromSource();
        });

        const state = useCartStore.getState();
        expect(state.cartItems).toHaveLength(1);
        expect(state.cartItems[0].id).toBe("server-1");
        expect(state.cartItems[0].qty).toBe(3);
        expect(state.cartVersion).toBe(7);
    });

    it("کاربر لاگین‌شده: قطعی بک‌اند سبد فعلی را از بین نمی‌برد", async () => {
        jest.mocked(authService.isAuthenticated).mockReturnValue(true);
        jest.mocked(cartService.getCart).mockRejectedValue(new Error("offline"));
        setCart([line("p1", 1)]);

        await act(async () => {
            await useCartStore.getState().syncCartFromSource();
        });

        expect(useCartStore.getState().cartItems).toHaveLength(1);
    });
});
