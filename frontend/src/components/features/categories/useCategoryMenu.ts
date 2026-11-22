"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const historyKey = "ekgCategoryMenu";
const desktopQuery = "(min-width: 48rem)";

function hasOpenEntry() {
  return window.history.state?.[historyKey] === window.location.href;
}

export function useCategoryMenu(pathname: string) {
  const [isOpen, setIsOpen] = useState(false);
  const isClosing = useRef(false);

  const close = useCallback(() => {
    if (isClosing.current || !hasOpenEntry()) return;
    isClosing.current = true;
    window.history.back();
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia?.(desktopQuery);
    const sync = () => {
      isClosing.current = false;
      setIsOpen(!desktop?.matches && hasOpenEntry());
    };
    const resize = () => {
      if (desktop?.matches) {
        setIsOpen(false);
        close();
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
  }, [pathname, close]);

  function open() {
    if (isClosing.current || window.matchMedia?.(desktopQuery)?.matches) return;
    if (!hasOpenEntry()) {
      // One same-URL entry lets Back dismiss the sheet without leaving the page.
      window.history.pushState({ [historyKey]: window.location.href }, "");
    }
    setIsOpen(true);
  }

  function leaveForLink(event: { preventDefault(): void }, href: string) {
    if (!isOpen) return;
    if (new URL(href, window.location.href).href === window.location.href) {
      event.preventDefault();
      close();
    } else {
      setIsOpen(false);
    }
  }

  return { isOpen, open, close, leaveForLink };
}
