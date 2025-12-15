import { formatPrice, calculateDiscountPrice, cn } from "@/lib/utils";

describe("utils", () => {
  test("formatPrice formats number with locale", () => {
    expect(formatPrice(123456)).toBe((123456).toLocaleString("fa-IR"));
    expect(formatPrice(123456, "en-US")).toBe("123,456");
  });

  test("calculateDiscountPrice applies percentage and rounds", () => {
    expect(calculateDiscountPrice(100000, 20)).toBe(80000);
    expect(calculateDiscountPrice(100000, 0)).toBe(100000);
    expect(calculateDiscountPrice(0, 50)).toBe(0);
  });

  test("cn merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });
});
