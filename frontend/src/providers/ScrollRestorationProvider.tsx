"use client";

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getScrollManager } from '@/lib/scroll/ScrollManager';

export default function ScrollRestorationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <ScrollRestorationController />
      </Suspense>
    </>
  );
}

function ScrollRestorationController() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKeyRef = useRef<string>('');
  const hasHandledInitialRouteRef = useRef(false);

  const key = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  currentKeyRef.current = key;

  // 1. Disable browser's internal jumpy scroll restoration & track nav stack
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('ekg_internal_nav_stack');
      const stack: string[] = raw ? JSON.parse(raw) : [];
      if (stack.length === 0 || stack[stack.length - 1] !== key) {
        stack.push(key);
        if (stack.length > 20) stack.shift();
        sessionStorage.setItem('ekg_internal_nav_stack', JSON.stringify(stack));
      }
    } catch {}
  }, [key]);

  // 2. Global Scroll & Click Tracker: Continuously save position for the active page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const manager = getScrollManager();

    const saveCurrentScroll = () => {
      if (currentKeyRef.current && !pathname.startsWith('/product/')) {
        const y = window.scrollY || window.pageYOffset || 0;
        if (y > 0) {
          manager.save(currentKeyRef.current, y);
        }
      }
    };

    const handleScroll = () => {
      saveCurrentScroll();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      // Save scroll when user clicks on product links or navigation links
      const anchor = target.closest('a[href]');
      if (anchor instanceof HTMLAnchorElement) {
        saveCurrentScroll();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', saveCurrentScroll);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveCurrentScroll();
    });
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', saveCurrentScroll);
      document.removeEventListener('click', handleClick, true);
    };
  }, [pathname]);

  // 3. Page Mount / Route Change restoration logic
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const manager = getScrollManager();
    const isInitialRoute = !hasHandledInitialRouteRef.current;
    hasHandledInitialRouteRef.current = true;

    // A new document navigation (for example, entering from a Google result)
    // must not inherit the previous visit's home-page scroll state from
    // sessionStorage. Back/forward navigation still uses the saved state.
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isFreshDocumentNavigation = navigationEntry?.type === 'navigate';
    if (isInitialRoute && pathname === '/' && isFreshDocumentNavigation) {
      manager.clear(key);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }

    if (pathname.startsWith('/product/')) {
      // Detail page: always start at top 0
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } else if (pathname === '/products') {
      // The listing restores scroll only after its query data is stable.
      // Restoring here can expose footer and previous cached content first.
      return;
    } else {
      // Check if we have a saved scroll position for this route (e.g. Home '/' or '/products')
      const savedY = manager.getSavedY(key);

      if (typeof savedY === 'number' && savedY > 0) {
        // We have a saved scroll position for this page -> restore it dynamically!
        manager.restore(key);
      } else {
        // First time visit or explicit menu push -> scroll to top
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    }
  }, [key, pathname, searchParams]);

  return null;
}



