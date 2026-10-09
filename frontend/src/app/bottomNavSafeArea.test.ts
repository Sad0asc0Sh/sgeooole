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
 * consumer reads env(safe-area-inset-bottom) directly, the viewport
 * stays non-cover, and the BottomNav stays `sticky` in flow (a `fixed`
 * bar drifts under the dynamic toolbars of Firefox/Chrome for Android
 * while scrolling — user report, 2026-10-10). If the site migrates to
 * viewport-fit=cover, update the token AND this test together (see the
 * notes in globals.css).
 */
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

const globalsCss = read("globals.css");
const layoutTsx = read("layout.tsx");
const bottomNavTsx = read("../components/layout/BottomNav.tsx");
const footerTsx = read("../components/layout/Footer.tsx");
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

  it("anchors BottomNav with sticky bottom-0, never fixed", () => {
    // A fixed bar is re-anchored to the visual viewport by the browser and
    // drifts/lags under dynamic toolbars (Firefox/Chrome Android) while
    // scrolling; a sticky in-flow bar is composited with the document and
    // cannot drift. See the positioning note in globals.css.
    expect(bottomNavTsx).toContain("sticky bottom-0");
    expect(bottomNavTsx).not.toMatch(/<nav[^>]*\bfixed\b/);
    expect(bottomNavTsx).toContain("pb-safe-area");
    expect(bottomNavTsx).toContain("h-[var(--bottom-nav-height)]");
  });

  it("Footer carries no bottom margin reserving the nav height", () => {
    // The mb-16 only existed to clear the formerly fixed nav; the sticky
    // nav docks into its own flow slot directly under the footer.
    expect(footerTsx).not.toContain("mb-16");
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
