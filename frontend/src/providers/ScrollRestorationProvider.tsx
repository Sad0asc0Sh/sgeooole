"use client";

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_STACK_KEY } from '@/hooks/useSmartBack';
import { getScrollManager } from '@/lib/scroll/ScrollManager';

/**
 * Global scroll restoration provider
 * Disables browser's automatic scroll restoration and provides universal,
 * seamless scroll position tracking and restoration across all pages.
 */
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
  const previousPathRef = useRef<string>('');
  const currentPathRef = useRef<string>('');
  const lastPopTimeRef = useRef<number>(0);
  const isPopNavigationRef = useRef<boolean>(false);

  // Compute full current path key
  const fullPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  currentPathRef.current = fullPath;

  // 1. Disable browser automatic scroll restoration & intercept history popstate
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const handlePopState = () => {
      lastPopTimeRef.current = Date.now();
      isPopNavigationRef.current = true;
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 2. Universal global scroll position listener (captures scroll for ALL routes)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const manager = getScrollManager();

    const handleScroll = () => {
      if (currentPathRef.current) {
        const y = window.scrollY || window.pageYOffset || 0;
        manager.saveScrollPosition(currentPathRef.current, y);
      }
    };

    const handleImmediateSave = () => {
      if (currentPathRef.current) {
        const y = window.scrollY || window.pageYOffset || 0;
        manager.saveScrollPositionImmediate(currentPathRef.current, y);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      const anchor = target.closest('a[href], button, [role="button"]');
      if (anchor) {
        handleImmediateSave();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', handleImmediateSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleImmediateSave();
      }
    });
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', handleImmediateSave);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  // 3. Navigation lifecycle & Restoration Controller
  useEffect(() => {
    const currentPath = fullPath;
    const timeSincePop = Date.now() - lastPopTimeRef.current;
    const isPop = isPopNavigationRef.current || timeSincePop < 1500;

    // Reset pop flag after evaluation
    isPopNavigationRef.current = false;

    // Navigation Stack tracking
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(NAV_STACK_KEY);
        let stack: string[] = raw ? JSON.parse(raw) : [];

        if (isPop) {
          if (stack.length > 0 && stack[stack.length - 1] !== currentPath) {
            const existingIndex = stack.lastIndexOf(currentPath);
            if (existingIndex !== -1) {
              stack = stack.slice(0, existingIndex + 1);
            } else {
              stack.pop();
            }
          }
        } else {
          if (stack.length === 0 || stack[stack.length - 1] !== currentPath) {
            stack.push(currentPath);
            if (stack.length > 30) {
              stack = stack.slice(stack.length - 30);
            }
          }
        }
        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
      } catch (e) {
        // Ignore storage errors
      }
    }

    if (previousPathRef.current === '') {
      // Initial page mount
      previousPathRef.current = currentPath;
      return;
    }

    if (isPop) {
      // POP Navigation (Back/Forward): Restore scroll position with dynamic height locking
      void getScrollManager().restoreScrollPosition(currentPath);
    } else if (previousPathRef.current !== currentPath) {
      // PUSH Navigation (Forward Link Click): Scroll to top unless disabled by product detail page
      requestAnimationFrame(() => {
        if (!pathname.startsWith('/product/')) {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
      });
    }

    previousPathRef.current = currentPath;
  }, [fullPath, pathname, searchParams]);

  return null;
}



