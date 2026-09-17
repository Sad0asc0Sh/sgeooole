import { act, renderHook } from "@testing-library/react";
import { useCategoryFilterNavigation } from "@/hooks/useCategoryFilterNavigation";
import { CATEGORY_FILTER_HREF } from "@/lib/categoryNavigation";
import CategoriesPage from "@/app/categories/page";
import { permanentRedirect } from "next/navigation";

jest.mock("next/navigation", () => ({ permanentRedirect: jest.fn() }));

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

test("retires the category index with a permanent redirect to product filters", () => {
  CategoriesPage();
  expect(permanentRedirect).toHaveBeenCalledWith("/products#category-filters");
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
