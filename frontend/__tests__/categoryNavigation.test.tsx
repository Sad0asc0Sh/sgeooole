import { act, render, renderHook, screen } from "@testing-library/react";
import { useCategoryFilterNavigation } from "@/hooks/useCategoryFilterNavigation";
import { CATEGORY_FILTER_HREF } from "@/lib/categoryNavigation";
import CategoriesPage from "@/app/categories/page";
import CategoryPage from "@/app/categories/[slug]/page";
import { permanentRedirect } from "next/navigation";

jest.mock("next/navigation", () => ({ permanentRedirect: jest.fn() }));

jest.mock("@/services/categoryService", () => ({
  categoryService: { getTree: jest.fn() },
}));

let desktop = false;
let resize: () => void;
beforeEach(() => {
  jest.clearAllMocks();
  desktop = false;
  window.history.replaceState(null, "", CATEGORY_FILTER_HREF);
  Object.defineProperty(window, "matchMedia", { configurable: true, value: jest.fn(() => ({
    get matches() { return desktop; },
    addEventListener: (_event: string, listener: () => void) => { resize = listener; },
    removeEventListener: jest.fn(),
  })) });
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

test("serves a real category index page instead of a redirect", async () => {
  const { categoryService } = await import("@/services/categoryService");
  (categoryService.getTree as jest.Mock).mockResolvedValue([
    { _id: "root-1", name: "موبایل", slug: "mobile", showOnHomepage: true, homepageOrder: 0, order: 0, isActive: true },
  ]);
  const page = await CategoriesPage();
  expect(permanentRedirect).not.toHaveBeenCalled();
  render(page);
  // Both responsive branches render server-side; each carries the rail.
  await act(async () => {});
  expect(screen.getAllByRole("button", { name: "موبایل" })).toHaveLength(2);
});

test("opens a bookmarked category at its encoded listing URL", async () => {
  const slug = "قفل-و-ریموت";
  await CategoryPage({ params: Promise.resolve({ slug }) });
  expect(permanentRedirect).toHaveBeenCalledWith(`/products?category=${encodeURIComponent(slug)}&includeChildren=true`);
});

test("opens the existing mobile filters for a category deep link", () => {
  const setShowFilters = jest.fn();
  const { result } = renderHook(() => useCategoryFilterNavigation(setShowFilters));
  expect(setShowFilters).toHaveBeenCalledWith(true);
  expect(result.current.categoryFilterRequest).toBe(1);
});

test("does not open filters on an ordinary products visit", () => {
  window.history.replaceState(null, "", "/products?sort=newest");
  const setShowFilters = jest.fn();
  renderHook(() => useCategoryFilterNavigation(setShowFilters));
  expect(setShowFilters).not.toHaveBeenCalled();
});

test("targets desktop categories without opening a hidden mobile sheet", () => {
  desktop = true;
  const setShowFilters = jest.fn();
  const { result } = renderHook(() => useCategoryFilterNavigation(setShowFilters));
  const target = document.createElement("div");
  target.scrollIntoView = jest.fn();
  target.focus = jest.fn();
  result.current.desktopCategoryRef.current = target;
  act(() => { window.dispatchEvent(new HashChangeEvent("hashchange")); });
  expect(setShowFilters).toHaveBeenLastCalledWith(false);
  expect(target.scrollIntoView).toHaveBeenCalled();
  expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
});

test("closes mobile filters on desktop resize without reopening on return", () => {
  const setShowFilters = jest.fn();
  renderHook(() => useCategoryFilterNavigation(setShowFilters));
  desktop = true;
  act(() => { resize(); });
  expect(setShowFilters).toHaveBeenLastCalledWith(false);
  setShowFilters.mockClear();
  desktop = false;
  act(() => { resize(); });
  expect(setShowFilters).not.toHaveBeenCalled();
});
