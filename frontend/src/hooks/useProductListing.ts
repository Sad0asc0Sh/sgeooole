"use client";

import { useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { Cache } from "swr";
import { productService, Product } from "@/services/productService";
import { appendPropertyFilters, type ProductFilterFacets, type ProductFilterProperties } from "@/lib/productFilters";
import { getProductListingReadiness, PRODUCT_LISTING_CACHE_POLICY } from "@/lib/productListingState";

const ITEMS_PER_PAGE = 24;
const listingCacheTimestamps = new Map<string, number>();
const listingCacheGcTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleListingCacheEviction(cache: Cache<unknown>, cacheKey: string, fetchedAt: number) {
  const existingTimer = listingCacheGcTimers.get(cacheKey);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    if (listingCacheTimestamps.get(cacheKey) === fetchedAt) {
      cache.delete(cacheKey);
      listingCacheTimestamps.delete(cacheKey);
      listingCacheGcTimers.delete(cacheKey);
    }
  }, PRODUCT_LISTING_CACHE_POLICY.gcTime);

  listingCacheGcTimers.set(cacheKey, timer);
}

export type ProductListingQuery = {
  page: number;
  sort: string;
  category?: string;
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  includeChildren?: boolean;
  inStock?: boolean;
  onSale?: boolean;
  minRating?: number;
  properties?: ProductFilterProperties;
};

export type ProductListingResult = {
  products: Product[];
  total: number;
  totalPages: number;
  currentPage: number;
  priceRange?: { min: number; max: number };
  facets?: ProductFilterFacets;
};

function buildListingCacheKey(query: ProductListingQuery): string {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("sort", query.sort);
  if (query.category) params.set("category", query.category);
  if (query.brand) params.set("brand", query.brand);
  if (query.search) params.set("search", query.search);
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.includeChildren) params.set("includeChildren", "true");
  if (query.inStock) params.set("inStock", "true");
  if (query.onSale) params.set("onSale", "true");
  if (query.minRating !== undefined) params.set("minRating", String(query.minRating));
  appendPropertyFilters(params, query.properties, "prop_");
  return `product-listing:${params.toString()}`;
}

async function fetchProductListing(query: ProductListingQuery): Promise<ProductListingResult> {
  const data = await productService.getProducts({
    page: query.page,
    limit: ITEMS_PER_PAGE,
    sort: query.sort,
    category: query.category,
    brand: query.brand,
    search: query.search,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    includeChildren: query.includeChildren,
    inStock: query.inStock,
    onSale: query.onSale,
    minRating: query.minRating,
    properties:
      query.properties && Object.keys(query.properties).length > 0
        ? query.properties
        : undefined,
  });

  return {
    products: data.products,
    total: data.total,
    totalPages: data.totalPages,
    currentPage: data.currentPage,
    priceRange: data.priceRange,
    facets: data.facets,
  };
}

export function useProductListing(query: ProductListingQuery) {
  const cacheKey = useMemo(() => buildListingCacheKey(query), [query]);
  const { cache } = useSWRConfig();
  const fetchedAt = listingCacheTimestamps.get(cacheKey);
  const isStale = !fetchedAt || Date.now() - fetchedAt >= PRODUCT_LISTING_CACHE_POLICY.staleTime;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    cacheKey,
    () => fetchProductListing(query),
    {
      // SWR has no `staleTime` / `gcTime` options. The policy below provides
      // their equivalents for this listing: a bounded fresh window plus
      // explicit cache eviction after the maximum retention period.
      revalidateOnMount: isStale,
      revalidateIfStale: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 0,
      dedupingInterval: PRODUCT_LISTING_CACHE_POLICY.staleTime,
      // هنگام تغییر فیلتر/صفحه، داده‌ی قبلی حفظ می‌شود تا گرید محصولات
      // پاک نشود و کاربر پرش صفحه (layout shift) نبیند — رفتار ترب/تکنولایف.
      keepPreviousData: true,
      onSuccess: () => {
        const completedAt = Date.now();
        listingCacheTimestamps.set(cacheKey, completedAt);
        scheduleListingCacheEviction(cache, cacheKey, completedAt);
      },
    },
  );

  const readiness = getProductListingReadiness({
    hasData: Boolean(data),
    isValidating,
    isStale: Boolean(data) && isStale,
    hasError: Boolean(error),
  });

  return {
    products: data?.products ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    currentPage: data?.currentPage ?? query.page,
    priceRange: data?.priceRange,
    facets: data?.facets,
    isLoading,
    isValidating,
    error,
    mutate,
    hasCache: Boolean(data),
    isStale: Boolean(data) && isStale,
    ...readiness,
  };
}
