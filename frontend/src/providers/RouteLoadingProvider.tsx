"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type RouteLoadingContextValue = {
  isCurrentRouteReady: boolean;
  markRoutePending: () => void;
  markRouteReady: () => void;
};

const RouteLoadingContext = createContext<RouteLoadingContextValue | null>(null);

export default function RouteLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const [readyRouteKey, setReadyRouteKey] = useState<string | null>(null);

  const markRoutePending = useCallback(() => {
    setReadyRouteKey(null);
  }, []);

  const markRouteReady = useCallback(() => {
    setReadyRouteKey(routeKey);
  }, [routeKey]);

  const value = useMemo(
    () => ({
      isCurrentRouteReady: readyRouteKey === routeKey,
      markRoutePending,
      markRouteReady,
    }),
    [markRoutePending, markRouteReady, readyRouteKey, routeKey],
  );

  return <RouteLoadingContext.Provider value={value}>{children}</RouteLoadingContext.Provider>;
}

export function useRouteLoadingState() {
  const context = useContext(RouteLoadingContext);
  if (!context) {
    throw new Error("useRouteLoadingState must be used within RouteLoadingProvider");
  }
  return context;
}
