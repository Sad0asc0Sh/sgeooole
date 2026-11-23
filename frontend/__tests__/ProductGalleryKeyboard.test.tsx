import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ProductGallery from "@/app/product/[...segments]/ProductGallery";
import type { Product } from "@/types/product";

jest.mock("framer-motion", () => {
    const React = require("react");
    return {
        motion: { div: React.forwardRef(function MockMotionDiv({ initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any, ref: any) { return <div ref={ref} {...props} />; }) },
        AnimatePresence: ({ children }: any) => <>{children}</>,
    };
});
jest.mock("swiper/react", () => ({
    Swiper: ({ children, role, tabIndex, onClick, onKeyDown, "aria-label": label }: any) =>
        <div role={role} tabIndex={tabIndex} onClick={onClick} onKeyDown={onKeyDown} aria-label={label}>{children}</div>,
    SwiperSlide: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("swiper/modules", () => ({ Pagination: {}, Zoom: {}, Navigation: {} }));

const product: Product = {
    id: "gallery-test", name: "محصول", title: "محصول", price: 100,
    discount: 0, image: "/placeholder.svg", images: ["/placeholder.svg", "/second.svg"],
    category: "test", rating: 0, reviewCount: 0, countInStock: 2,
};

it("keeps keyboard focus in the gallery and restores focus and scrolling on Escape", () => {
    const scroll = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.body.style.overflow = "auto";
    render(<ProductGallery product={product} />);
    const trigger = screen.getByRole("button", { name: "باز کردن گالری تصاویر محصول" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "بستن گالری تصاویر" });
    const thumbnails = within(dialog).getAllByRole("button", { name: /نمایش تصویر/ });
    expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(thumbnails[1]).toHaveFocus();
    fireEvent.keyDown(thumbnails[1], { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
    scroll.mockRestore();
});

it("starts the selected photo immediately and uses the matching alternate size on failure", () => {
    render(<ProductGallery product={{
        ...product,
        images: ["/first.webp", "/second.webp"],
        cardImages: ["/first-card.webp", "/second-card.webp"],
    }} />);
    const button = screen.getByRole("button", { name: "نمایش تصویر ۲" });
    const secondPhoto = () => screen.getByRole("img", { name: "محصول - نمای ۲" });
    expect(secondPhoto()).toHaveAttribute("loading", "lazy");
    expect(button.querySelector("img")).toHaveAttribute("src", "/second-card.webp");

    fireEvent.error(button.querySelector("img")!);
    expect(button.querySelector("img")).toHaveAttribute("src", "/second.webp");

    fireEvent.click(button);
    expect(secondPhoto()).toHaveAttribute("loading", "eager");
    fireEvent.error(secondPhoto());
    expect(secondPhoto()).toHaveAttribute("src", "/second-card.webp");
});
