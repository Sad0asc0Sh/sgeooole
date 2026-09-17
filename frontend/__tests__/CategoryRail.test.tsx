import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import CategoryRail from "@/components/home/CategoryRail";
import { categoryService, type Category } from "@/services/categoryService";

jest.mock("@/services/categoryService", () => ({ categoryService: { getHomepage: jest.fn() } }));
jest.mock("@/lib/categoryTracking", () => ({ trackCategoryView: jest.fn(), trackCategoryClick: jest.fn() }));
jest.mock("@/lib/scroll/ScrollManager", () => ({ getScrollManager: () => ({ getHorizontal: () => -40, saveHorizontal: jest.fn() }) }));
jest.mock("@/components/ui/ResilientImage", () => ({ useResilientImage: (url: string) => ({ src: url, phase: "loaded" }) }));

const category: Category = { _id: "1", name: "دوربین مداربسته", slug: "cameras", isFeatured: true, isPopular: false, isActive: true, order: 0 };
const fetchCategories = jest.mocked(categoryService.getHomepage);
function mount(data: Category[] | null) {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <CategoryRail title="دسته‌های ویژه" variant="circle" data={data} />
  </SWRConfig>);
}

beforeEach(() => { jest.clearAllMocks(); });

test("recovers categories in the browser after a failed server fetch", async () => {
  fetchCategories.mockResolvedValue([category]);
  mount(null);
  expect(await screen.findByText(category.name)).toBeInTheDocument();
  expect(fetchCategories).toHaveBeenCalledWith("featured");
  expect(screen.getByRole("list").scrollLeft).toBe(-40);
  expect(screen.getByRole("link", { name: "همه دسته‌بندی‌ها" })).toHaveAttribute("href", "/products#category-filters");
});

test("keeps valid server categories when background refresh fails", async () => {
  fetchCategories.mockRejectedValue(new Error("offline"));
  mount([category]);
  await waitFor(() => expect(fetchCategories).toHaveBeenCalled());
  expect(screen.getByText(category.name)).toBeInTheDocument();
  expect(screen.queryByText("بارگذاری دسته‌بندی‌ها انجام نشد.")).not.toBeInTheDocument();
});

test("shows an actionable error rather than disappearing, and supports retry", async () => {
  fetchCategories.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([category]);
  mount(null);
  fireEvent.click(await screen.findByRole("button", { name: "تلاش مجدد" }));
  expect(await screen.findByText(category.name)).toBeInTheDocument();
});

test("hides only a successfully empty category list", async () => {
  fetchCategories.mockResolvedValue([]);
  const { container } = mount(null);
  await waitFor(() => expect(fetchCategories).toHaveBeenCalled());
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

test("shows a loading state while recovery is pending", () => {
  fetchCategories.mockReturnValue(new Promise(() => {}));
  mount(null);
  expect(screen.getByRole("status", { name: "در حال بارگذاری دسته‌های ویژه" })).toBeInTheDocument();
});
