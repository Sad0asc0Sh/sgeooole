/**
 * Search-results header layout contract (products/ProductsPageClient.tsx).
 *
 * The header card is a single flex row with three children: the gold
 * search icon, the title/count block, and the «حذف جستجو» button. None of
 * them used to shrink-protect or wrap-protect: on a phone the icon kept
 * 56px, the button wrapped its own label onto two lines, and the title
 * block was squeezed into ~110px, so every word of «نتایج جستجو برای
 * «ریموت»» stacked on its own line and the card ballooned vertically
 * (user screenshot, 2026-10-12).
 *
 * These tests pin the mobile-first contract that fixes it at the root:
 *  1. the title block is `flex-1 min-w-0`, so it — not its neighbours —
 *     decides how the title wraps, and the queried term can break
 *     anywhere instead of overflowing;
 *  2. the icon and the clear button are `shrink-0`, and the button label
 *     is `whitespace-nowrap`, so neither steals width back from the title
 *     nor wraps internally;
 *  3. the mobile scale is compact (p-4, 44px icon, text-base title,
 *     text-xs count/labels) and the desktop scale (sm:p-6, 56px icon,
 *     text-lg title) is unchanged.
 */
import { readFileSync } from "fs";
import { join } from "path";

const clientTsx = readFileSync(join(__dirname, "ProductsPageClient.tsx"), "utf8");

const headerStart = clientTsx.indexOf("{/* Search Results Header */}");
const headerEnd = clientTsx.indexOf("{/* Brand Header */}");
const header = clientTsx.slice(headerStart, headerEnd);

describe("search results header layout contract", () => {
  it("extracts the search header block", () => {
    expect(headerStart).toBeGreaterThan(-1);
    expect(headerEnd).toBeGreaterThan(headerStart);
    expect(header).toContain("نتایج جستجو برای");
  });

  it("gives the title block flex-1 min-w-0 so it controls its own wrapping", () => {
    expect(header).toContain('className="flex-1 min-w-0"');
    expect(header).toContain("[overflow-wrap:anywhere]");
  });

  it("keeps the icon shrink-0 and compact on mobile, full size from sm up", () => {
    expect(header).toContain("w-11 h-11 sm:w-14 sm:h-14 shrink-0");
  });

  it("keeps the clear button shrink-0 with a never-wrapping label", () => {
    expect(header).toContain("shrink-0 whitespace-nowrap");
    expect(header).toContain("حذف جستجو");
  });

  it("uses the compact mobile scale and restores the desktop scale at sm", () => {
    expect(header).toContain("p-4 sm:p-6");
    expect(header).toContain("text-base leading-7 sm:text-lg");
    expect(header).toContain("text-xs sm:text-sm text-gray-500");
    expect(header).toContain("gap-3 sm:items-center sm:gap-4");
  });
});
