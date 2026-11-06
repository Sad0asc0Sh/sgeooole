import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import HomeCategoryShowcase from "@/components/home/HomeCategoryShowcase";
import { categoryService, type Category } from "@/services/categoryService";

jest.mock("@/services/categoryService", () => ({
  categoryService: { getHomepage: jest.fn() },
}));
jest.mock("@/components/ui/ResilientImage", () => ({
  useResilientImage: (url: string) => ({
    src: url,
    onError: jest.fn(),
    onLoad: jest.fn(),
    ref: jest.fn(),
    phase: "loaded",
  }),
}));

const category = (
  id: string,
  name: string,
  slug: string,
  overrides: Partial<Category> = {}
): Category => ({
  _id: id,
  name,
  slug,
  showOnHomepage: true,
  homepageOrder: 0,
  isActive: true,
  order: 0,
  ...overrides,
});

const camera = category("1", "دوربین مداربسته", "cameras");
const dvr = category("2", "دستگاه ضبط تصویر", "dvr", { homepageOrder: 1 });
const lock = category("3", "قفل و ریموت", "locks", { homepageOrder: 2 });

const fetchCategories = jest.mocked(categoryService.getHomepage);

function mount(categories: Category[] | null) {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        errorRetryCount: 0,
      }}
    >
      <HomeCategoryShowcase categories={categories} />
    </SWRConfig>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders the curated homepage categories as a carousel", async () => {
  mount([camera, dvr, lock]);

  expect(
    screen.getByRole("heading", { name: "دسته‌بندی‌های فروشگاه" })
  ).toBeInTheDocument();
  expect(await screen.findByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(dvr.name)).toBeInTheDocument();
  expect(screen.getByText(lock.name)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: lock.name })).toHaveAttribute(
    "href",
    "/products?category=locks&includeChildren=true"
  );

  // داده از SSR آمده است — درخواست تکراری روی mount نباید زده شود.
  expect(fetchCategories).not.toHaveBeenCalled();
});

test("recovers categories in the browser after a failed server fetch", async () => {
  fetchCategories.mockResolvedValue([camera, dvr]);

  mount(null);

  expect(
    screen.getByRole("status", { name: "در حال بارگذاری دسته‌بندی‌ها" })
  ).toBeInTheDocument();

  expect(await screen.findByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(dvr.name)).toBeInTheDocument();
});

test("keeps server categories visible without refetching on mount", async () => {
  mount([camera, lock]);

  expect(await screen.findByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(lock.name)).toBeInTheDocument();
  expect(fetchCategories).not.toHaveBeenCalled();
  expect(
    screen.queryByText("بارگذاری دسته‌بندی‌ها انجام نشد.")
  ).not.toBeInTheDocument();
});

test("shows an actionable error rather than disappearing, and supports retry", async () => {
  fetchCategories
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue([camera, lock]);

  mount(null);

  fireEvent.click(await screen.findByRole("button", { name: "تلاش مجدد" }));

  expect(await screen.findByText(camera.name)).toBeInTheDocument();
  expect(screen.getByText(lock.name)).toBeInTheDocument();
});

test("hides only a successfully empty category feed", async () => {
  fetchCategories.mockResolvedValue([]);

  const { container } = mount(null);

  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

test("renders first category images eagerly from cardUrl, never hidden", async () => {
  const pictured = category("9", "دسته تصویری", "pictured", {
    image: {
      url: "https://s3.example/full.webp",
      cardUrl: "https://s3.example/card.webp",
      public_id: "p1",
    },
  });

  mount([pictured]);

  const img = await screen.findByRole("img", { name: "دسته تصویری" });
  expect(img).toHaveAttribute("src", "https://s3.example/card.webp");
  expect(img).toHaveAttribute("loading", "eager");
  expect(img.getAttribute("fetchpriority")).toBe("high");
  expect(img).toHaveStyle({ opacity: "1" });
  expect(fetchCategories).not.toHaveBeenCalled();
});

test("shows a loading state while recovery is pending", () => {
  fetchCategories.mockReturnValue(new Promise(() => {}));

  mount(null);

  expect(
    screen.getByRole("status", { name: "در حال بارگذاری دسته‌بندی‌ها" })
  ).toBeInTheDocument();
});
