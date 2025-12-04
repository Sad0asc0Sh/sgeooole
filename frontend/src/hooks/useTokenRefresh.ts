import { useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';

/**
 * Hook for automatic token refresh
 * Checks token expiration and refreshes it before it expires
 * 
 * @param enabled - Whether auto-refresh is enabled (default: true)
 * @param checkInterval - Interval to check token expiration in ms (default: 60000 = 1 minute)
 * @param refreshBuffer - Minutes before expiry to refresh token (default: 5)
 */
export const useTokenRefresh = (
    enabled: boolean = true,
    checkInterval: number = 60000, // 1 minute
    refreshBuffer: number = 5 // 5 minutes before expiry
) => {
    const checkAndRefreshToken = useCallback(async () => {
        if (!enabled || typeof window === 'undefined') {
            return;
        }

        try {
            // Check if user is authenticated
            if (!authService.isAuthenticated()) {
                return;
            }

            // Check if token is expired or will expire soon
            if (authService.isTokenExpired(refreshBuffer)) {
                const expiry = authService.getTokenExpiry();
                console.log('[TOKEN REFRESH] Token will expire soon:', expiry);
                console.log('[TOKEN REFRESH] Attempting to refresh token...');

                const result = await authService.refreshToken();

                if (result.success) {
                    console.log('[TOKEN REFRESH] Token refreshed successfully');

                    // Dispatch custom event to notify other components
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new Event('token-refreshed'));
                    }
                } else {
                    console.warn('[TOKEN REFRESH] Token refresh failed');
                }
            }
        } catch (error) {
            console.error('[TOKEN REFRESH] Error in token refresh check:', error);
        }
    }, [enabled, refreshBuffer]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        // Initial check
        checkAndRefreshToken();

        // Set up interval for periodic checks
        const intervalId = setInterval(checkAndRefreshToken, checkInterval);

        // Listen for visibility change to refresh when tab becomes active
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAndRefreshToken();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, checkInterval, checkAndRefreshToken]);

    return {
        checkAndRefreshToken,
    };
};
