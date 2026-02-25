import { canNavigateToHref, resolveNavigateTarget } from "@/lib/navigateHref";

describe("navigateHref", () => {
  test("ignores empty and unsafe hrefs", () => {
    expect(resolveNavigateTarget(null)).toEqual({ kind: "ignore" });
    expect(resolveNavigateTarget("")).toEqual({ kind: "ignore" });
    expect(resolveNavigateTarget("   ")).toEqual({ kind: "ignore" });
    expect(resolveNavigateTarget("#")).toEqual({ kind: "ignore" });
    expect(resolveNavigateTarget("javascript:alert(1)")).toEqual({ kind: "ignore" });
    expect(resolveNavigateTarget("data:text/html;base64,PHNjcmlwdD4=")).toEqual({
      kind: "ignore",
    });
    expect(canNavigateToHref("javascript:alert(1)")).toBe(false);
  });

  test("resolves external hrefs", () => {
    expect(resolveNavigateTarget("https://example.com")).toEqual({
      kind: "external",
      href: "https://example.com",
    });
    expect(resolveNavigateTarget("http://example.com/x")).toEqual({
      kind: "external",
      href: "http://example.com/x",
    });
    expect(resolveNavigateTarget("mailto:test@example.com")).toEqual({
      kind: "external",
      href: "mailto:test@example.com",
    });
    expect(resolveNavigateTarget("tel:+123")).toEqual({
      kind: "external",
      href: "tel:+123",
    });
    expect(resolveNavigateTarget("//example.com/path")).toEqual({
      kind: "external",
      href: "https://example.com/path",
    });
    expect(resolveNavigateTarget("www.example.com/path")).toEqual({
      kind: "external",
      href: "https://www.example.com/path",
    });
    expect(resolveNavigateTarget("example.com/path")).toEqual({
      kind: "external",
      href: "https://example.com/path",
    });
  });

  test("resolves internal hrefs", () => {
    expect(resolveNavigateTarget("/products?sort=flash")).toEqual({
      kind: "internal",
      href: "/products?sort=flash",
    });
    expect(resolveNavigateTarget("products?sort=flash")).toEqual({
      kind: "internal",
      href: "/products?sort=flash",
    });
    expect(resolveNavigateTarget("?q=1")).toEqual({
      kind: "internal",
      href: "/?q=1",
    });
    expect(canNavigateToHref("/products")).toBe(true);
  });
});

