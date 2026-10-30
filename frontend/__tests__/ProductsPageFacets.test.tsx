import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import ProductsPageClient from "@/app/products/ProductsPageClient";

const push = jest.fn();
let query = "";
let listingState: Record<string, unknown> = {};

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(query) }));
jest.mock("@/hooks/useScrollRestoration", () => ({ useScrollRestoration: () => {} }));
jest.mock("@/hooks/useCategoryFilterNavigation", () => ({ useCategoryFilterNavigation: () => ({ desktopCategoryRef: { current: null }, categoryFilterRequest: 0 }) }));
jest.mock("@/hooks/useCategories", () => ({ useCategoryTree: () => ({ categoryTree: [], isLoading: false }) }));
jest.mock("@/providers/RouteLoadingProvider", () => ({ useRouteLoadingState: () => ({ markRoutePending: jest.fn(), markRouteReady: jest.fn() }) }));
jest.mock("@/lib/scroll/ScrollManager", () => ({ getScrollManager: () => ({ clear: jest.fn() }) }));
jest.mock("@/hooks/useProductListing", () => ({ useProductListing: () => listingState }));
jest.mock("@/services/productService", () => ({ productService: { getCategoryBySlug: jest.fn(async () => null) } }));
jest.mock("@/services/brandService", () => ({
  brandService: { getAll: jest.fn(async () => []), getBySlug: jest.fn(async () => null) },
}));
jest.mock("@/components/product/ProductCard", () => ({
  __esModule: true,
  default: ({ product }: { product: { title?: string; name?: string } }) => <div data-testid="product-card">{product.title || product.name}</div>,
}));
jest.mock("@/components/product/ProductListingSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="listing-skeleton" />,
}));
jest.mock("rc-slider", () => ({ __esModule: true, default: () => <div /> }));
jest.mock("framer-motion", () => {
  const React = require("react");
  const Div = React.forwardRef(({ children, initial, animate, exit, transition, layout, ...props }: any, ref: any) => (
    <div ref={ref} {...props}>{children}</div>
  ));
  Div.displayName = "MotionDiv";
  return { motion: { div: Div }, AnimatePresence: ({ children }: any) => children };
});

const baseListing = {
  products: [] as Array<{ id: string; title: string }>,
  total: 0,
  totalPages: 1,
  currentPage: 1,
  priceRange: { min: 0, max: 1000 },
  isReady: true,
  isValidating: false,
  showSkeleton: false,
  showUpdating: false,
  showError: false,
  facets: undefined as unknown,
};

beforeEach(() => {
  query = "";
  push.mockClear();
  listingState = { ...baseListing };
  window.scrollTo = jest.fn();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  jest.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => ([{}] as unknown as DOMRectList));
});
afterEach(() => jest.restoreAllMocks());

it("renders brand counts in Persian digits next to each brand", async () => {
  listingState = {
    ...baseListing,
    total: 5,
    facets: {
      brands: [{ id: "b1", slug: "apple", name: "اپل", count: 12 }],
      properties: [],
    },
  };
  await act(async () => { render(<ProductsPageClient />); });
  const brandSection = screen.getByRole("button", { name: /برند/ }).closest("div");
  expect(screen.getByRole("button", { name: /اپل/ })).toBeInTheDocument();
  // شمارشگر فارسی در کنار نام برند
  expect(within(document.body).getByText((12).toLocaleString("fa-IR"))).toBeInTheDocument();
  expect(brandSection).toBeTruthy();
});

it("shows quick filter pills from top facets and applies one on click", async () => {
  listingState = {
    ...baseListing,
    total: 9,
    facets: {
      brands: [],
      properties: [
        {
          name: "رزولوشن",
          unit: "مگاپیکسل",
          isConfigured: true,
          isPinned: true,
          values: [
            { value: "4 مگاپیکسل", count: 6, isSelected: false },
            { value: "2 مگاپیکسل", count: 3, isSelected: false },
          ],
        },
        {
          name: "نوع باتری",
          isConfigured: true,
          values: [{ value: "لیتیوم-یون", count: 8, isSelected: false }],
        },
      ],
    },
  };
  await act(async () => { render(<ProductsPageClient />); });

  const pills = screen.getByRole("group", { name: "فیلترهای سریع" });
  const pill = within(pills).getByRole("button", { name: "رزولوشن: 4 مگاپیکسل" });
  expect(pill).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(pill);
  const params = new URLSearchParams(push.mock.calls.at(-1)[0].split("?")[1]);
  expect(params.getAll("prop_رزولوشن")).toEqual(["4 مگاپیکسل"]);
});

it("keeps the previous grid visible and shows no skeleton while revalidating", async () => {
  listingState = {
    ...baseListing,
    products: [{ id: "p1", title: "محصول قبلی" }],
    total: 1,
    showUpdating: true,
    isValidating: true,
  };
  await act(async () => { render(<ProductsPageClient />); });

  // اسکلتون کامل نباید ظاهر شود؛ گرید قبلی می‌ماند
  expect(screen.queryByTestId("listing-skeleton")).toBeNull();
  expect(screen.getByTestId("product-card")).toHaveTextContent("محصول قبلی");

  // نشانگر نرم به‌روزرسانی
  expect(screen.getAllByText("در حال به‌روزرسانی…").length).toBeGreaterThan(0);
  expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
});

it("shows the full skeleton only on the initial load with no data", async () => {
  listingState = { ...baseListing, showSkeleton: true, isValidating: true, products: [] };
  await act(async () => { render(<ProductsPageClient />); });
  expect(screen.getByTestId("listing-skeleton")).toBeInTheDocument();
});

it("offers an inner search for long property option lists", async () => {
  listingState = {
    ...baseListing,
    total: 20,
    facets: {
      brands: [],
      properties: [
        {
          name: "حافظه داخلی",
          isConfigured: true,
          values: Array.from({ length: 9 }, (_, index) => ({ value: `${(index + 1) * 32} گیگابایت`, count: 2, isSelected: false })),
        },
      ],
    },
  };
  await act(async () => { render(<ProductsPageClient />); });

  const search = screen.getByRole("textbox", { name: "جستجو در مقادیر حافظه داخلی" });
  // محتوای آکاردئون همان ویژگی (شامل فیلد جستجو و دکمه‌ها)
  const section = search.parentElement!.parentElement as HTMLElement;
  expect(within(section).getByRole("button", { name: /64 گیگابایت/ })).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "64" } });
  expect(within(section).getByRole("button", { name: /64 گیگابایت/ })).toBeInTheDocument();
  expect(within(section).queryByRole("button", { name: /96 گیگابایت/ })).toBeNull();
});

it("renders a colour swatch for colour properties", async () => {
  listingState = {
    ...baseListing,
    total: 4,
    facets: {
      brands: [],
      properties: [
        { name: "رنگ", isConfigured: true, values: [{ value: "مشکی", count: 4, isSelected: false }] },
      ],
    },
  };
  await act(async () => { render(<ProductsPageClient />); });

  const colorButton = screen.getByRole("button", { name: /مشکی/ });
  const swatch = colorButton.querySelector("span[aria-hidden='true']");
  expect(swatch).toBeTruthy();
  expect((swatch as HTMLElement).style.backgroundColor).toBeTruthy();
});
