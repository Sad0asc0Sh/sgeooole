import { clampQuantity, isAtStockCap, resolveAvailableStock } from "./stockLimits";
import type { Product } from "@/types/product";

const baseProduct = (overrides: Partial<Product>): Product =>
    ({
        id: "p1",
        name: "x",
        title: "x",
        price: 100,
        discount: 0,
        image: "",
        images: [],
        category: "",
        rating: 0,
        reviewCount: 0,
        countInStock: 5,
        ...overrides,
    }) as Product;

describe("resolveAvailableStock", () => {
    it("returns product-level stock for simple products", () => {
        expect(resolveAvailableStock(baseProduct({ countInStock: 7 }))).toBe(7);
    });

    it("returns the exact variant stock when a variant is selected", () => {
        const product = baseProduct({
            countInStock: 9,
            productType: "variable",
            variants: [
                { id: "v1", price: 100, stock: 2, options: [{ name: "رنگ", value: "قرمز" }] },
                { id: "v2", price: 100, stock: 6, options: [{ name: "رنگ", value: "آبی" }] },
            ],
        });
        expect(resolveAvailableStock(product, [{ name: "رنگ", value: "قرمز" }])).toBe(2);
        expect(resolveAvailableStock(product, [{ name: "رنگ", value: "آبی" }])).toBe(6);
    });

    it("returns undefined for unknown products so nothing is blocked on missing data", () => {
        expect(resolveAvailableStock(null)).toBeUndefined();
        expect(resolveAvailableStock(undefined)).toBeUndefined();
    });

    it("never returns a negative stock", () => {
        expect(resolveAvailableStock(baseProduct({ countInStock: -3 }))).toBe(0);
    });
});

describe("clampQuantity", () => {
    it("caps the quantity at the available stock", () => {
        expect(clampQuantity(10, 4)).toBe(4);
        expect(clampQuantity(3, 4)).toBe(3);
        expect(clampQuantity(1, 0)).toBe(0);
    });

    it("does not cap when stock is unknown", () => {
        expect(clampQuantity(10, undefined)).toBe(10);
    });

    it("floors fractional and negative input", () => {
        expect(clampQuantity(2.9, 10)).toBe(2);
        expect(clampQuantity(-5, 10)).toBe(0);
    });
});

describe("isAtStockCap", () => {
    it("is true only at or above a known cap", () => {
        expect(isAtStockCap(4, 4)).toBe(true);
        expect(isAtStockCap(5, 4)).toBe(true);
        expect(isAtStockCap(3, 4)).toBe(false);
        expect(isAtStockCap(99, undefined)).toBe(false);
        expect(isAtStockCap(0, 0)).toBe(true);
    });
});
