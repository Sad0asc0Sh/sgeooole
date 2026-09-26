/**
 * Shared SEO helpers for product pages.
 *
 * Phase 1 SEO fixes:
 * - PDP `<meta name="description">` was built by dumping the RAW product-description
 *   HTML into the tag (e.g. `content="&lt;div style=&quot;...`), producing garbage
 *   snippets in Google. These helpers strip tags/entities first and compose a
 *   clean ~150-char Persian summary.
 * - PDP `<title>` printed a «بدون برند» fallback when the brand was missing;
 *   the brand segment is now omitted instead.
 * - Unmatched routes (soft-404 fix) share NOT_FOUND_METADATA: a distinct
 *   «صفحه یافت نشد» title (rendered via the root title template) + noindex.
 *   The page itself serves the 404 via notFound().
 */
import type { Metadata } from "next";

/** Metadata for unmatched routes: distinct 404 title + noindex. */
export const NOT_FOUND_METADATA: Metadata = {
  title: "صفحه یافت نشد",
  robots: { index: false, follow: false },
};

export type ProductSeoInput = {
  title: string;
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  price?: number | null;
};

const FA_DIGITS = "fa-IR";

/** Decode the HTML entities commonly found in CMS-sourced product copy. */
export function decodeHtmlEntities(value: string): string {
  if (!value) return "";
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*34;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const n = parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    });
}

/**
 * Strip HTML tags (and any entities) from CMS copy, returning plain text with
 * collapsed whitespace. Safe to embed in `<meta name="description">`.
 */
export function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate to `max` chars at a word boundary, appending … when cut. */
function truncateWords(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

/**
 * First meaningful sentence (or leading fragment) of the cleaned description,
 * used as the «key feature» part of the meta description.
 */
function firstSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  // Split on sentence terminators (Latin + Persian). Keep it to one sentence.
  const match = clean.match(/^[^.!?؛…\n]{10,}?([.!?؛…]|$)/);
  const sentence = (match ? match[0] : clean).trim();
  return truncateWords(sentence, max);
}

/**
 * Demote `<h1>` tags inside CMS rich-text copy to `<h2>`.
 * The PDP already renders exactly one `<h1>` (the product name); extra h1s
 * coming from CMS descriptions would create duplicate h1s on the page.
 * Tag attributes are preserved; matching is case-insensitive.
 */
export function demoteH1ToH2(html: string): string {
  if (!html) return "";
  return html
    .replace(/<h1(\s[^>]*)?>/gi, "<h2$1>")
    .replace(/<\/h1\s*>/gi, "</h2>");
}

/**
 * Clean Persian meta description for a PDP, ~150 chars:
 * `{short product name}؛ {key feature} | قیمت {X} تومان | ای کا جی کالا`
 * Never contains raw HTML or entities.
 */
export function buildProductMetaDescription(product: ProductSeoInput): string {
  const MAX_TOTAL = 155;
  const brandSuffix = " | ای کا جی کالا";
  const pricePart =
    typeof product.price === "number" && product.price > 0
      ? ` | قیمت ${product.price.toLocaleString(FA_DIGITS)} تومان`
      : "";

  const summary = firstSentence(stripHtmlToText(product.description), 90);
  const head = summary ? `${product.title}؛ ${summary}` : product.title;

  const budget = Math.max(20, MAX_TOTAL - pricePart.length - brandSuffix.length);
  return `${truncateWords(head, budget)}${pricePart}${brandSuffix}`;
}

/**
 * PDP title: `خرید {title} | {brand} - قیمت و مشخصات`.
 * When the brand is missing/blank the brand segment is omitted entirely
 * (no «بدون برند» fallback text).
 */
export function buildProductSeoTitle(product: ProductSeoInput): string {
  const brand = (product.brand || "").trim();
  return brand
    ? `خرید ${product.title} | ${brand} - قیمت و مشخصات`
    : `خرید ${product.title} - قیمت و مشخصات`;
}
