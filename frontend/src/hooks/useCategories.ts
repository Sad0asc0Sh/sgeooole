"use client";

import useSWR from "swr";
import { categoryService, type Category } from "@/services/categoryService";

const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  dedupingInterval: 5 * 60 * 1000,
  errorRetryCount: 2,
  keepPreviousData: true,
};

export function useCategoryTree() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Category[]>(
    "category-tree",
    () => categoryService.getTree(),
    swrConfig
  );

  return {
    categoryTree: data || [],
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
  };
}

