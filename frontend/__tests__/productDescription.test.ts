/**
 * Regression tests for the product-description width normaliser.
 *
 * Background: descriptions are authored as HTML templates with inline styles,
 * and one generation of the "structured" template hard-coded the article to a
 * 420px card (`max-width: 420px; margin: 0 auto`). The product page renders the
 * article inside a much wider column, so those products showed as a narrow
 * strip with a blank gutter on both sides while newer products (authored with
 * `width: 100%; max-width: 100%`) filled the column correctly.
 */
import { normalizeDescriptionRoot } from "@/lib/productDescription";

// Root wrapper of the affected generation (45 products at the time of the fix).
const LEGACY_ROOT =
  '<div style="background: #f9fafb; font-family: Tahoma, Arial, sans-serif; max-width: 420px; padding: 0; border-radius: 18px; box-shadow: 0 8px 30px rgba(0,0,0,0.06); text-align: center; margin: 0 auto; direction: rtl; overflow: hidden;">';

// Root wrapper of the current generation — already fluid.
const CURRENT_ROOT =
  '<div style="background: #f9fafb; font-family: Tahoma, Arial, sans-serif; width: 100%; max-width: 100%; padding: 0; text-align: center; margin: 0 auto; direction: rtl; overflow: hidden; box-sizing: border-box;">';

const innerCards = `
    <div style="padding: 24px 20px 28px;">
        <div style="background: #ffffff; border-radius: 12px; padding: 18px 16px; margin-bottom: 18px; border: 1px solid #eceef2; text-align: right;">
            <h2 style="color: #4a5472; font-size: 14px; font-weight: bold; margin: 0 0 12px; text-align: center;">معرفی محصول</h2>
            <div style="display: table; width: 100%; box-sizing: border-box;">
                <div style="display: table-cell; width: 32px; vertical-align: top;">01</div>
            </div>
        </div>
    </div>
</div>`;

const rootStyleOf = (html: string) => html.match(/^<div[^>]*style="([^"]*)"/)?.[1] ?? "";

describe("normalizeDescriptionRoot", () => {
  test("legacy 420px card is widened to fill the description column", () => {
    const out = normalizeDescriptionRoot(LEGACY_ROOT + innerCards);
    const style = rootStyleOf(out);

    expect(style).not.toMatch(/max-width:\s*420px/i);
    expect(style).not.toMatch(/(?:width|max-width|min-width)\s*:\s*\d+px/i);
    expect(style).toContain("width: 100%");
    expect(style).toContain("max-width: 100%");
    expect(style).toContain("box-sizing: border-box");
  });

  test("the rest of the article design is preserved", () => {
    const out = normalizeDescriptionRoot(LEGACY_ROOT + innerCards);

    // Root keeps its palette, direction and centring.
    expect(rootStyleOf(out)).toContain("background: #f9fafb");
    expect(rootStyleOf(out)).toContain("direction: rtl");
    expect(rootStyleOf(out)).toContain("margin: 0 auto");
    // Nested cards keep their authored radius, borders and fixed cell widths.
    expect(out).toContain("border-radius: 12px");
    expect(out).toContain("border: 1px solid #eceef2");
    expect(out).toContain("width: 32px");
    // Content is untouched.
    expect(out).toContain("معرفی محصول");
    expect(out.endsWith("</div>")).toBe(true);
  });

  test("a description that already fills the column is left byte-identical", () => {
    const html = CURRENT_ROOT + innerCards;
    expect(normalizeDescriptionRoot(html)).toBe(html);
  });

  test("plain rich-text descriptions without inline styles are untouched", () => {
    const html = "<p>توضیحات ساده محصول</p>";
    expect(normalizeDescriptionRoot(html)).toBe(html);
  });

  test("only the root element is inspected", () => {
    const html =
      '<div style="text-align: right;">' +
      '<img style="max-width: 300px;" src="/a.jpg" alt="a" />' +
      '<div style="width: 420px;">inner</div>' +
      "</div>";
    expect(normalizeDescriptionRoot(html)).toBe(html);
  });

  test("single quoted style attributes are normalised too", () => {
    const out = normalizeDescriptionRoot("<div style='width: 420px; color: red;'>x</div>");
    expect(out.match(/style="([^"]*)"/)?.[1]).toBe("color: red; width: 100%; max-width: 100%; box-sizing: border-box");
  });
});
