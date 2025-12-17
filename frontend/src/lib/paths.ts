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
