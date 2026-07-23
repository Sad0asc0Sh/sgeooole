"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export const NAV_STACK_KEY = "ekg_internal_nav_stack";

/**
 * Utility to retrieve current internal navigation stack depth from sessionStorage
 */
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
 * Resolves the issue where direct visitors (e.g. from Torob, Google, direct link)
 * clicking the top-right close 'X' button on a product page are either stuck or sent back to Torob.
 * 
 * If the user has internal history within the web app, it performs a normal router.back().
 * If the user landed directly on the page (from Torob, external referral, or direct link),
 * it navigates to the fallback URL (defaults to home page '/').
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
            const stackLength = stack.length;

            // Internal history exists if:
            // 1. Session stack has visited more than 1 internal path
            // OR
            // 2. document.referrer is from our domain AND browser history length > 1
            const hasInternalHistory =
                stackLength > 1 || (isInternalReferrer && window.history.length > 1);

            if (hasInternalHistory) {
                // Remove current page from session stack before popping back
                try {
                    if (stack.length > 0) {
                        stack.pop();
                        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
                    }
                } catch {}

                router.back();
            } else {
                // Direct landing (e.g. Torob, direct link, external referrer)
                router.push(fallbackUrl);
            }
        },
        [router]
    );

    return handleSmartBack;
}
