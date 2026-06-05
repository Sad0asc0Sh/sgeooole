"use client";

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Global scroll restoration provider
 * Disables browser's automatic scroll restoration and sets up manual control
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
  const navigationTypeRef = useRef<'push' | 'pop' | 'initial'>('initial');

  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      // Set to manual to take full control
      window.history.scrollRestoration = 'manual';
    }

    // Listen for popstate (back/forward navigation)
    const handlePopState = () => {
      navigationTypeRef.current = 'pop';
    };

    window.addEventListener('popstate', handlePopState);

    // Intercept pushState and replaceState to track navigation type
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      navigationTypeRef.current = 'push';
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function (...args) {
      return originalReplaceState.apply(this, args);
    };

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Handle scroll behavior based on navigation type
  useEffect(() => {
    const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    // Skip on initial mount
    if (navigationTypeRef.current === 'initial') {
      navigationTypeRef.current = 'push';
      previousPathRef.current = currentPath;
      return;
    }

    // Only scroll to top on push navigation (not back/forward)
    if (navigationTypeRef.current === 'push' && previousPathRef.current !== currentPath) {
      // Small delay to ensure navigation is complete
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      });
    }

    // Reset navigation type for next navigation
    navigationTypeRef.current = 'push';
    previousPathRef.current = currentPath;
  }, [pathname, searchParams]);

  return null;
}
