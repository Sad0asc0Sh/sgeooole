"use client";

import { useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { Cache } from "swr";
import { productService } from "@/services/productService";
import type { ProductListingParams } from "@/lib/productFilters";
import {
  buildListingCacheKey,
  getProductListingReadiness,
  PRODUCT_LISTING_CACHE_POLICY,
  PRODUCT_LISTING_PAGE_SIZE,
  type InitialProductListing,
} from "@/lib/productListingState";

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

type ProductListingQuery = Omit<ProductListingParams, "limit"> & {
  page: number;
  sort: string;
};

export function useProductListing(
  query: ProductListingQuery,
  initialData?: InitialProductListing | null,
) {
  const cacheKey = useMemo(() => buildListingCacheKey(query), [query]);
  const { cache } = useSWRConfig();
  const cachedData = cache.get(cacheKey)?.data;
  const fetchedAt = listingCacheTimestamps.get(cacheKey);
  const fallbackData = initialData?.cacheKey === cacheKey ? initialData : undefined;
  const needsRevalidation = cachedData === undefined || !fetchedAt || Date.now() - fetchedAt >= PRODUCT_LISTING_CACHE_POLICY.staleTime;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    cacheKey,
    () => productService.getProducts({ ...query, limit: PRODUCT_LISTING_PAGE_SIZE }),
    {
      fallbackData,
      // The server listing gives us the first paint. The browser still refreshes
      // the prices and loads filter facets when its own copy is stale or absent.
      revalidateOnMount: needsRevalidation,
      revalidateIfStale: true,
      revalidateOnFocus: true,
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

  const showingInitialData = fallbackData !== undefined && data === fallbackData;
  const hasCurrentData = data !== undefined && (showingInitialData || data === cachedData);
  const isStale = Boolean(data) && needsRevalidation && !showingInitialData;
  const readiness = getProductListingReadiness({
    hasData: Boolean(data),
    isValidating: isValidating && !showingInitialData,
    isStale: isStale && !(hasCurrentData && error),
    hasError: Boolean(error) && !hasCurrentData,
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
    isStale,
    ...readiness,
  };
}
