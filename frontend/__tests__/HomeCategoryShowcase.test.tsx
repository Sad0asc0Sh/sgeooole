import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import HomeCategoryShowcase from "@/components/home/HomeCategoryShowcase";
import { categoryService, type Category } from "@/services/categoryService";

const mockSwiperState = {
  isBeginning: true,
  isEnd: false,
  isLocked: false,
  slidePrev: jest.fn(),
  slideNext: jest.fn(),
};

let lastSwiperProps: Record<string, unknown> = {};

jest.mock("swiper/react", () => ({
  Swiper: ({
    children,
    id,
    dir,
    slidesPerView,
    autoplay,
    className,
    onSwiper,
  }: {
    children: React.ReactNode;
    id?: string;
    dir?: string;
    slidesPerView?: string | number;
    autoplay?: unknown;
    className?: string;
    onSwiper?: (swiper: typeof mockSwiperState) => void;
  }) => {
    lastSwiperProps = { id, dir, slidesPerView, autoplay, className };
    React.useEffect(() => {
      onSwiper?.(mockSwiperState);
    }, [onSwiper]);
    return (
      <div
        id={id}
        data-testid="category-carousel"
        data-dir={dir}
        data-slides-per-view={String(slidesPerView)}
        data-autoplay={JSON.stringify(autoplay)}
        className={className}
      >
        {children}
      </div>
    );
  },
  SwiperSlide: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

jest.mock("swiper/modules", () => ({ A11y: {}, Autoplay: {} }));

jest.mock("@/services/categoryService", () => ({
  categoryService: { getHomepage: jest.fn() },
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
  mockSwiperState.isBeginning = true;
  mockSwiperState.isEnd = false;
  mockSwiperState.isLocked = false;
  mockSwiperState.slidePrev.mockReset();
  mockSwiperState.slideNext.mockReset();
  lastSwiperProps = {};
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
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

test("requests nearby category images early and lets the browser defer the rest", async () => {
  const pictured = category("9", "دسته تصویری", "pictured", {
    image: {
      url: "https://s3.example/full.webp",
      cardUrl: "https://s3.example/card.webp",
      public_id: "p1",
    },
  });

  mount([pictured, camera, dvr, lock, {
    ...pictured, _id: "10", slug: "another", name: "دستهٔ دیگر",
  }]);

  const img = await screen.findByRole("img", { name: "دسته تصویری" });
  expect(img).toHaveAttribute("src", "https://s3.example/card.webp");
  expect(img).toHaveAttribute("loading", "eager");
  expect(img.getAttribute("fetchpriority")).not.toBe("high");
  expect(screen.getByRole("img", { name: "دستهٔ دیگر" })).toHaveAttribute("loading", "lazy");
  expect(fetchCategories).not.toHaveBeenCalled();
});

test("shows a loading state while recovery is pending", () => {
  fetchCategories.mockReturnValue(new Promise(() => {}));

  mount(null);

  expect(
    screen.getByRole("status", { name: "در حال بارگذاری دسته‌بندی‌ها" })
  ).toBeInTheDocument();
});

test("configures RTL Swiper with auto slide sizing and 6000ms pause-on-hover autoplay", () => {
  mount([camera, dvr, lock]);

  const carousel = screen.getByTestId("category-carousel");
  expect(carousel).toHaveAttribute("data-dir", "rtl");
  expect(carousel).toHaveAttribute("data-slides-per-view", "auto");
  expect(lastSwiperProps.autoplay).toEqual({
    delay: 6000,
    disableOnInteraction: false,
    pauseOnMouseEnter: true,
  });
});

test("navigates via prev/next buttons and respects start/end edge states", () => {
  mockSwiperState.isBeginning = false;
  mockSwiperState.isEnd = false;

  mount([camera, dvr, lock]);

  const prevBtn = screen.getByRole("button", { name: "دسته‌بندی‌های قبلی" });
  const nextBtn = screen.getByRole("button", { name: "دسته‌بندی‌های بعدی" });

  expect(prevBtn).toBeEnabled();
  expect(nextBtn).toBeEnabled();

  fireEvent.click(nextBtn);
  fireEvent.click(prevBtn);

  expect(mockSwiperState.slideNext).toHaveBeenCalledTimes(1);
  expect(mockSwiperState.slidePrev).toHaveBeenCalledTimes(1);

  mockSwiperState.isBeginning = true;
  mockSwiperState.isEnd = true;
  mount([camera, dvr, lock]);

  const prevButtons = screen.getAllByRole("button", { name: "دسته‌بندی‌های قبلی" });
  const nextButtons = screen.getAllByRole("button", { name: "دسته‌بندی‌های بعدی" });
  expect(prevButtons[prevButtons.length - 1]).toBeDisabled();
  expect(nextButtons[nextButtons.length - 1]).toBeDisabled();
});

test("hides navigation controls with locked class when all categories fit", () => {
  mockSwiperState.isLocked = true;

  mount([camera, dvr, lock]);

  const prevBtn = screen.getByRole("button", { name: "دسته‌بندی‌های قبلی" });
  const nextBtn = screen.getByRole("button", { name: "دسته‌بندی‌های بعدی" });

  expect(prevBtn).toBeDisabled();
  expect(nextBtn).toBeDisabled();
  expect(prevBtn).toHaveClass("navHidden");
  expect(nextBtn).toHaveClass("navHidden");
});

test("disables autoplay when prefers-reduced-motion is enabled", async () => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

  mount([camera, dvr, lock]);

  await waitFor(() => {
    expect(screen.getByTestId("category-carousel")).toHaveAttribute("data-autoplay", "false");
  });
});

test("preserves Technolife responsive CSS contract, concentric rings, and physical RTL arrows", () => {
  const css = readFileSync(
    join(__dirname, "../src/components/home/HomeCategoryShowcase.module.css"),
    "utf8"
  );

  // Physical RTL arrow placement & mobile arrow suppression
  expect(css).toMatch(/\.nav\s*\{\s*display:\s*none;\s*\}/);
  expect(css).toContain("@media (min-width: 992px)");
  expect(css).toMatch(/\.navPrev\s*\{\s*right:\s*8px;/);
  expect(css).toMatch(/\.navNext\s*\{\s*left:\s*8px;/);

  // Technolife responsive slides-per-view ladder
  for (const count of ["3.5", "4.5", "5", "5.5", "6", "7", "8"]) {
    expect(css).toContain(`--cat-slides: ${count};`);
  }

  // 3-layer concentric ring geometry (86/82/76 mobile, 128/124/114 + 120 hover desktop)
  for (const size of ["86px", "82px", "76px", "128px", "124px", "114px", "120px"]) {
    expect(css).toContain(size);
  }
});
