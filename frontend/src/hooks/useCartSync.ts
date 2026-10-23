"use client";

import { useEffect } from "react";
import { authService } from "@/services/authService";
import { useCartStore } from "@/store/cartStore";

/** Ignore duplicate resume events fired by the same navigation. */
const MIN_GAP_MS = 1200;
/** A short tab switch should not hit the backend; a long one should. */
const FOREGROUND_GAP_MS = 30_000;

/**
 * Keeps the cart truthful when the document is RESUMED instead of freshly
 * mounted — the exact moment a previous page can come back with a stale cart:
 *
 *  - `pageshow` with `persisted` → the page was restored from the browser's
 *    back/forward cache. Its React state predates the add-to-cart performed in
 *    the product document, so the bottom-nav badge would otherwise stay empty
 *    until a reload. (Forced sync, no throttle.)
 *  - `popstate` → back/forward inside the SPA. Guest carts are re-read from
 *    localStorage, which every mutation writes synchronously, so the badge is
 *    correct before the previous page finishes painting.
 *  - `visibilitychange` → the tab/PWA returned after a long pause; prices,
 *    promotions and the server cart may all have moved on.
 *
 * Deliberately NOT `router.refresh()`: that throws away the cached page, its
 * scroll restoration and its in-flight work — exactly the experience this app
 * is tuned to keep. We only re-read the cart store and let its subscribers
 * (bottom nav badge, header badge, cart page) re-render in place.
 */
export function useCartSync() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        let lastSyncAt = 0;

        const sync = (minGapMs: number = MIN_GAP_MS) => {
            const now = Date.now();
            if (now - lastSyncAt < minGapMs) return;
            lastSyncAt = now;
            void useCartStore.getState().syncCartFromSource();
        };

        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) sync(0);
        };

        const handlePopState = () => {
            // Authenticated carts are merged after every mutation; a network
            // round-trip on each back press would only add latency. Guests get
            // their localStorage snapshot re-read — free and always current.
            if (authService.isAuthenticated()) return;
            sync();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") sync(FOREGROUND_GAP_MS);
        };

        window.addEventListener("pageshow", handlePageShow);
        window.addEventListener("popstate", handlePopState);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("pageshow", handlePageShow);
            window.removeEventListener("popstate", handlePopState);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);
}
