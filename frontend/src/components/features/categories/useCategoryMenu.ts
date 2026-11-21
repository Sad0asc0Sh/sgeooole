"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Each open level gets a same-page entry. Back from a listing can therefore
// restore the exact branch, even when Next has unmounted the bottom navigation.
const historyKey = "ekgCategoryMenu";

function readPath(): string[] | null {
  const entry = window.history.state?.[historyKey];
  return entry?.page === window.location.href && Array.isArray(entry.path)
    ? entry.path
    : null;
}

export function useCategoryMenu(pathname: string) {
  const [path, setPath] = useState<string[] | null>(null);
  const traversing = useRef(false);

  const backTo = useCallback((depth: number) => {
    const current = readPath();
    if (!current) {
      setPath(null);
      return;
    }
    if (traversing.current || depth >= current.length) return;
    traversing.current = true;
    window.history.go(depth - current.length);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width: 768px)");
    const sync = () => {
      traversing.current = false;
      setPath(desktop?.matches ? null : readPath());
    };
    const resize = () => {
      if (desktop?.matches) {
        backTo(-1);
        setPath(null);
      } else {
        sync();
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("pageshow", sync);
    if (desktop?.addEventListener) desktop.addEventListener("change", resize);
    else desktop?.addListener?.(resize);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("pageshow", sync);
      if (desktop?.removeEventListener) desktop.removeEventListener("change", resize);
      else desktop?.removeListener?.(resize);
    };
  }, [pathname, backTo]);

  function enter(id?: string) {
    if (traversing.current) return;
    const next = id === undefined ? [] : [...(readPath() ?? []), id];
    window.history.pushState({ [historyKey]: { page: window.location.href, path: next } }, "");
    setPath(next);
  }

  function leaveForLink(event: { preventDefault(): void }, href: string) {
    if (path === null) return;
    if (new URL(href, window.location.href).href === window.location.href) {
      event.preventDefault();
      backTo(-1);
    } else {
      setPath(null);
    }
  }

  return { path, enter, backTo, leaveForLink };
}
