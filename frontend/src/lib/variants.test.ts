import {
    applyChoice,
    colorHexFor,
    findVariant,
    fromOptions,
    initialSelection,
    isColorAttribute,
    isOptionOutOfStock,
    optionsKey,
    outOfStockValues,
    priceDiffFromMin,
    priceRange,
    toOptions,
    withSelectedVariant,
} from "@/lib/variants";
import type { Product, ProductAttribute, ProductVariant } from "@/types/product";

const variants: ProductVariant[] = [
    { id: "v1", price: 500000, stock: 3, options: [{ name: "رنگ", value: "مشکی" }], images: ["black.jpg"] },
    { id: "v2", price: 520000, stock: 2, options: [{ name: "رنگ", value: "قرمز" }], images: ["red.jpg"] },
    { id: "v3", price: 500000, stock: 0, options: [{ name: "رنگ", value: "زرد" }], images: [] },
];

const baseProduct = {
    id: "p1",
    name: "تست",
    title: "تست",
    price: 500000,
    discount: 0,
    image: "base.jpg",
    images: ["base.jpg"],
    category: "x",
    rating: 0,
    reviewCount: 0,
    countInStock: 5,
} as Product;

describe("variants lib — سناریوی فروشگاهی رنگ", () => {
    test("initialSelection اولین variant موجود را برمی‌گرداند", () => {
        expect(initialSelection(variants)).toEqual({ "رنگ": "مشکی" });
    });

    test("initialSelection وقتی همه ناموجودند ارزان‌ترین را برمی‌گرداند", () => {
        const allOut: ProductVariant[] = variants.map((v) => ({ ...v, stock: 0 }));
        expect(initialSelection(allOut)).toEqual({ "رنگ": "مشکی" });
    });

    test("initialSelection با ورودی خالی/خراب سقوط نمی‌کند", () => {
        expect(initialSelection([])).toEqual({});
        expect(initialSelection(undefined as any)).toEqual({});
        expect(initialSelection([null as any, undefined as any])).toEqual({});
    });

    test("findVariant تطبیق دقیق", () => {
        expect(findVariant(variants, { "رنگ": "قرمز" })?.id).toBe("v2");
        expect(findVariant(variants, { "رنگ": "آبی" })).toBeUndefined();
        expect(findVariant(variants, {})).toBeUndefined();
        // تطبیق جزئی کافی نیست (variant دو گزینه‌ای با انتخاب تک‌گزینه‌ای)
        const two: ProductVariant[] = [
            { id: "a", price: 1, stock: 1, options: [{ name: "رنگ", value: "قرمز" }, { name: "سایز", value: "L" }] },
        ];
        expect(findVariant(two, { "رنگ": "قرمز" })).toBeUndefined();
        expect(findVariant(two, { "رنگ": "قرمز", "سایز": "L" })?.id).toBe("a");
    });

    test("applyChoice انتخاب معتبر را نگه می‌دارد و ترکیب نامعتبر را اصلاح می‌کند", () => {
        const two: ProductVariant[] = [
            { id: "a", price: 1, stock: 1, options: [{ name: "رنگ", value: "قرمز" }, { name: "سایز", value: "L" }] },
            { id: "b", price: 1, stock: 5, options: [{ name: "رنگ", value: "قرمز" }, { name: "سایز", value: "M" }] },
            { id: "c", price: 1, stock: 5, options: [{ name: "رنگ", value: "آبی" }, { name: "سایز", value: "M" }] },
        ];
        expect(applyChoice(two, { "رنگ": "قرمز", "سایز": "L" }, "سایز", "M")).toEqual({
            "رنگ": "قرمز",
            "سایز": "M",
        });
        // آبی+L وجود ندارد → سایز خودکار M می‌شود
        expect(applyChoice(two, { "رنگ": "قرمز", "سایز": "L" }, "رنگ", "آبی")).toEqual({
            "رنگ": "آبی",
            "سایز": "M",
        });
    });

    test("optionsKey بدون حساسیت به ترتیب؛ toOptions/fromOptions رفت‌وبرگشت", () => {
        const a = [{ name: "سایز", value: "L" }, { name: "رنگ", value: "قرمز" }];
        const b = [{ name: "رنگ", value: "قرمز" }, { name: "سایز", value: "L" }];
        expect(optionsKey(a)).toBe(optionsKey(b));
        expect(optionsKey(undefined)).toBe("");
        expect(toOptions({ "رنگ": "قرمز" })).toEqual([{ name: "رنگ", value: "قرمز" }]);
        expect(fromOptions(toOptions({ "رنگ": "قرمز", "سایز": "L" }))).toEqual({
            "رنگ": "قرمز",
            "سایز": "L",
        });
    });

    test("withSelectedVariant قیمت/موجودی/تصویر variant را سوار می‌کند", () => {
        const view = withSelectedVariant(baseProduct, {
            id: "v2",
            price: 520000,
            stock: 2,
            options: [{ name: "رنگ", value: "قرمز" }],
            images: ["red.jpg"],
        });
        expect(view.price).toBe(520000);
        expect(view.countInStock).toBe(2);
        expect(view.image).toBe("red.jpg");
        expect(view.images).toEqual(["red.jpg"]);
        // محصول اصلی دست‌نخورده می‌ماند
        expect(baseProduct.price).toBe(500000);
    });

    test("withSelectedVariant بدون تصویر variant، تصویر محصول را نگه می‌دارد", () => {
        const view = withSelectedVariant(baseProduct, { ...variants[0], images: [] });
        expect(view.image).toBe("base.jpg");
        expect(view.images).toEqual(["base.jpg"]);
    });

    test("withSelectedVariant بعد از انقضای پروموشن قیمت پایه را برمی‌گرداند", () => {
        const expired = {
            ...baseProduct,
            price: 450000,
            discount: 0,
            isFlashDeal: false,
            isSpecialOffer: false,
        } as Product;
        const view = withSelectedVariant(expired, {
            id: "v",
            price: 450000,
            oldPrice: 500000,
            stock: 1,
            options: [{ name: "رنگ", value: "قرمز" }],
        });
        expect(view.price).toBe(500000);
        expect(view.oldPrice).toBeUndefined();
    });

    test("withSelectedVariant با variant خراب سقوط نمی‌کند", () => {
        expect(withSelectedVariant(baseProduct, undefined).price).toBe(500000);
        expect(withSelectedVariant(baseProduct, null as any).price).toBe(500000);
        const nanView = withSelectedVariant(baseProduct, {
            id: "x",
            price: NaN,
            stock: 1,
            options: [{ name: "رنگ", value: "قرمز" }],
        } as any);
        expect(nanView.price).toBe(500000);
    });

    test("priceRange و priceDiffFromMin", () => {
        expect(priceRange(variants)).toEqual({ min: 500000, max: 520000 });
        expect(priceRange([])).toBeNull();
        expect(priceDiffFromMin(variants, variants[1])).toBe(20000);
        expect(priceDiffFromMin(variants, variants[0])).toBe(0);
        expect(priceDiffFromMin(variants, undefined)).toBe(0);
    });

    test("تشخیص ناموجودی گزینه", () => {
        expect(isOptionOutOfStock(variants, { "رنگ": "مشکی" }, "رنگ", "زرد")).toBe(true);
        expect(isOptionOutOfStock(variants, { "رنگ": "مشکی" }, "رنگ", "قرمز")).toBe(false);
        expect(isOptionOutOfStock(variants, { "رنگ": "مشکی" }, "رنگ", "آبی")).toBe(false);
        expect(outOfStockValues(variants, { "رنگ": "مشکی" }, "رنگ")).toEqual(new Set(["زرد"]));
    });

    test("تشخیص ویژگی رنگی و hex", () => {
        const colorAttr = { name: "رنگ", values: ["قرمز", "مشکی"] } as ProductAttribute;
        const sizeAttr = { name: "سایز", values: ["S", "M"], displayType: "button" } as ProductAttribute;
        expect(isColorAttribute(colorAttr)).toBe(true);
        expect(isColorAttribute(sizeAttr)).toBe(false);
        expect(isColorAttribute({ name: "x", values: [] } as ProductAttribute)).toBe(false);
        expect(colorHexFor("قرمز", undefined)).toBe("#dc2626");
        expect(colorHexFor("قرمز", { "قرمز": "#111111" })).toBe("#111111");
        expect(colorHexFor("نامشخص")).toBe("#e5e7eb");
    });
});
