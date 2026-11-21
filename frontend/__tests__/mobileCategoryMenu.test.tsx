import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CategoriesSheet from "@/components/features/categories/CategoriesSheet";
import { useCategoryMenu } from "@/components/features/categories/useCategoryMenu";
import { useCategoryTree } from "@/hooks/useCategories";
import { categoryImageSources } from "@/lib/categoryNavigation";
import type { Category } from "@/services/categoryService";

jest.mock("@/hooks/useCategories", () => ({ useCategoryTree: jest.fn() }));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, onError }: React.ImgHTMLAttributes<HTMLImageElement>) =>
    <img src={src} alt={alt} onError={onError} />,
}));

const category = (_id: string, name: string, children: Category[] = []): Category => ({
  _id, name, slug: _id, children, isActive: true, order: 0, homepageOrder: 0, showOnHomepage: false,
});
const leaf = { ...category("leaf", "جک تک‌لنگه"), slug: "جک & قفل" };
const arms = category("arms", "جک بازویی", [leaf]);
const jacks = category("jacks", "جک پارکینگی", [arms]);
const door = {
  ...category("doors", "درب اتومات", [jacks, category("remote", "ریموت")]),
  image: { url: "/photo.webp", cardUrl: "/card.webp", public_id: "photo" },
  icon: { url: "/icon.webp", public_id: "icon" },
};
const rootLeaf = { ...category("accessories", "تجهیزات جانبی"), slug: "" };
const feed = {
  categoryTree: [door, rootLeaf], isLoading: false, isValidating: false, error: undefined, refresh: jest.fn(),
};

function Menu() {
  const menu = useCategoryMenu("/");
  const open = <button type="button" onClick={() => menu.enter()}>باز کردن منو</button>;
  return menu.path === null ? open : <CategoriesSheet {...menu} path={menu.path} navigation={null} />;
}

function openMenu() {
  const view = render(<Menu />);
  fireEvent.click(screen.getByRole("button", { name: "باز کردن منو" }));
  return view;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  jest.mocked(useCategoryTree).mockReturnValue(feed);
});

test("distinguishes branches from listings at every depth and restores the previous row on Back", async () => {
  openMenu();
  expect(screen.getByRole("link", { name: /تجهیزات جانبی/ })).toHaveAttribute(
    "href", "/products?category=accessories&includeChildren=true",
  );
  expect(screen.queryByText(jacks.name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "درب اتومات ۲ زیرشاخه" }));
  expect(screen.getByText("سطح ۲")).toBeVisible();
  expect(screen.getByRole("link", { name: "همه محصولات درب اتومات" })).toHaveAttribute(
    "href", "/products?category=doors&includeChildren=true",
  );
  fireEvent.click(screen.getByRole("button", { name: /جک پارکینگی/ }));
  expect(screen.getByText("سطح ۳")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /جک بازویی/ }));
  const crumbs = within(screen.getByRole("navigation", { name: "مسیر دسته‌بندی" }));
  expect(crumbs.getByText(arms.name)).toHaveAttribute("aria-current", "location");
  expect(screen.getByRole("link", { name: "جک تک‌لنگه مشاهده محصولات" })).toHaveAttribute(
    "href", `/products?category=${encodeURIComponent(leaf.slug)}&includeChildren=true`,
  );

  act(() => window.history.back());
  await waitFor(() => expect(screen.getByRole("button", { name: /جک بازویی/ })).toHaveFocus());
  fireEvent.click(crumbs.getByRole("button", { name: "همه دسته‌ها" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /درب اتومات/ })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "بستن دسته‌بندی‌ها" }));
  expect(await screen.findByRole("button", { name: "باز کردن منو" })).toBeVisible();
});

test("tries only the selected category's assets and keeps a fallback when none load", () => {
  openMenu();
  const row = screen.getByRole("button", { name: /درب اتومات/ });
  for (const url of categoryImageSources(door)) {
    const image = row.querySelector("img")!;
    expect(image).toHaveAttribute("src", url);
    fireEvent.error(image);
  }
  expect(row.querySelector("img")).toBeNull();
  expect(row.querySelector('[aria-hidden="true"] svg')).toBeInTheDocument();
  expect(categoryImageSources(door).map((src) => src.split("/").pop())).toEqual(["card.webp", "photo.webp", "icon.webp"]);
});

test("resolves legacy paths against the configured public media host and preserves absolute URLs", () => {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = "https://shop.example/api/";
  try {
    expect(categoryImageSources({ image: " uploads/legacy.jpg ", icon: "/uploads/legacy.jpg" }))
      .toEqual(["https://shop.example/uploads/legacy.jpg"]);
    expect(categoryImageSources({ image: "https://cdn.example/photo.webp", icon: "//cdn.example/icon.webp" }))
      .toEqual(["https://cdn.example/photo.webp", "//cdn.example/icon.webp"]);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  }
});

test("returns to the nearest valid branch when a refreshed tree removes the current category", async () => {
  const view = openMenu();
  fireEvent.click(screen.getByRole("button", { name: /درب اتومات/ }));
  fireEvent.click(screen.getByRole("button", { name: /جک پارکینگی/ }));
  jest.mocked(useCategoryTree).mockReturnValue({ ...feed, categoryTree: [category("doors", door.name, [rootLeaf])] });
  view.rerender(<Menu />);
  await waitFor(() => expect(window.history.state.ekgCategoryMenu.path).toEqual(["doors"]));
  expect(screen.getByRole("heading", { name: door.name })).toBeVisible();
  expect(screen.getByRole("link", { name: /تجهیزات جانبی/ })).toBeVisible();
});

test("keeps cached rows during a failed refresh and offers retry on an empty failed feed", () => {
  jest.mocked(useCategoryTree).mockReturnValue({ ...feed, error: new Error("offline") });
  const view = openMenu();
  expect(screen.getByRole("button", { name: /درب اتومات/ })).toBeVisible();
  jest.mocked(useCategoryTree).mockReturnValue({ ...feed, categoryTree: [], error: new Error("offline") });
  view.rerender(<Menu />);
  fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
  expect(feed.refresh).toHaveBeenCalledTimes(1);
});
