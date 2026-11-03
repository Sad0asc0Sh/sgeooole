import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Footer from "./Footer";
import { settingsService } from "@/services/settingsService";
import { useAuth } from "@/hooks/useAuth";
import { useCategoryTree } from "@/hooks/useCategories";
import api from "@/lib/api";

jest.mock("next/navigation", () => ({
    // Off-homepage path: the brand story starts expanded only on "/".
    usePathname: () => "/products",
}));

jest.mock("@/services/settingsService", () => ({
    settingsService: {
        getPublicSettings: jest.fn(),
    },
}));

jest.mock("@/hooks/useAuth", () => ({
    useAuth: jest.fn(),
}));

jest.mock("@/hooks/useCategories", () => ({
    useCategoryTree: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
    },
}));

describe("Footer architectural widescreen & brand positioning", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (useAuth as jest.Mock).mockReturnValue({
            isAuthenticated: false,
        });

        (useCategoryTree as jest.Mock).mockReturnValue({
            categoryTree: [],
        });

        (settingsService.getPublicSettings as jest.Mock).mockResolvedValue({
            data: {
                storeName: "ای‌کا‌جی کالا",
                storeEmail: "info@ekgkala.ir",
                storePhone: "09357702869",
                storeAddress: "مشهد، بلوار پیروزی ۷۵، پلاک ۱۱",
                socialLinks: {
                    telegram: "https://t.me/ekgkala",
                    instagram: "https://instagram.com/ekgkala",
                },
            },
        });
    });

    it("renders broad technology trust pillars, expandable brand story, Enamad seal, and smooth back-to-top", async () => {
        const scrollSpy = jest.fn();
        Object.defineProperty(window, "scrollTo", {
            value: scrollSpy,
            writable: true,
        });

        const { container } = render(<Footer />);

        // Broad 4-pillar trust strip
        expect(screen.getByText("تنوع گسترده کالای تکنولوژی")).toBeInTheDocument();
        expect(screen.getByText("تضمین اصالت و سلامت کالا")).toBeInTheDocument();
        expect(screen.getByText("ارسال سریع به سراسر کشور")).toBeInTheDocument();
        expect(screen.getByText("پرداخت امن و تحویل حضوری")).toBeInTheDocument();

        // Expandable SEO & supplier-network story toggle
        const expandBtn = screen.getByRole("button", { name: /مشاهده بیشتر/i });
        expect(expandBtn).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(expandBtn);
        expect(expandBtn).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("button", { name: /بستن توضیحات/i })).toBeInTheDocument();

        // Inline back-to-top control
        const backToTopBtn = screen.getByRole("button", { name: "بازگشت به بالا" });
        fireEvent.click(backToTopBtn);
        expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

        // Enamad seal preserved
        const enamadAnchor = container.querySelector('a[href*="trustseal.enamad.ir/?id=693453"]');
        expect(enamadAnchor).not.toBeNull();

        // Dynamic settings fetched & rendered cleanly
        await waitFor(() => {
            expect(screen.getByText("مشهد، بلوار پیروزی ۷۵، پلاک ۱۱")).toBeInTheDocument();
            expect(screen.getByText("info@ekgkala.ir")).toBeInTheDocument();
            expect(screen.getByTitle("تلگرام")).toHaveAttribute("href", "https://t.me/ekgkala");
            expect(screen.getByTitle("اینستاگرام")).toHaveAttribute(
                "href",
                "https://instagram.com/ekgkala"
            );
        });
    });

    it("contains zero links to removed /compare, /glossary, or /guides routes while keeping /blog", async () => {
        const { container } = render(<Footer />);
        await waitFor(() => expect(settingsService.getPublicSettings).toHaveBeenCalled());

        const allHrefs = Array.from(container.querySelectorAll("a"))
            .map((a) => a.getAttribute("href") || "");

        expect(allHrefs.some((h) => h.startsWith("/compare"))).toBe(false);
        expect(allHrefs.some((h) => h.startsWith("/glossary"))).toBe(false);
        expect(allHrefs.some((h) => h.startsWith("/guides"))).toBe(false);
        expect(allHrefs.some((h) => h.includes("wa.me") || h.includes("whatsapp"))).toBe(false);
        expect(allHrefs.some((h) => h === "/blog")).toBe(true);
        expect(allHrefs.some((h) => h === "/profile/tickets")).toBe(true);
    });

    it("adapts customer links for authenticated users and renders live categories from API", async () => {
        (useAuth as jest.Mock).mockReturnValue({
            isAuthenticated: true,
        });
        (useCategoryTree as jest.Mock).mockReturnValue({
            categoryTree: [
                { _id: "1", name: "گجت و کالای دیجیتال", slug: "digital-gadgets", isActive: true },
                { _id: "2", name: "لوازم هوشمند خانگی", slug: "smart-home", isActive: true },
            ],
        });

        render(<Footer />);
        await waitFor(() => expect(settingsService.getPublicSettings).toHaveBeenCalled());

        expect(screen.getByRole("link", { name: "پیگیری سفارش" })).toHaveAttribute(
            "href",
            "/profile/orders?status=current"
        );
        expect(screen.getByRole("link", { name: "پنل کاربری من" })).toHaveAttribute(
            "href",
            "/profile"
        );
        expect(screen.getByRole("link", { name: "گجت و کالای دیجیتال" })).toHaveAttribute(
            "href",
            "/products?category=digital-gadgets&includeChildren=true"
        );

        // Mobile accordion toggle updates aria-expanded cleanly
        const customersToggle = screen.getByRole("button", { name: "خدمات مشتریان" });
        expect(customersToggle).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(customersToggle);
        expect(customersToggle).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(customersToggle);
        expect(customersToggle).toHaveAttribute("aria-expanded", "false");
    });

    it("validates and submits the newsletter subscription form", async () => {
        (api.post as jest.Mock).mockResolvedValueOnce({
            data: { message: "ایمیل شما با موفقیت ثبت شد" },
        });

        render(<Footer />);
        await waitFor(() => expect(settingsService.getPublicSettings).toHaveBeenCalled());

        const input = screen.getByLabelText("آدرس ایمیل برای عضویت در خبرنامه");
        const submitBtn = screen.getByRole("button", { name: /ثبت عضویت/i });

        fireEvent.change(input, { target: { value: "invalid-email" } });
        fireEvent.click(submitBtn);
        expect(await screen.findByRole("alert")).toHaveTextContent("فرمت ایمیل نامعتبر است");
        expect(api.post).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: "customer@ekgkala.ir" } });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/newsletter/subscribe", {
                email: "customer@ekgkala.ir",
                source: "footer",
            });
            expect(screen.getByRole("status")).toHaveTextContent("ایمیل شما با موفقیت ثبت شد");
        });
    });

    it("keeps Footer.module.css widescreen-ready and strictly legacy-browser-safe", () => {
        const cssPath = path.join(__dirname, "Footer.module.css");
        const rawCss = fs.readFileSync(cssPath, "utf8");
        const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");

        expect(css).toContain("max-width: 1920px");
        expect(css).not.toMatch(/oklch\(/i);
        expect(css).not.toMatch(/color-mix\(/i);
        expect(css).not.toMatch(/in\s+oklab/i);
        expect(css).not.toMatch(/clamp\(/i);
        expect(css).not.toMatch(/(?:^|\s)inset\s*:/m);
    });
});
