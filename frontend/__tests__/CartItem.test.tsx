import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CartItem from "@/components/cart/CartItem";

const baseItem = {
    id: "var1",
    name: "تی‌شرت",
    price: 520000,
    image: "/r.jpg",
    qty: 1,
};

describe("CartItem — نمایش گزینه‌های انتخابی", () => {
    it("مقادیر واقعی variantOptions را نشان می‌دهد", () => {
        render(
            <CartItem
                item={{
                    ...baseItem,
                    variantOptions: [
                        { name: "رنگ", value: "قرمز" },
                        { name: "سایز", value: "L" },
                    ],
                }}
                onIncrease={jest.fn()}
                onDecrease={jest.fn()}
            />,
        );

        expect(screen.getByText("رنگ: قرمز")).toBeInTheDocument();
        expect(screen.getByText("سایز: L")).toBeInTheDocument();
        // fallback قدیمی نباید باشد
        expect(screen.queryByText("رنگ / گزینه‌های انتخابی")).toBeNull();
    });

    it("بدون variantOptions همان fallback قبلی را نشان می‌دهد", () => {
        render(<CartItem item={baseItem} onIncrease={jest.fn()} onDecrease={jest.fn()} />);

        expect(screen.getByText("رنگ / گزینه‌های انتخابی")).toBeInTheDocument();
    });

    it("دکمه‌های تعداد کار می‌کنند", () => {
        const onIncrease = jest.fn();
        const onDecrease = jest.fn();
        render(
            <CartItem
                item={{ ...baseItem, variantOptions: [{ name: "رنگ", value: "قرمز" }] }}
                onIncrease={onIncrease}
                onDecrease={onDecrease}
            />,
        );

        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(onIncrease).toHaveBeenCalledTimes(1);
    });

    it("تصویر محصولِ اضافه‌شده را رندر می‌کند (رجگرسیون: قبلاً همیشه placeholder بود)", () => {
        render(
            <CartItem
                item={{ ...baseItem, image: "/uploads/tee-red.jpg" }}
                onIncrease={jest.fn()}
                onDecrease={jest.fn()}
            />,
        );

        const image = screen.getByRole("img", { name: "تی‌شرت" });
        expect(image).toHaveAttribute("src", "/uploads/tee-red.jpg");
    });

    it("برای تصویر خالی، placeholder سایت را می‌گذارد", () => {
        render(
            <CartItem
                item={{ ...baseItem, image: "" }}
                onIncrease={jest.fn()}
                onDecrease={jest.fn()}
            />,
        );

        expect(screen.getByRole("img", { name: "تی‌شرت" })).toHaveAttribute("src", "/placeholder.svg");
    });
});
