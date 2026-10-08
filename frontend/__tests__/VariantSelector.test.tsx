import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VariantSelector from "@/app/product/[...segments]/VariantSelector";
import type { ProductAttribute, ProductVariant } from "@/types/product";
import { initialSelection, findVariant } from "@/lib/variants";

const attributes: ProductAttribute[] = [
    { name: "رنگ", values: ["مشکی", "قرمز", "زرد"], displayType: "color" },
    { name: "سایز", values: ["M", "L"], displayType: "button" },
];

// رنگ×سایز: قرمز+L موجود نیست (ترکیب تعریف‌نشده)، زرد+M ناموجود (stock صفر)
const variants: ProductVariant[] = [
    { id: "v1", price: 500000, stock: 3, options: [{ name: "رنگ", value: "مشکی" }, { name: "سایز", value: "M" }] },
    { id: "v2", price: 520000, stock: 2, options: [{ name: "رنگ", value: "قرمز" }, { name: "سایز", value: "M" }] },
    { id: "v3", price: 500000, stock: 0, options: [{ name: "رنگ", value: "زرد" }, { name: "سایز", value: "M" }] },
    { id: "v4", price: 510000, stock: 1, options: [{ name: "رنگ", value: "مشکی" }, { name: "سایز", value: "L" }] },
];

function mount(selection = initialSelection(variants), onChange = jest.fn()) {
    const selectedVariant = findVariant(variants, selection);
    const utils = render(
        <VariantSelector
            attributes={attributes}
            variants={variants}
            selection={selection}
            selectedVariant={selectedVariant}
            onChange={onChange}
        />,
    );
    return { ...utils, onChange };
}

