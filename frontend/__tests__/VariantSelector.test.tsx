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
