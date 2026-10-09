/**
 * BottomNav safe-area contract (globals.css layout tokens).
 *
 * The app does NOT use viewport-fit=cover, so the layout viewport already
 * ends above the system navigation bar / home indicator in every browser
 * and a `fixed; bottom: 0` bar sits flush on the bottom edge by itself.
 * Gecko (Firefox for Android) nevertheless reports
 * env(safe-area-inset-bottom) as the full navigation-bar height (~42px),
 * so any consumer feeding env() into bottom padding double-counts the bar
 * and leaves a tall empty band under the nav (user screenshot, 2026-10-10).
 *
 * These tests pin the contract: --safe-area-bottom stays 0px, no bottom
 * consumer reads env(safe-area-inset-bottom) directly, and the viewport
 * stays non-cover. If the site migrates to viewport-fit=cover, update the
 * token AND this test together (see the note in globals.css).
 */
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

const globalsCss = read("globals.css");
const layoutTsx = read("layout.tsx");
const bottomNavTsx = read("../components/layout/BottomNav.tsx");
const productsClientTsx = read("products/ProductsPageClient.tsx");
const productActionsTsx = read("product/[...segments]/ProductActions.tsx");

describe("BottomNav safe-area contract", () => {
  it("defines --safe-area-bottom as a literal 0px, not env()", () => {
    expect(globalsCss).toMatch(/--safe-area-bottom:\s*0px;/);
    expect(globalsCss).not.toMatch(/--safe-area-bottom:\s*env\(/);
  });

  it("derives the total nav height from the token", () => {
    expect(globalsCss).toMatch(
      /--bottom-nav-total-height:\s*calc\(var\(--bottom-nav-height\) \+ 1px \+ var\(--safe-area-bottom\)\);/
    );
  });

  it("keeps the viewport non-cover (the premise of the 0px token)", () => {
    expect(layoutTsx).not.toMatch(/viewportFit/);
  });

  it("anchors BottomNav explicitly to both bottom corners", () => {
    expect(bottomNavTsx).toContain("fixed inset-x-0 bottom-0");
    expect(bottomNavTsx).toContain("pb-safe-area");
    expect(bottomNavTsx).toContain("h-[var(--bottom-nav-height)]");
  });

  it("no bottom consumer reads env(safe-area-inset-bottom) directly", () => {
    expect(productsClientTsx).not.toContain("env(safe-area-inset-bottom");
    expect(productActionsTsx).not.toContain("env(safe-area-inset-bottom");
  });

  it("routes every bottom consumer through the central token", () => {
    expect(productsClientTsx).toContain("max(1rem, var(--safe-area-bottom))");
    expect(productActionsTsx).toContain("var(--safe-area-bottom)");
  });
});
