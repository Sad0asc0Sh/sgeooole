"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export const NAV_STACK_KEY = "ekg_internal_nav_stack";

export function getInternalNavStack(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = sessionStorage.getItem(NAV_STACK_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Custom hook for smart back/close navigation.
 * Performs router.back() if history exists, otherwise falls back to fallbackUrl.
 */
export function useSmartBack() {
    const router = useRouter();

    const handleSmartBack = useCallback(
        (fallbackUrl: string = "/") => {
            if (typeof window === "undefined") {
                router.push(fallbackUrl);
                return;
            }

            let isInternalReferrer = false;
            if (document.referrer) {
                try {
                    const refUrl = new URL(document.referrer);
                    if (refUrl.origin === window.location.origin) {
                        isInternalReferrer = true;
                    }
                } catch {
                    isInternalReferrer = false;
                }
            }

            const stack = getInternalNavStack();
            const hasInternalHistory = stack.length > 1 || (isInternalReferrer && window.history.length > 1);

            if (hasInternalHistory) {
                try {
                    router.back();
                } catch {
                    router.push(fallbackUrl);
                }
            } else {
                router.push(fallbackUrl);
            }
        },
        [router]
    );

    return handleSmartBack;
}

