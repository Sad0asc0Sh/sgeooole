import { useCallback, useEffect, useRef } from "react";

let activeScrollLocks = 0;
let originalBodyOverflow = "";
let originalBodyPaddingRight = "";
let originalHtmlOverflow = "";

const getScrollbarWidth = (): number => {
    if (typeof window === "undefined") return 0;
    if (typeof document === "undefined") return 0;
    const html = document.documentElement;
    if (!html) return 0;
    return window.innerWidth - html.clientWidth;
};

export function useScrollLock() {
    const isLockedRef = useRef(false);

    const lock = useCallback(() => {
        if (typeof document === "undefined") return;
        if (typeof window === "undefined") return;
        if (isLockedRef.current) return;

        const body = document.body;
        const html = document.documentElement;
        if (!body || !html) return;

        isLockedRef.current = true;

        if (activeScrollLocks === 0) {
            originalBodyOverflow = body.style.overflow;
            originalBodyPaddingRight = body.style.paddingRight;
            originalHtmlOverflow = html.style.overflow;

            const scrollbarWidth = getScrollbarWidth();
            const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

            body.style.overflow = "hidden";
            html.style.overflow = "hidden";

            if (scrollbarWidth > 0) {
                body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
            }
        }

        activeScrollLocks += 1;
    }, []);

    const unlock = useCallback(() => {
        if (typeof document === "undefined") return;
        if (typeof window === "undefined") return;
        if (!isLockedRef.current) return;

        const body = document.body;
        const html = document.documentElement;
        if (!body || !html) return;

        isLockedRef.current = false;

        activeScrollLocks = Math.max(0, activeScrollLocks - 1);
        if (activeScrollLocks > 0) return;

        body.style.overflow = originalBodyOverflow;
        body.style.paddingRight = originalBodyPaddingRight;
        html.style.overflow = originalHtmlOverflow;
    }, []);

    useEffect(() => {
        return () => {
            unlock();
        };
    }, [unlock]);

    return { lock, unlock };
}

