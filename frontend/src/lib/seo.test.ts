/**
 * Phase 1 SEO: PDP meta description sanitizer + title brand fallback.
 *
 * Guards:
 * - meta descriptions never contain raw HTML tags or encoded entities
 * - brand segment is omitted (not «بدون برند») when brand is missing
 * - descriptions stay within ~155 chars
 */
import {
  stripHtmlToText,
  decodeHtmlEntities,
  buildProductMetaDescription,
  buildProductSeoTitle,
  demoteH1ToH2,
  NOT_FOUND_METADATA,
} from "@/lib/seo";

describe("stripHtmlToText", () => {
  test("strips tags from Quill-style HTML", () => {
    const html =
      '<div style="background: #f9fafb;"><p>دوربین مداربسته دام داهوا</p><p>دید در شب عالی دارد.</p></div>';
    const text = stripHtmlToText(html);
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).toContain("دوربین مداربسته دام داهوا");
  });

  test("decodes entities before stripping", () => {
    const text = stripHtmlToText("&lt;div&gt;متن &quot;تست&quot;&lt;/div&gt;");
    expect(text).not.toContain("&lt;");
    expect(text).toContain('متن "تست"');
  });

  test("handles empty / null input", () => {
    expect(stripHtmlToText("")).toBe("");
    expect(stripHtmlToText(null)).toBe("");
    expect(stripHtmlToText(undefined)).toBe("");
  });
});

describe("decodeHtmlEntities", () => {
  test("decodes common entities", () => {
    expect(decodeHtmlEntities("&lt;p&gt;")).toBe("<p>");
    expect(decodeHtmlEntities("&#39;")).toBe("'");
    expect(decodeHtmlEntities("&amp;")).toBe("&");
  });
});

describe("buildProductMetaDescription", () => {
  const product = {
    title: "دوربین مداربسته دام داهوا DH-HAC-T2A51P",
    brand: "داهوا",
    description:
      '<div style="background:#f9fafb;"><p>دوربین مداربسته دام داهوا با کیفیت ۵ مگاپیکسل و دید در شب ۲۰ متری.</p><p>مناسب فضای داخلی.</p></div>',
    price: 3200000,
  };

  test("contains no HTML tags or entities (the F1 bug)", () => {
    const desc = buildProductMetaDescription(product);
    expect(desc).not.toMatch(/<[^>]+>/);
    expect(desc).not.toContain("&lt;");
    expect(desc).not.toContain("&gt;");
    expect(desc).not.toContain("&quot;");
  });

  test("follows the {name}؛ {feature} | قیمت {X} تومان | ای کا جی کالا shape", () => {
    const desc = buildProductMetaDescription(product);
    expect(desc).toContain(product.title);
    expect(desc).toContain("قیمت ۳٬۲۰۰٬۰۰۰ تومان");
    expect(desc).toContain("ای کا جی کالا");
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  test("falls back to title when description is empty", () => {
    const desc = buildProductMetaDescription({ title: "دوربین تست", price: 1000 });
    expect(desc).toContain("دوربین تست");
    expect(desc).not.toMatch(/<[^>]+>/);
  });

  test("omits price segment when price is missing", () => {
    const desc = buildProductMetaDescription({ title: "دوربین تست", description: "توضیح کوتاه." });
    expect(desc).not.toContain("قیمت");
  });
});

describe("demoteH1ToH2", () => {
  test("converts h1 tags to h2 (single-h1 guard for PDP CMS copy)", () => {
    const out = demoteH1ToH2("<h1>مشخصات</h1><p>متن</p><H1>بخش دوم</H1>");
    expect(out).not.toMatch(/<h1[\s>]/i);
    expect(out).not.toMatch(/<\/h1\s*>/i);
    expect(out).toBe("<h2>مشخصات</h2><p>متن</p><h2>بخش دوم</h2>");
  });

  test("preserves attributes on demoted headings", () => {
    expect(demoteH1ToH2('<h1 class="t" id="a">X</h1>')).toBe(
      '<h2 class="t" id="a">X</h2>'
    );
  });

  test("leaves other headings and content untouched", () => {
    const html = "<h2>موجود</h2><h3>زیربخش</h3><p>h1 در متن</p>";
    expect(demoteH1ToH2(html)).toBe(html);
  });

  test("handles empty input", () => {
    expect(demoteH1ToH2("")).toBe("");
  });
});

describe("buildProductSeoTitle", () => {
  test("includes brand when present", () => {
    expect(buildProductSeoTitle({ title: "دوربین X", brand: "داهوا" })).toBe(
      "خرید دوربین X | داهوا - قیمت و مشخصات"
    );
  });

  test("omits brand segment instead of «بدون برند» fallback", () => {
    for (const brand of [undefined, null, "", "   "]) {
      const title = buildProductSeoTitle({ title: "دوربین X", brand: brand as any });
      expect(title).not.toContain("بدون برند");
      expect(title).toBe("خرید دوربین X - قیمت و مشخصات");
    }
  });
});

describe("NOT_FOUND_METADATA", () => {
  test("has a distinct 404 title and noindex robots", () => {
    expect(NOT_FOUND_METADATA.title).toBe("صفحه یافت نشد");
    expect(NOT_FOUND_METADATA.robots).toEqual({ index: false, follow: false });
  });
});
