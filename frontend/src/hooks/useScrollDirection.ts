import { useState, useEffect, useRef } from 'react';

interface ScrollDirectionOptions {
    /**
     * حداقل فاصله اسکرول (به پیکسل) برای این‌که تغییر جهت معتبر حساب شود
     */
    threshold?: number;
    /**
     * فاصله‌ای از بالای صفحه که همیشه در آن نوار دوم نمایش داده شود
     */
    topOffset?: number;
    /**
     * حداقل فاصله‌ای که باید از آخرین تغییر وضعیت طی شود تا دوباره تغییر کنیم
     * برای جلوگیری از چشمک زدن سریع
     */
    minSwitchDistance?: number;
}

export function useScrollDirection(options: ScrollDirectionOptions = {}) {
    const { threshold = 10, topOffset = 50, minSwitchDistance = 40 } = options;
    const [isVisible, setIsVisible] = useState(true);

    // نگه‌داری آخرین موقعیت اسکرول و آخرین وضعیت نمایش بدون دخالت در DOM
    const lastScrollYRef = useRef(0);
    const lastToggleYRef = useRef(0);
    const lastVisibilityRef = useRef(true);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // مقدار اولیه برای زمان لود صفحه یا تغییر روت
        const initialScrollY = window.scrollY || 0;
        lastScrollYRef.current = initialScrollY;
        lastToggleYRef.current = initialScrollY;
        lastVisibilityRef.current = true;
        setIsVisible(true);

        let rafId: number | null = null;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // همیشه نزدیک بالای صفحه، نوار دوم را نمایش بده و همه stateهای مرجع را هم‌تراز کن
            if (currentScrollY < topOffset) {
                if (!lastVisibilityRef.current) {
                    setIsVisible(true);
                    lastVisibilityRef.current = true;
                    lastToggleYRef.current = currentScrollY;
                }
                lastScrollYRef.current = currentScrollY;
                return;
            }

            const prevScrollY = lastScrollYRef.current;
            const diff = currentScrollY - prevScrollY;

            // اگر حرکت کمتر از آستانه بود، فقط مرجع اسکرول را به‌روز کن و برگرد
            if (Math.abs(diff) < threshold) {
                lastScrollYRef.current = currentScrollY;
                return;
            }

            const nextVisible = diff < 0; // بالا رفتن => نمایش

            // اگر از آخرین تغییر وضعیت، فاصله‌ی کافی اسکرول نشده، تغییر نده تا چشمک نزند
            const distanceSinceLastToggle = Math.abs(currentScrollY - lastToggleYRef.current);
            if (nextVisible !== lastVisibilityRef.current && distanceSinceLastToggle < minSwitchDistance) {
                lastScrollYRef.current = currentScrollY;
                return;
            }

            if (nextVisible !== lastVisibilityRef.current) {
                setIsVisible(nextVisible);
                lastVisibilityRef.current = nextVisible;
                lastToggleYRef.current = currentScrollY;
            }

            lastScrollYRef.current = currentScrollY;
        };

        const onScroll = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(handleScroll);
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', onScroll);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, [threshold, topOffset, minSwitchDistance]);

    return isVisible;
}
