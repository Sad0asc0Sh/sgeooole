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
            // Promotions change from admin: refetch when tab refocuses
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            // Allow refreshInterval to actually fire (avoid 60s dedupe blocking 30s refresh)
            dedupingInterval: 5000,
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
            // ترتیب کارت‌ها رندم است؛ فقط با رفرش صفحه دوباره چیده شود،
            // نه با رفرش دوره‌ای/فوکس/اتصال مجدد (swrConfig همین را می‌گوید).
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
        limit > 0 ? `newest-products-${limit}` : null,
        () => productService.getNewest(limit),
        {
            ...swrConfig,
            // A newest product may receive a time-limited promotion after it is
            // already visible in this rail.
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 5000,
            refreshInterval: 30000,
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
        limit > 0 ? `best-sellers-${limit}` : null,
        () => productService.getBestSellers(limit),
        {
            ...swrConfig,
            // Ranking can remain cached elsewhere, but card-level promotion
            // state must follow the same freshness policy as flash deals.
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 5000,
            refreshInterval: 30000,
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
        productService.getFlashDeals(100),
        productService.getSpecialOffers(100),
        productService.getNewest(10),
        productService.getBestSellers(10),
    ]);
}
