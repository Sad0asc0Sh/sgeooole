import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import HomeCategoryShowcase from "@/components/home/HomeCategoryShowcase";
import { categoryService, type Category } from "@/services/categoryService";

jest.mock("@/services/categoryService", () => ({
  categoryService: { getHomepage: jest.fn() },
}));
jest.mock("@/lib/categoryTracking", () => ({
  trackCategoryView: jest.fn(),
  trackCategoryClick: jest.fn(),
}));
jest.mock("@/components/ui/ResilientImage", () => {
  const RequireReact = require("react");
  return {
    __esModule: true,
    default: function MockResilientImage({ alt }: { alt?: string }) {
      return RequireReact.createElement("img", { alt: alt ?? "" });
    },
  };
});

const category = (
  id: string,
  name: string,
  slug: string,
  overrides: Partial<Category> = {}
): Category => ({
  _id: id,
  name,
  slug,
  isFeatured: true,
  isPopular: false,
  isActive: true,
  order: 0,
  ...overrides,
});

const camera = category("1", "دوربین مداربسته", "cameras");
const dvr = category("2", "دستگاه ضبط تصویر", "dvr", {
  isFeatured: false,
  isPopular: true,
});
const lock = category("3", "قفل و ریموت", "locks", {
  isFeatured: false,
  isPopular: true,
});

const fetchCategories = jest.mocked(categoryService.getHomepage);

function mount(featured: Category[] | null, popular: Category[] | null) {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        errorRetryCount: 0,
      }}
    >
      <HomeCategoryShowcase featured={featured} popular={popular} />
    </SWRConfig>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows the server categories and merges popular ones without duplicates", async () => {
  fetchCategories.mockImplementation((kind) =>
    Promise.resolve(kind === "featured" ? [camera] : [camera, dvr, lock])
  );

  mount([camera], [camera, dvr, lock]);

  expect(screen.getByRole("heading", { name: "دسته‌بندی‌ها" })).toBeInTheDocument();
  expect(screen.getByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(dvr.name)).toBeInTheDocument();
  expect(screen.getByText(lock.name)).toBeInTheDocument();
  expect(screen.getAllByText(camera.name)).toHaveLength(1);
  expect(screen.getByRole("link", { name: lock.name })).toHaveAttribute(
    "href",
    "/products?category=locks&includeChildren=true"
  );
  expect(screen.getByRole("link", { name: "همه دسته‌بندی‌ها" })).toHaveAttribute(
    "href",
    "/products#category-filters"
  );

  await waitFor(() => expect(fetchCategories).toHaveBeenCalledTimes(2));
});

test("recovers categories in the browser after a failed server fetch", async () => {
  fetchCategories.mockImplementation((kind) =>
    Promise.resolve(kind === "featured" ? [camera] : [dvr])
  );

  mount(null, null);

  expect(
    screen.getByRole("status", { name: "در حال بارگذاری دسته‌بندی‌ها" })
  ).toBeInTheDocument();

  expect(await screen.findByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(dvr.name)).toBeInTheDocument();
  expect(fetchCategories).toHaveBeenCalledWith("featured");
  expect(fetchCategories).toHaveBeenCalledWith("popular");
});

test("keeps valid server categories when the background refresh fails", async () => {
  fetchCategories.mockRejectedValue(new Error("offline"));

  mount([camera], [lock]);

  await waitFor(() => expect(fetchCategories).toHaveBeenCalledTimes(2));

  expect(screen.getByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(lock.name)).toBeInTheDocument();
  expect(
    screen.queryByText("بارگذاری دسته‌بندی‌ها انجام نشد.")
  ).not.toBeInTheDocument();
});

test("shows an actionable error rather than disappearing, and supports retry", async () => {
  fetchCategories
    .mockRejectedValueOnce(new Error("offline"))
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation((kind) =>
      Promise.resolve(kind === "featured" ? [camera] : [lock])
    );

  mount(null, null);

  fireEvent.click(await screen.findByRole("button", { name: "تلاش مجدد" }));

  expect(await screen.findByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(lock.name)).toBeInTheDocument();
});

test("hides only a successfully empty category feed", async () => {
  fetchCategories.mockResolvedValue([]);

  const { container } = mount(null, null);

  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

test("shows a loading state while recovery is pending", () => {
  fetchCategories.mockReturnValue(new Promise(() => {}));

  mount(null, null);

  expect(
    screen.getByRole("status", { name: "در حال بارگذاری دسته‌بندی‌ها" })
  ).toBeInTheDocument();
});
