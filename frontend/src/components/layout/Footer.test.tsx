import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import Footer from "./Footer";
import { settingsService } from "@/services/settingsService";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useCategoryTree } from "@/hooks/useCategories";

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children, ...rest }: any) => (
        <a href={typeof href === "string" ? href : String(href)} {...rest}>
            {children}
        </a>
    ),
}));

jest.mock("@/services/settingsService", () => ({
    settingsService: {
        getPublicSettings: jest.fn(),
    },
}));

jest.mock("@/lib/api", () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
    },
}));

jest.mock("@/hooks/useAuth", () => ({
    useAuth: jest.fn(),
}));

jest.mock("@/hooks/useCategories", () => ({
    useCategoryTree: jest.fn(),
}));

const mockedGetPublicSettings = settingsService.getPublicSettings as jest.Mock;
const mockedApiPost = api.post as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedUseCategoryTree = useCategoryTree as jest.Mock;

describe("Footer component (Technolife-inspired architectural island for EKG KALA)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseAuth.mockReturnValue({ isAuthenticated: false });
        mockedUseCategoryTree.mockReturnValue({ categoryTree: [], isLoading: false });
        mockedGetPublicSettings.mockResolvedValue({
            data: {
                storeName: "ای‌کا‌جی کالا",
                storeEmail: "info@ekgkala.ir",
                storePhone: "051-35013383",
                storeAddress: "مشهد، بلوار پیروزی ۷۵، بین ولایتی ۹ و ۱۱",
                socialLinks: {
                    telegram: "https://t.me/ekgkala",
                    instagram: "https://instagram.com/ekgkala",
                    aparat: "https://aparat.com/ekgkala",
                },
            },
        });
    });

    it("renders pre-footer trust strip, official dealerships, Mashhad branch phones, and real Enamad seal", async () => {
        const { container } = render(<Footer />);

        await waitFor(() => {
            expect(mockedGetPublicSettings).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByText("ارسال سریع به سراسر کشور")).toBeInTheDocument();
        expect(screen.getByText("تیم تخصصی نصب و تعمیرات")).toBeInTheDocument();
        expect(screen.getByText("ضمانت اصالت و گارانتی معتبر")).toBeInTheDocument();
        expect(screen.getByText("پرداخت امن و تحویل حضوری")).toBeInTheDocument();

        // Official Khorasan dealerships (featured in both SEO story and partner showcase)
        expect(screen.getAllByText("Dahua").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Sailgis").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Suzuki").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Vekra & Mover").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("HSP").length).toBeGreaterThanOrEqual(1);

        // Real branch phones & Enamad ID 693453
        expect(screen.getByText("051-35013383")).toBeInTheDocument();
        expect(screen.getByText("051-37136355")).toBeInTheDocument();
        expect(container.innerHTML).toContain("trustseal.enamad.ir/?id=693453");

        // Dynamic social links & email from public settings
        await waitFor(() => {
            expect(screen.getByTitle("تلگرام")).toHaveAttribute("href", "https://t.me/ekgkala");
            expect(screen.getByTitle("اینستاگرام")).toHaveAttribute("href", "https://instagram.com/ekgkala");
            expect(screen.getByTitle("آپارات")).toHaveAttribute("href", "https://aparat.com/ekgkala");
            expect(screen.getByText("info@ekgkala.ir")).toBeInTheDocument();
        });
    });

    it("toggles the pre-footer expandable SEO article cleanly", async () => {
        render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalled());

        const toggleBtn = screen.getByRole("button", { name: /مشاهده بیشتر/i });
        expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
        expect(toggleBtn).toHaveTextContent("بستن توضیحات");

        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
        expect(toggleBtn).toHaveTextContent("مشاهده بیشتر");
    });

    it("toggles mobile navigation accordions as a single-open group", async () => {
        render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalled());

        const catToggle = screen.getByRole("button", { name: "دسته‌بندی محصولات" });
        const guideToggle = screen.getByRole("button", { name: "راهنمای خرید و مقایسه" });

        expect(catToggle).toHaveAttribute("aria-expanded", "false");
        expect(guideToggle).toHaveAttribute("aria-expanded", "false");

        fireEvent.click(catToggle);
        expect(catToggle).toHaveAttribute("aria-expanded", "true");
        expect(guideToggle).toHaveAttribute("aria-expanded", "false");

        fireEvent.click(guideToggle);
        expect(catToggle).toHaveAttribute("aria-expanded", "false");
        expect(guideToggle).toHaveAttribute("aria-expanded", "true");
    });

    it("scrolls smoothly to top when inline Back-to-Top pill is clicked", async () => {
        const scrollToSpy = jest.fn();
        Object.defineProperty(window, "scrollTo", { value: scrollToSpy, writable: true });

        render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalled());

        fireEvent.click(screen.getByRole("button", { name: "بازگشت به بالا" }));
        expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });

    it("adapts order tracking, support, and account links based on authentication state", async () => {
        const { unmount } = render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalled());

        expect(screen.getByRole("link", { name: "پیگیری سفارش" })).toHaveAttribute("href", "/tracking");
        expect(screen.getByRole("link", { name: "ورود / ثبت‌نام" })).toHaveAttribute("href", "/login");

        unmount();

        mockedUseAuth.mockReturnValue({ isAuthenticated: true });
        render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalled());

        expect(screen.getByRole("link", { name: "پیگیری سفارش" })).toHaveAttribute(
            "href",
            "/profile/orders?status=current"
        );
        expect(screen.getByRole("link", { name: "پنل کاربری من" })).toHaveAttribute("href", "/profile");
    });

    it("renders live categories from useCategoryTree when available", async () => {
        mockedUseCategoryTree.mockReturnValue({
            categoryTree: [
                { _id: "1", name: "دوربین تحت شبکه داهوا", slug: "dahua-ip", isActive: true },
                { _id: "2", name: "جک پارکینگی سوزوکی", slug: "suzuki-gate", isActive: true },
            ],
            isLoading: false,
        });

        render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalled());

        expect(screen.getByRole("link", { name: "دوربین تحت شبکه داهوا" })).toHaveAttribute(
            "href",
            "/products?category=dahua-ip&includeChildren=true"
        );
        expect(screen.getByRole("link", { name: "جک پارکینگی سوزوکی" })).toHaveAttribute(
            "href",
            "/products?category=suzuki-gate&includeChildren=true"
        );
    });

    it("validates newsletter email format and submits valid email to /newsletter/subscribe", async () => {
        mockedApiPost.mockResolvedValueOnce({ data: { message: "ایمیل شما با موفقیت ثبت شد" } });

        render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalled());

        const input = screen.getByLabelText("آدرس ایمیل برای عضویت در خبرنامه");
        const submitBtn = screen.getByRole("button", { name: /ثبت ایمیل/i });

        fireEvent.change(input, { target: { value: "invalid-email" } });
        fireEvent.click(submitBtn);

        expect(await screen.findByRole("alert")).toHaveTextContent("فرمت ایمیل نامعتبر است");
        expect(mockedApiPost).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: "user@example.com" } });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockedApiPost).toHaveBeenCalledWith("/newsletter/subscribe", {
                email: "user@example.com",
                source: "footer",
            });
        });

        expect(await screen.findByRole("status")).toHaveTextContent("ایمیل شما با موفقیت ثبت شد");
    });

    it("refreshes store settings when settings:updated window event fires", async () => {
        render(<Footer />);
        await waitFor(() => expect(mockedGetPublicSettings).toHaveBeenCalledTimes(1));

        mockedGetPublicSettings.mockResolvedValueOnce({
            data: {
                storeName: "فروشگاه مرکزی کیان",
                storePhone: "051-38889900",
            },
        });

        await act(async () => {
            window.dispatchEvent(new Event("settings:updated"));
        });

        await waitFor(() => {
            expect(mockedGetPublicSettings).toHaveBeenCalledTimes(2);
            expect(screen.getAllByText("فروشگاه مرکزی کیان").length).toBeGreaterThan(0);
            expect(screen.getByText("051-38889900")).toBeInTheDocument();
        });
    });

    it("keeps Footer.module.css 100% legacy-browser safe (Chrome >= 80, Safari >= 12)", () => {
        const css = readFileSync(join(__dirname, "Footer.module.css"), "utf8");
        // Strip comments before checking CSS declarations
        const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
        expect(stripped).not.toContain("oklch(");
        expect(stripped).not.toContain("color-mix(");
        expect(stripped).not.toContain("in oklab");
        expect(stripped).not.toContain("clamp(");
        expect(stripped).not.toMatch(/\binset\s*:/);
    });
});
