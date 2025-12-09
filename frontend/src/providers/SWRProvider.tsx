"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

interface SWRProviderProps {
    children: ReactNode;
}

/**
 * Global SWR Configuration Provider
 * Provides optimized caching and error handling for all SWR hooks
 */
export default function SWRProvider({ children }: SWRProviderProps) {
    return (
        <SWRConfig
            value={{
                // Don't refetch on window focus (reduces unnecessary API calls)
                revalidateOnFocus: false,
                // Don't refetch on reconnect
                revalidateOnReconnect: false,
                // Dedupe requests within 60 seconds
                dedupingInterval: 60000,
                // Retry failed requests twice
                errorRetryCount: 2,
                // Keep previous data while revalidating (prevents flash)
                keepPreviousData: true,
                // Cache data for 5 minutes by default
                refreshInterval: 0, // Disable auto-refresh by default
                // Suspense mode for better loading states (optional)
                suspense: false,
                // Error handler
                onError: (error, key) => {
                    if (process.env.NODE_ENV === "development") {
                        console.error(`[SWR Error] ${key}:`, error);
                    }
                },
                // Custom fetcher with timeout
                fetcher: async (url: string) => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    try {
                        const response = await fetch(url, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}`);
                        }
                        return response.json();
                    } catch (error) {
                        clearTimeout(timeoutId);
                        throw error;
                    }
                },
            }}
        >
            {children}
        </SWRConfig>
    );
}
