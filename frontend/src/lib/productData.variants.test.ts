import { mapBackendProduct } from "@/lib/productData";

const API_URL = "http://127.0.0.1:5000/api";

describe("mapBackendProduct — محصول متغیر (مسیر SSR)", () => {
    const backendVariable: any = {
        _id: "var1",
        name: "تی‌شرت متغیر",
        productType: "variable",
        price: 0,
        stock: 0,
        discount: 0,
        images: ["/uploads/base.png"],
        attributes: [
            { name: "رنگ", values: ["مشکی", "قرمز"], displayType: "color", swatches: [] },
            { name: "سایز", values: ["M", "L"] },
        ],
        variants: [
            {
                _id: "v1",
                sku: "SKU-B",
                price: 500000,
                stock: 3,
                options: [
                    { name: "رنگ", value: "مشکی" },
                    { name: "سایز", value: "M" },
                ],
                images: [{ url: "/uploads/black.png" }],
            },
            {
                _id: "v2",
                price: 520000,
                stock: 0,
                options: [
                    { name: "رنگ", value: "قرمز" },
                    { name: "سایز", value: "M" },
                ],
                images: [],
            },
        ],
    };

    it("variantها، ارزان‌ترین قیمت و مجموع موجودی را می‌سازد", () => {
        const p = mapBackendProduct(backendVariable, API_URL);

        expect(p.productType).toBe("variable");
        expect(p.variants).toHaveLength(2);
        expect(p.variants![0]).toMatchObject({
            id: "v1",
            sku: "SKU-B",
            price: 500000,
            stock: 3,
        });
        // تصویر نسبی variant با assetBase کامل می‌شود؛ variant بدون تصویر → [] (نه fallback محصول)
        expect(p.variants![0].images).toEqual(["http://127.0.0.1:5000/uploads/black.png"]);
        expect(p.variants![1].images).toEqual([]);
        // سطح کارت: ارزان‌ترین + مجموع (دیگر «ناموجود» نیست)
        expect(p.price).toBe(500000);
        expect(p.countInStock).toBe(3);
        // تصویر اصلی محصول از images خودش می‌آید
        expect(p.image).toBe("http://127.0.0.1:5000/uploads/base.png");
        // attributes با displayType
        expect(p.attributes).toHaveLength(2);
        expect(p.attributes![0].displayType).toBe("color");
        expect(p.attributes![1].displayType).toBeUndefined();
    });

    it("تخفیف فعال روی تک‌تک variantها اعمال می‌شود", () => {
        const p = mapBackendProduct(
            {
                ...backendVariable,
                discount: 20,
                isSpecialOffer: true,
                specialOfferEndTime: "2099-01-01T00:00:00.000Z",
            },
            API_URL,
        );

        expect(p.variants![0].price).toBe(400000);
        expect(p.variants![0].oldPrice).toBe(500000);
        expect(p.price).toBe(400000);
    });

    it("مدل مستثنی از تخفیف: قیمت پایه می‌ماند و دوباره تخفیف نمی‌خورد", () => {
        const p = mapBackendProduct(
            {
                ...backendVariable,
                discount: 20,
                isSpecialOffer: true,
                specialOfferEndTime: "2099-01-01T00:00:00.000Z",
                variants: [
                    {
                        _id: "v1",
                        price: 500000,
                        stock: 3,
                        options: [{ name: "رنگ", value: "مشکی" }],
                        excludeFromPromotion: true,
                    },
                    {
                        _id: "v2",
                        price: 520000,
                        stock: 2,
                        options: [{ name: "رنگ", value: "قرمز" }],
                    },
                ],
            },
            API_URL,
        );

        // مستثنی: قیمت پایه بدون oldPrice
        expect(p.variants![0].price).toBe(500000);
        expect(p.variants![0].oldPrice).toBeUndefined();
        expect(p.variants![0].excludeFromPromotion).toBe(true);
        // غیرمستثنی: تخفیف خورده
        expect(p.variants![1].price).toBe(416000);
        expect(p.variants![1].oldPrice).toBe(520000);
        expect(p.variants![1].excludeFromPromotion).toBeUndefined();
    });

    it("داکیومنت قدیمی بدون پرچم productType ولی با مدل‌ها، متغیر شناخته می‌شود", () => {
        const { productType: _drop, ...legacy } = backendVariable as any;
        const p = mapBackendProduct(
            {
                ...legacy,
                price: 1000000,
                discount: 20,
                stock: 0,
                isSpecialOffer: true,
                specialOfferEndTime: "2099-01-01T00:00:00.000Z",
            },
            API_URL,
        );

        expect(p.productType).toBe("variable");
        expect(p.variants).toHaveLength(2);
        // قیمت سطح کارت از مدل‌ها می‌آید، نه قیمت پایه‌ی سطح محصول
        expect(p.price).toBe(400000);
        expect(p.countInStock).toBe(3);
    });

    it("محصول ساده دقیقاً مثل قبل مپ می‌شود", () => {
        const p = mapBackendProduct(
            { _id: "s1", name: "ساده", price: 100000, discount: 0, stock: 7 },
            API_URL,
        );

        expect(p.productType).toBe("simple");
        expect(p.variants).toEqual([]);
        expect(p.attributes).toEqual([]);
        expect(p.price).toBe(100000);
        expect(p.countInStock).toBe(7);
    });
});
