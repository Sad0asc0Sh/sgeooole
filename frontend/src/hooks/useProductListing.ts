"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { productService, Product } from "@/services/productService";

const ITEMS_PER_PAGE = 24;

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
  properties?: Record<string, string>;
};

export type ProductListingResult = {
  products: Product[];
  total: number;
  totalPages: number;
  currentPage: number;
  priceRange?: { min: number; max: number };
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
  if (query.properties) {
    Object.entries(query.properties)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, value]) => params.set(`prop_${name}`, value));
  }
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
    properties:
      query.properties && Object.keys(query.properties).length > 0
        ? query.properties
        : undefined,
  });

  let products = data.products;
  if (query.inStock) {
    products = products.filter((product) => product.countInStock > 0);
  }

  return {
    products,
    total: data.total,
    totalPages: data.totalPages,
    currentPage: data.currentPage,
    priceRange: data.priceRange,
  };
}

export function useProductListing(query: ProductListingQuery) {
  const cacheKey = useMemo(() => buildListingCacheKey(query), [query]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    cacheKey,
    () => fetchProductListing(query),
    {
      // Discount state is edited in the admin panel; do not retain a card's
      // promotion type for minutes after that change.
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30 * 1000,
      dedupingInterval: 10 * 1000,
      keepPreviousData: true,
    },
  );

  return {
    products: data?.products ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    currentPage: data?.currentPage ?? query.page,
    priceRange: data?.priceRange,
    isLoading: isLoading && !data,
    isValidating,
    error,
    mutate,
    hasCache: Boolean(data),
  };
}
