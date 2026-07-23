import { getScrollManager } from "@/lib/scroll/ScrollManager";

describe("ScrollManager", () => {
  beforeEach(() => {
    sessionStorage.clear();
    const manager = getScrollManager();
    manager.clearAll();
  });

  test("saves and retrieves scroll position from memory and sessionStorage", () => {
    const manager = getScrollManager();
    manager.save("/", 1450);

    const pos = manager.getSavedY("/");
    expect(pos).toBe(1450);
  });

  test("persists scroll position into sessionStorage", () => {
    const manager = getScrollManager();
    manager.save("/products?category=tech", 2100);

    const stored = sessionStorage.getItem("scroll_pos_/products?category=tech");
    expect(stored).not.toBeNull();
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.y).toBe(2100);
    }
  });

  test("clears scroll position correctly", () => {
    const manager = getScrollManager();
    manager.save("/cart", 500);
    manager.clear("/cart");

    expect(manager.getSavedY("/cart")).toBeNull();
  });
});
