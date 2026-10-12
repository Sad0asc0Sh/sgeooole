/**
 * Search-results header layout contract (products/ProductsPageClient.tsx).
 *
 * The header card is a single flex row with three children: the gold
 * search icon, the title/count block, and the «حذف جستجو» button.
 *
 * Round 1 (user screenshot, 2026-10-12): none of the three was shrink-
 * or wrap-protected, so on a phone the title block was squeezed to
 * ~110px, every word of «نتایج جستجو برای «ریموت»» stacked on its own
 * line, and the card ballooned to ~206px tall.
 *
 * Round 2 (user screenshot of round 1 live, 2026-10-13): the fix held
 * structurally but still read as big and unprofessional on the real
 * phone — IRANSans is wider than the test font, so the title still took
 * three lines and the count two. The header is now a slim bar in the
 * listing's own scale:
 *  1. the title block is `flex-1 min-w-0`, so it — not its neighbours —
 *     decides how the title wraps, and the queried term can break
 *     anywhere instead of overflowing;
 *  2. the icon and the clear button are `shrink-0`, and the button label
 *     is `whitespace-nowrap`, so neither steals width back from the
 *     title nor wraps internally;
 *  3. the mobile scale is compact (p-3, 36px icon, text-sm title,
 *     text-[11px] clear chip) and grows only modestly (sm:p-5, 44px
 *     icon, text-base title);
 *  4. the «N محصول پیدا شد» line is desktop-only (`hidden lg:block`):
 *     below lg the listing toolbar already shows the same total, and
 *     repeating it here only made the mobile card taller.
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

  it("keeps the icon shrink-0 and slim on mobile, modest from sm up", () => {
    expect(header).toContain("w-9 h-9 sm:w-11 sm:h-11 shrink-0");
  });

  it("keeps the clear button shrink-0 with a never-wrapping label", () => {
    expect(header).toContain("shrink-0 whitespace-nowrap");
    expect(header).toContain("حذف جستجو");
  });

  it("uses the slim mobile scale and grows only modestly at sm", () => {
    expect(header).toContain("p-3 sm:p-5");
    expect(header).toContain("text-sm leading-6 sm:text-base sm:leading-7");
    expect(header).toContain("items-center gap-2.5 sm:gap-3.5");
    expect(header).toContain("text-[11px] sm:px-3.5 sm:py-2 sm:text-xs");
  });

  it("shows the found-count line only on desktop, where the toolbar does not repeat it", () => {
    expect(header).toContain("hidden lg:block text-xs text-gray-500");
    expect(header).toContain("محصول پیدا شد");
  });
});
