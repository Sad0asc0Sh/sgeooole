import type { Product } from "@/types/product";

/**
 * Build SEO-friendly product URL
 * Format: /product/{productCode}/{slug}
 * Example: /product/ky-1234567/دوربین-مداربسته-f38
 * 
 * @param product - Product object with productCode and slug
 * @returns URL path string
 */
export const buildProductUrl = (product: Product & { productCode?: string }): string => {
  // Get product code (KY-XXXXXXX) or fallback to ID
  const code = product.productCode || product.id;

  // Get slug or fallback to product name converted to slug
  const slug = product.slug || product.id;

  return `/product/${code.toLowerCase()}/${slug}`;
};

/**
 * Percent-encode each segment of a raw (unencoded) path so it can be used
 * as an HTTP `Location` header value in a server-side redirect.
 *
 * Why this exists: buildProductUrl() returns the slug raw (e.g. Persian),
 * which is fine for <Link> hrefs and canonical tags — but a redirect target
 * is written into a response header, and Node's HTTP layer rejects any
 * non-ASCII character in a header value (ERR_INVALID_CHAR). A raw slug in
 * permanentRedirect() therefore crashed the whole request with a plain-text
 * 500 "Internal Server Error" instead of issuing the 308 redirect.
 *
 * Only the redirect target is encoded; the path stays identical after one
 * decode, so routing, canonicals and SEO are unaffected.
 *
 * @param path - Raw absolute path without query string (e.g. "/product/KY-1/اسلاگ")
 * @returns ASCII-only path safe for a Location header
 */
export const encodeRedirectPath = (path: string): string =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

/**
 * Extract product code from URL
 * Used for API calls to fetch product by code
 * 
 * @param code - Product code from URL (e.g., "ky-1234567")
 * @returns Uppercase product code (e.g., "KY-1234567")
 */
export const extractProductCode = (code: string): string => {
  return code.toUpperCase();
};

/**
 * Build category URL
 * @param categorySlug - Category slug
 */
export const buildCategoryUrl = (categorySlug: string): string => {
  return `/products?category=${encodeURIComponent(categorySlug)}`;
};
