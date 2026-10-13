import { withSelectedVariant } from "@/lib/variants";
import type { Product, ProductVariant } from "@/types/product";

const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

const mkVariant = (id: string, price: number, excluded: boolean): ProductVariant => ({
    id,
    price,
    stock: 4,
    options: [{ name: "رنگ", value: id }],
    ...(excluded ? { excludeFromPromotion: true } : { oldPrice: price + 20000 }),
});

const saleProduct = {
    id: "p1",
    name: "محصول",
    price: 80000,
    oldPrice: 100000,
    compareAtPrice: 100000,
    discount: 20,
    isSpecialOffer: true,
    specialOfferEndTime: future,
    campaignLabel: "فروش ویژه عید",
    campaignTheme: "red-purple",
    image: "/a.jpg",
    images: ["/a.jpg"],
    countInStock: 8,
} as unknown as Product;

describe("withSelectedVariant — متغیر مستثنی از تخفیف", () => {
    it("متغیر مستثنی: قیمت پایه و هیچ اثری از لیبل/تایمر/درصد Sale", () => {
        const out = withSelectedVariant(saleProduct, mkVariant("قرمز", 120000, true));
        expect(out.price).toBe(120000);
        expect(out.oldPrice).toBeUndefined();
        expect(out.compareAtPrice).toBeUndefined();
        expect(out.discount).toBe(0);
        expect(out.isSpecialOffer).toBe(false);
        expect(out.isFlashDeal).toBe(false);
        expect(out.specialOfferEndTime).toBeUndefined();
        expect(out.campaignLabel).toBeUndefined();
        expect(out.campaignTheme).toBeUndefined();
        expect(out.countInStock).toBe(4);
    });

    it("متغیر مشمول: پروموشن محصول دست‌نخورده می‌ماند", () => {
        const out = withSelectedVariant(saleProduct, mkVariant("سبز", 80000, false));
        expect(out.discount).toBe(20);
        expect(out.campaignLabel).toBe("فروش ویژه عید");
        expect(out.isSpecialOffer).toBe(true);
        expect(out.oldPrice).toBe(100000);
    });

    it("بدون متغیر انتخاب‌شده: محصول بدون تغییر برمی‌گردد", () => {
        expect(withSelectedVariant(saleProduct, null)).toBe(saleProduct);
    });
});
