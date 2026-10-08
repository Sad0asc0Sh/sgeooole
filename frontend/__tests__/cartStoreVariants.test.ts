import { act } from "react";
import { useCartStore } from "@/store/cartStore";
import { productService } from "@/services/productService";
import { withSelectedVariant, findVariant } from "@/lib/variants";
import type { Product } from "@/services/productService";

jest.mock("@/services/authService", () => ({
    authService: { isAuthenticated: () => false },
}));

jest.mock("@/services/cartService", () => ({
    cartService: {
        addItem: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
        updateItem: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
        removeItem: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
        clearCart: jest.fn().mockResolvedValue({ success: true }),
        getCart: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    },
}));

jest.mock("@/services/productService", () => ({
    productService: { getById: jest.fn() },
}));

const mockGetById = jest.mocked(productService.getById);

// رکورد تازه‌ی بک‌اند برای محصول متغیر: قیمت مینیمم + مجموع موجودی
const freshVariable: Product = {
    id: "var1",
    name: "تی‌شرت",
    title: "تی‌شرت",
    price: 500000,
    discount: 0,
    image: "base.jpg",
    images: ["base.jpg"],
    category: "cat",
    rating: 0,
    reviewCount: 0,
    countInStock: 5,
    productType: "variable",
    attributes: [{ name: "رنگ", values: ["مشکی", "قرمز"] }],
    variants: [
        { id: "v1", price: 500000, stock: 3, options: [{ name: "رنگ", value: "مشکی" }], images: ["black.jpg"] },
        { id: "v2", price: 520000, stock: 2, options: [{ name: "رنگ", value: "قرمز" }], images: ["red.jpg"] },
    ],
};

// همان چیزی که صفحه‌ی محصول (viewProduct) به سبد می‌دهد
const viewRed = withSelectedVariant(
    freshVariable,
    findVariant(freshVariable.variants ?? [], { "رنگ": "قرمز" }),
);
const redOptions = [{ name: "رنگ", value: "قرمز" }];

describe("cartStore — قیمت variant (مهمان)", () => {
    beforeEach(() => {
        localStorage.clear();
        mockGetById.mockReset();
        mockGetById.mockResolvedValue(freshVariable);
        const store = useCartStore.getState();
        store.cartItems = [];
        store.mutating = false;
    });

    it("addToCart قیمت variant انتخاب‌شده را ذخیره می‌کند، نه مینیمم را", async () => {
        await act(async () => {
            await useCartStore.getState().addToCart(viewRed, 1, redOptions);
        });

        const [line] = useCartStore.getState().cartItems;
        expect(line.price).toBe(520000);
        expect(line.image).toBe("red.jpg");
        expect(line.variantOptions).toEqual(redOptions);
    });

    it("revalidateCartPrices قیمت variant را به مینیمم برنمی‌گرداند", async () => {
        await act(async () => {
            await useCartStore.getState().addToCart(viewRed, 1, redOptions);
            await useCartStore.getState().revalidateCartPrices();
        });

        expect(useCartStore.getState().cartItems[0].price).toBe(520000);
    });

    it("variantهای مختلف یک محصول، دو خط جدا می‌سازند", async () => {
        const viewBlack = withSelectedVariant(
            freshVariable,
            findVariant(freshVariable.variants ?? [], { "رنگ": "مشکی" }),
        );
        await act(async () => {
            await useCartStore.getState().addToCart(viewRed, 1, redOptions);
            await useCartStore.getState().addToCart(viewBlack, 1, [{ name: "رنگ", value: "مشکی" }]);
        });

        const items = useCartStore.getState().cartItems;
        expect(items).toHaveLength(2);
        expect(items.map((i) => i.price).sort()).toEqual([500000, 520000]);
    });
});
