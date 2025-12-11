import { useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';

/**
 * Hook for automatic token refresh
 * Checks token expiration and refreshes it before it expires
 * 
 * NOTE: Token refresh functionality is not yet implemented in authService.
 * This hook currently only performs authentication checks.
 * 
 * @param enabled - Whether auto-refresh is enabled (default: true)
 * @param checkInterval - Interval to check token in ms (default: 60000 = 1 minute)
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

            // TODO: Implement token refresh when authService supports it
            // Currently, we just verify the user is still authenticated
            // Future implementation would check token expiry and refresh

        } catch (error) {
            console.error('[TOKEN REFRESH] Error in token check:', error);
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

        // Listen for visibility change to check when tab becomes active
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
