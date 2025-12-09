"use client";

import useSWR from "swr";
import { productService, Product } from "@/services/productService";

// SWR configuration for optimal caching
const swrConfig = {
    revalidateOnFocus: false,      // Don't refetch on window focus
    revalidateOnReconnect: false,  // Don't refetch on reconnect
    dedupingInterval: 60000,       // Dedupe requests within 60s
    errorRetryCount: 2,            // Retry failed requests twice
    keepPreviousData: true,        // Show stale data while revalidating
};

/**
 * Hook for fetching Flash Deals with SWR caching
 * Data is cached and instantly available on subsequent renders
 */
export function useFlashDeals(limit: number = 10) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<Product[]>(
        `flash-deals-${limit}`,
        () => productService.getFlashDeals(limit),
        {
            ...swrConfig,
            refreshInterval: 30000, // Refresh every 30s for time-sensitive deals
        }
    );

    return {
        flashDeals: data || [],
        isLoading,
        isValidating,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for fetching Special Offers with SWR caching
 */
export function useSpecialOffers(limit: number = 10) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<Product[]>(
        `special-offers-${limit}`,
        () => productService.getSpecialOffers(limit),
        {
            ...swrConfig,
            refreshInterval: 30000, // Refresh every 30s for time-sensitive offers
        }
    );

    return {
        specialOffers: data || [],
        isLoading,
        isValidating,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for fetching Newest Products with SWR caching
 */
export function useNewestProducts(limit: number = 10) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<Product[]>(
        `newest-products-${limit}`,
        () => productService.getNewest(limit),
        {
            ...swrConfig,
            refreshInterval: 120000, // Refresh every 2 minutes
        }
    );

    return {
        products: data || [],
        isLoading,
        isValidating,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for fetching Best Sellers with SWR caching
 */
export function useBestSellers(limit: number = 10) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<Product[]>(
        `best-sellers-${limit}`,
        () => productService.getBestSellers(limit),
        {
            ...swrConfig,
            refreshInterval: 300000, // Refresh every 5 minutes (less volatile)
        }
    );

    return {
        products: data || [],
        isLoading,
        isValidating,
        error,
        refresh: mutate,
    };
}

/**
 * Prefetch products data for faster subsequent navigation
 * Call this on page load or link hover
 */
export async function prefetchProducts() {
    // These calls will populate the SWR cache
    await Promise.all([
        productService.getFlashDeals(10),
        productService.getSpecialOffers(10),
        productService.getNewest(10),
        productService.getBestSellers(10),
    ]);
}
