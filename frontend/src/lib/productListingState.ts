import { buildProductListingParams, type ProductFilterFacets, type ProductListingParams } from "@/lib/productFilters";
import type { Product } from "@/types/product";

export const PRODUCT_LISTING_PAGE_SIZE = 24;

export const PRODUCT_LISTING_CACHE_POLICY = {
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
} as const;

export type ProductListingResult = {
  products: Product[];
  total: number;
  totalPages: number;
  currentPage: number;
  priceRange?: { min: number; max: number };
  facets?: ProductFilterFacets;
};

export type InitialProductListing = ProductListingResult & { cacheKey: string };

export function buildListingCacheKey(query: ProductListingParams): string {
  return `product-listing:${buildProductListingParams(query).toString()}`;
}

type ProductListingReadinessInput = {
  hasData: boolean;
  isValidating: boolean;
  isStale: boolean;
  hasError: boolean;
};

/**
 * سیاست نمایش لیست محصولات (بدون پرش صفحه).
 *
 * قاعده‌ی طلایی: اگر داده‌ای وجود دارد، هرگز آن را با اسکلتون جایگزین نکن.
 *   - اسکلتون کامل فقط در بارگذاری اولیه (بدون داده و بدون خطا)
 *   - وقتی داده هست و درخواست جدید در جریان است ⇒ `showUpdating`
 *     (گرید قبلی می‌ماند و فقط یک لایه‌ی نرم/اسپینر کوچک اضافه می‌شود)
 */
export function getProductListingReadiness({
  hasData,
  isValidating,
  isStale,
  hasError,
}: ProductListingReadinessInput) {
  const isReady = hasData && !isValidating && !isStale && !hasError;

  return {
    isReady,
    showSkeleton: !hasData && !hasError,
    showUpdating: hasData && isValidating && !hasError,
    showError: hasError,
  };
}
