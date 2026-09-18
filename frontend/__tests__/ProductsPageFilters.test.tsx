import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import ProductsPageClient from "@/app/products/ProductsPageClient";

const push = jest.fn();
let query = "page=3";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(query) }));
jest.mock("@/hooks/useScrollRestoration", () => ({ useScrollRestoration: () => {} }));
jest.mock("@/hooks/useCategoryFilterNavigation", () => ({ useCategoryFilterNavigation: () => ({ desktopCategoryRef: { current: null }, categoryFilterRequest: 0 }) }));
jest.mock("@/hooks/useCategories", () => ({ useCategoryTree: () => ({ categoryTree: [], isLoading: false }) }));
jest.mock("@/providers/RouteLoadingProvider", () => ({ useRouteLoadingState: () => ({ markRoutePending: jest.fn(), markRouteReady: jest.fn() }) }));
jest.mock("@/lib/scroll/ScrollManager", () => ({ getScrollManager: () => ({ clear: jest.fn() }) }));
jest.mock("@/hooks/useProductListing", () => ({ useProductListing: () => ({ products: [], total: 0, totalPages: 1, currentPage: 1, priceRange: { min: 0, max: 1000 }, isReady: true, isValidating: false, showSkeleton: false, showError: false }) }));
jest.mock("@/services/productService", () => ({ productService: { getCategoryBySlug: jest.fn(async () => null) } }));
jest.mock("@/services/brandService", () => ({ brandService: { getAll: jest.fn(async () => []), getBySlug: jest.fn(async () => null) } }));
jest.mock("@/components/product/ProductCard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/product/ProductListingSkeleton", () => ({ __esModule: true, default: () => null }));
jest.mock("rc-slider", () => ({ __esModule: true, default: () => <div /> }));
jest.mock("framer-motion", () => {
  const React = require("react");
  const Div = React.forwardRef(({ children, initial, animate, exit, transition, layout, ...props }: any, ref: any) => <div ref={ref} {...props}>{children}</div>);
  Div.displayName = "MotionDiv";
  return { motion: { div: Div }, AnimatePresence: ({ children }: any) => children };
});

beforeEach(() => {
  query = "page=3";
  push.mockClear();
  window.scrollTo = jest.fn();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  jest.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => ([{}] as unknown as DOMRectList));
});
afterEach(() => jest.restoreAllMocks());

it("keeps mobile filters open, composes rapid toggles, resets page, and restores focus on Escape", async () => {
  await act(async () => { render(<ProductsPageClient />); });
  const opener = screen.getByRole("button", { name: /^فیلترها/ });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "فیلترها" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  const close = within(dialog).getByRole("button", { name: "بستن فیلترها" });
  expect(close).toHaveFocus();
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "فقط کالاهای موجود" }));
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "فقط کالاهای تخفیف‌دار" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  const params = new URLSearchParams(push.mock.calls.at(-1)[0].split("?")[1]);
  expect(params.get("inStock")).toBe("true");
  expect(params.get("onSale")).toBe("true");
  expect(params.has("page")).toBe(false);
  const buttons = within(dialog).getAllByRole("button");
  buttons.at(-1)!.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});

it("opens the labelled sort dialog and closes it with Escape", async () => {
  await act(async () => { render(<ProductsPageClient />); });
  fireEvent.click(screen.getByRole("button", { name: "مرتب‌سازی" }));
  const dialog = screen.getByRole("dialog", { name: "مرتب‌سازی بر اساس" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("sort selection preserves filters, resets page, and presents only the core 6 options", async () => {
  query = "page=3&category=cameras&inStock=true&sort=newest";
  await act(async () => { render(<ProductsPageClient />); });
  const buttons = screen.getAllByRole("button", { name: /ارزان‌ترین/ });
  const desktop = buttons.find((button) => button.closest('[aria-label="مرتب‌سازی محصولات"]'));
  fireEvent.click(desktop || buttons[0]);
  const params = new URLSearchParams(push.mock.calls.at(-1)[0].split("?")[1]);
  expect(params.get("sort")).toBe("priceAsc");
  expect(params.get("category")).toBe("cameras");
  expect(params.get("inStock")).toBe("true");
  expect(params.has("page")).toBe(false);

  // Verify only the clean 5 sort options exist (bestSelling is removed)
  const sortGroup = screen.getByLabelText("مرتب‌سازی محصولات");
  expect(within(sortGroup).getByRole("button", { name: /جدیدترین/ })).toBeInTheDocument();
  expect(within(sortGroup).getByRole("button", { name: /ارزان‌ترین/ })).toBeInTheDocument();
  expect(within(sortGroup).getByRole("button", { name: /گران‌ترین/ })).toBeInTheDocument();
  expect(within(sortGroup).getByRole("button", { name: /محبوب‌ترین/ })).toBeInTheDocument();
  expect(within(sortGroup).getByRole("button", { name: /بیشترین تخفیف/ })).toBeInTheDocument();
  expect(within(sortGroup).queryByRole("button", { name: /پرفروش‌ترین/ })).toBeNull();
  expect(within(sortGroup).queryByRole("button", { name: /مرتبط‌ترین/ })).toBeNull();
  expect(within(sortGroup).queryByRole("button", { name: /قدیمی‌ترین/ })).toBeNull();
  expect(within(sortGroup).queryByRole("button", { name: /نام/ })).toBeNull();
});
