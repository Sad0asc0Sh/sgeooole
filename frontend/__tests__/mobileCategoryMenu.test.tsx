import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BottomNav from "@/components/layout/BottomNav";
import { useCategoryTree } from "@/hooks/useCategories";
import { categoryImageSources } from "@/lib/categoryNavigation";
import type { Category } from "@/services/categoryService";

jest.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
jest.mock("@/hooks/useCategories", () => ({ useCategoryTree: jest.fn() }));

const category = (_id: string, name: string, children: Category[] = []): Category => ({
  _id, name, slug: _id, children, isActive: true, order: 0, homepageOrder: 0, showOnHomepage: false,
});
const camera = { ...category("camera", "دوربین فروشگاهی"), slug: "دوربین & فروشگاه" };
const doors = category("doors", "درب‌های اتوماتیک", [category("jacks", "جک پارکینگی", [category("arms", "جک بازویی")])]);
const security = category("security", "سیستم امنیتی", [
  category("alarms", "دزدگیر", [category("sensors", "حسگر")]),
  category("cameras", "دوربین مداربسته", [camera]),
]);
const feed = {
  categoryTree: [doors, security], isLoading: false, isValidating: false, error: undefined, refresh: jest.fn(),
};

const categoryTabName = "دسته‌بندی";
const dialogName = "دسته‌بندی کالاها";

function openMenu(path = "/blog?view=all#posts") {
  window.history.replaceState(null, "", path);
  const view = render(<><footer>فوتر فروشگاه</footer><BottomNav onNavClick={jest.fn()} isServicesOpen={false} /></>);
  const trigger = screen.getByRole("button", { name: categoryTabName });
  fireEvent.click(trigger);
  return { ...view, trigger, dialog: screen.getByRole("dialog", { name: dialogName }) };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  jest.mocked(useCategoryTree).mockReturnValue(feed);
});

test("the category tab opens over the current page and closes from a different accordion group", async () => {
  const initialOverflow = document.body.style.overflow;
  const { trigger, dialog } = openMenu();
  const menu = within(dialog);

  expect(window.location.pathname + window.location.search + window.location.hash).toBe("/blog?view=all#posts");
  expect(document.body.style.overflow).toBe("hidden");
  expect(menu.queryByText("فوتر فروشگاه")).toBeNull();
  expect(menu.getByRole("heading", { name: dialogName })).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "true");

  fireEvent.click(menu.getByRole("button", { name: security.name }));
  expect(menu.getByRole("button", { name: "دزدگیر" })).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(menu.getByRole("button", { name: "دوربین مداربسته" }));
  expect(menu.getByRole("link", { name: camera.name })).toHaveAttribute(
    "href", `/products?category=${encodeURIComponent(camera.slug)}&includeChildren=true`,
  );
  fireEvent.click(menu.getByRole("button", { name: categoryTabName }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(window.location.pathname + window.location.search + window.location.hash).toBe("/blog?view=all#posts");
  expect(document.body.style.overflow).toBe(initialOverflow);
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("Back dismisses the categories before navigating away and Forward can open them again", async () => {
  const { dialog } = openMenu("/about");
  act(() => window.history.back());
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(window.location.pathname).toBe("/about");

  act(() => window.history.forward());
  const restored = await screen.findByRole("dialog", { name: dialogName });
  expect(within(restored).getByRole("button", { name: doors.name })).toBeVisible();
  fireEvent.keyDown(restored, { key: "Escape" });
  await waitFor(() => expect(restored).not.toBeInTheDocument());
});

test("uses the shared category data and retry state inside the sheet", () => {
  jest.mocked(useCategoryTree).mockReturnValue({ ...feed, categoryTree: [], error: new Error("offline") });
  const { dialog } = openMenu();
  fireEvent.click(within(dialog).getByRole("button", { name: "تلاش مجدد" }));
  expect(feed.refresh).toHaveBeenCalledTimes(1);
});

test("resolves legacy category images relative to the configured media host", () => {
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
