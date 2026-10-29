"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type RouteLoadingContextValue = {
  isCurrentRouteReady: boolean;
  markRoutePending: () => void;
  markRouteReady: () => void;
};

const RouteLoadingContext = createContext<RouteLoadingContextValue | null>(null);

/**
 * Phase 2 SEO (CSR→SSR fix).
 *
 * Root cause of the site-wide CSR shells: the previous version called
 * useSearchParams() at the top of THIS provider, which wraps the ENTIRE app
 * (<ClientLayout>{children}</ClientLayout> inside one <Suspense> in the root
 * layout). During static prerendering that single hook forced every route
 * (/, /products, /blog, /about, /contact) to bail out to client-side
 * rendering — the SSR HTML was an empty shell (0 links, 0 h1).
 *
 * Fix: usePathname() does NOT suspend during prerender, so the pathname part
 * of the route key stays in the shell. Only the search-params suffix is read
 * inside <SearchSuffixTracker/>, which suspends inside its OWN <Suspense>
 * boundary and renders nothing — so the page (header, nav, content, footer)
 * server-renders normally while the tracker hydrates on the client.
 */
export default function RouteLoadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // usePathname() is prerender-safe (no suspense). The query suffix arrives
  // from the tracker after hydration; until then the key is pathname-only,
  // exactly as a fresh server render would see it.
  const pathname = usePathname();
  const [searchSuffix, setSearchSuffix] = useState("");
  const routeKey = `${pathname}${searchSuffix}`;
  const [readyRouteKey, setReadyRouteKey] = useState<string | null>(null);

  const markRoutePending = useCallback(() => {
    setReadyRouteKey(null);
  }, []);

  const markRouteReady = useCallback(() => {
    setReadyRouteKey(routeKey);
  }, [routeKey]);

  const value = useMemo(
    () => ({
      isCurrentRouteReady:
        readyRouteKey !== null && readyRouteKey === routeKey,
      markRoutePending,
      markRouteReady,
    }),
    [markRoutePending, markRouteReady, readyRouteKey, routeKey]
  );

  return (
    <RouteLoadingContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <SearchSuffixTracker onSuffix={setSearchSuffix} />
      </Suspense>
    </RouteLoadingContext.Provider>
  );
}

/**
 * Reads the query string (suspends during prerender inside its own boundary)
 * and reports it upward. Renders nothing and never blocks page content.
 */
function SearchSuffixTracker({
  onSuffix,
}: {
  onSuffix: (suffix: string) => void;
}) {
  const searchParams = useSearchParams();
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  useEffect(() => {
    onSuffix(suffix);
  }, [suffix, onSuffix]);
  return null;
}

export function useRouteLoadingState() {
  const context = useContext(RouteLoadingContext);
  if (!context) {
    throw new Error(
      "useRouteLoadingState must be used within RouteLoadingProvider"
    );
  }
  return context;
}