describe("VariantSelector — نمایش واریانت‌های ثبت‌شده", () => {
    it("نام ویژگی و مقدار انتخاب‌شده را نشان می‌دهد", () => {
        mount({ "رنگ": "مشکی", "سایز": "M" });
        expect(screen.getByText("رنگ: مشکی")).toBeInTheDocument();
        expect(screen.getByText("سایز: M")).toBeInTheDocument();
    });

    it("رنگ‌ها را دایره‌ای با رنگ واقعی و سایزها را دکمه‌ای رندر می‌کند", () => {
        const { container } = mount({ "رنگ": "مشکی", "سایز": "M" });
        const redCircle = screen.getByRole("button", { name: "رنگ قرمز" });
        const swatch = redCircle.querySelector("span");
        expect(swatch).toHaveStyle({ backgroundColor: "#dc2626" });
        // دکمه‌ی سایز متن دارد
        expect(screen.getByRole("button", { name: "M" })).toBeInTheDocument();
        expect(container.querySelector(".rounded-full")).not.toBeNull();
    });

    it("کلیک روی گزینه، onChange را با نام و مقدار درست صدا می‌زند", () => {
        const { onChange } = mount({ "رنگ": "مشکی", "سایز": "M" });
        fireEvent.click(screen.getByRole("button", { name: "رنگ قرمز" }));
        expect(onChange).toHaveBeenCalledWith("رنگ", "قرمز");
        // نام دسترس‌پذیر دکمه‌ی L شامل تگ «+۱۰٬۰۰۰» هم هست
        fireEvent.click(screen.getByRole("button", { name: /^L/ }));
        expect(onChange).toHaveBeenCalledWith("سایز", "L");
    });

    it("گزینه‌ی گران‌تر تگ اختلاف قیمت (+۲۰٬۰۰۰) دارد و ارزان‌ترین ندارد", () => {
        mount({ "رنگ": "مشکی", "سایز": "M" });
        // قرمز+M ارزان‌ترینش ۵۲۰٬۰۰۰ است → +۲۰٬۰۰۰ نسبت به ۵۰۰٬۰۰۰
        expect(screen.getByText(`+${(20000).toLocaleString("fa-IR")}`)).toBeInTheDocument();
    });

    it("گزینه‌ی ناموجود خط‌خورده است ولی قابل کلیک", () => {
        const { container, onChange } = mount({ "رنگ": "مشکی", "سایز": "M" });
        const yellow = screen.getByRole("button", { name: "رنگ زرد" });
        // خط قرمز روی دایره
        expect(yellow.querySelector(".bg-red-500")).not.toBeNull();
        fireEvent.click(yellow);
        expect(onChange).toHaveBeenCalledWith("رنگ", "زرد");
        expect(container).not.toBeEmptyDOMElement();
    });

    it("بازه‌ی قیمت ترکیب‌ها را راهنمایی می‌کند", () => {
        mount({ "رنگ": "مشکی", "سایز": "M" });
        expect(
            screen.getByText(
                `قیمت از ${(500000).toLocaleString("fa-IR")} تا ${(520000).toLocaleString("fa-IR")} تومان متغیر است`,
            ),
        ).toBeInTheDocument();
    });

    it("بدون attributes/variants هیچ‌چیز رندر نمی‌کند (محصول ساده امن است)", () => {
        const { container } = render(
            <VariantSelector
                attributes={[]}
                variants={[]}
                selection={{}}
                selectedVariant={undefined}
                onChange={jest.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});

describe("VariantSelector — چیدمان دسکتاپ متن‌های بلند (ریموت/تگ)", () => {
    const longAttributes: ProductAttribute[] = [
        {
            name: "ریموت و تگ",
            values: [
                "بدون ریموت و تگ",
                "همراه با دو عدد ریموت",
                "همراه با دو عدد تگ",
                "همراه با دو عدد ریموت و تگ",
            ],
            displayType: "button",
        },
    ];
    const longVariants: ProductVariant[] = [
        { id: "l1", price: 2700000, stock: 5, options: [{ name: "ریموت و تگ", value: "بدون ریموت و تگ" }] },
        { id: "l2", price: 3182500, stock: 5, options: [{ name: "ریموت و تگ", value: "همراه با دو عدد ریموت" }] },
        { id: "l3", price: 2850000, stock: 5, options: [{ name: "ریموت و تگ", value: "همراه با دو عدد تگ" }] },
        { id: "l4", price: 3325000, stock: 5, options: [{ name: "ریموت و تگ", value: "همراه با دو عدد ریموت و تگ" }] },
    ];

    function mountLong() {
        const selection = { "ریموت و تگ": "بدون ریموت و تگ" };
        return render(
            <VariantSelector
                attributes={longAttributes}
                variants={longVariants}
                selection={selection}
                selectedVariant={findVariant(longVariants, selection)}
                onChange={jest.fn()}
            />,
        );
    }

    it("متن بلند سقف ۲ ستون دارد (نه ۳ ستونه‌ی باریک دسکتاپ)", () => {
        const { container } = mountLong();
        const group = container.querySelector('[role="group"][aria-label="ریموت و تگ"]');
        expect(group).not.toBeNull();
        expect(group?.className).toMatch(/min-\[480px\]:grid-cols-2/);
        expect(group?.className).not.toMatch(/xl:grid-cols-3/);
    });

    it("هر ۴ گزینه با ارتفاع یکسان و چیپ اختلاف قیمت رندر می‌شوند", () => {
        const { container } = mountLong();
        const group = container.querySelector('[role="group"][aria-label="ریموت و تگ"]');
        const buttons = Array.from(group?.querySelectorAll("button") ?? []);
        expect(buttons).toHaveLength(4);
        for (const b of buttons) {
            expect(b.className).toMatch(/min-h-\[60px\]/);
            expect(b.className).toMatch(/w-full/);
        }
        // چیپ‌های اختلاف قیمت هر سه گزینه‌ی گران‌تر
        expect(screen.getByText(`+${(482500).toLocaleString("fa-IR")}`)).toBeInTheDocument();
        expect(screen.getByText(`+${(150000).toLocaleString("fa-IR")}`)).toBeInTheDocument();
        expect(screen.getByText(`+${(625000).toLocaleString("fa-IR")}`)).toBeInTheDocument();
    });

    it("متن کوتاه همچنان ۳ ستونه‌ی دسکتاپ می‌شود", () => {
        const { container } = render(
            <VariantSelector
                attributes={[{ name: "سایز", values: ["S", "M", "L", "XL"], displayType: "button" }]}
                variants={[
                    { id: "s1", price: 100000, stock: 2, options: [{ name: "سایز", value: "S" }] },
                    { id: "s2", price: 100000, stock: 2, options: [{ name: "سایز", value: "M" }] },
                    { id: "s3", price: 110000, stock: 2, options: [{ name: "سایز", value: "L" }] },
                    { id: "s4", price: 120000, stock: 2, options: [{ name: "سایز", value: "XL" }] },
                ]}
                selection={{ "سایز": "S" }}
                selectedVariant={undefined}
                onChange={jest.fn()}
            />,
        );
        const group = container.querySelector('[role="group"][aria-label="سایز"]');
        expect(group?.className).toMatch(/xl:grid-cols-3/);
    });
});
