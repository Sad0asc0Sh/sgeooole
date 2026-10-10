/**
 * Order-detail stacking contract (profile/orders/[id]/page.tsx).
 *
 * The page's mobile app-bar («جزئیات سفارش») is `sticky top-0`, and the
 * order-status stepper inside the Status Tracker card uses an inner
 * `relative z-10` row so the step circles paint above the progress track.
 * The card used to create NO stacking context, so that inner z-10 escaped
 * into the page's root stacking context, tied with the app-bar's z-10 and
 * won by DOM order: while scrolling, the circles and labels painted OVER
 * the sticky app-bar title instead of sliding under it (user screenshot,
 * 2026-10-10).
 *
 * These tests pin the two-part contract that fixes it at the root:
 *  1. the tracker card is `isolate`d, trapping every inner z-index in the
 *     card's own stacking context;
 *  2. the sticky app-bar sits at z-30 — above all page content, below the
 *     global header / overlays (z-50).
 * The inner steps-row z-10 must STAY: removing it would drop the circles
 * under the progress track inside the card.
 */
import { readFileSync } from "fs";
import { join } from "path";

const pageTsx = readFileSync(join(__dirname, "page.tsx"), "utf8");
const headerTsx = readFileSync(
  join(__dirname, "../../../../components/layout/Header.tsx"),
  "utf8",
);

describe("order detail stacking contract", () => {
  it("isolates the Status Tracker card so inner z-indexes cannot escape", () => {
    expect(pageTsx).toContain(
      'className="bg-white rounded-2xl p-5 lg:p-6 border border-gray-100 shadow-sm isolate"',
    );
  });

  it("keeps the steps row's inner z-10 above the in-card progress track", () => {
    expect(pageTsx).toContain(
      'className="relative z-10 flex justify-between items-start"',
    );
  });

  it("raises the sticky app-bar to z-30, above page content", () => {
    expect(pageTsx).toContain("sticky top-0 z-30");
    expect(pageTsx).not.toContain("sticky top-0 z-10");
  });

  it("keeps the app-bar below the global header (z-50)", () => {
    expect(headerTsx).toContain("fixed inset-x-0 top-0 z-50");
  });
});
