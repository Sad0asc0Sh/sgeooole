"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import CategoriesContent, { type CategoryBrowserProps } from "./CategoriesContent";
import styles from "./CategoriesSheet.module.css";

export default function CategoriesSheet({
  navigation, ...browser
}: CategoryBrowserProps & { navigation: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { lock, unlock } = useScrollLock();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    lock();
    dialog.querySelector("h2")?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close?.();
      unlock();
    };
  }, [lock, unlock]);

  return (
    <dialog ref={ref} id="mobile-category-menu" aria-labelledby="category-menu-title"
      dir="rtl" className={styles.sheet}
      onCancel={(event) => { event.preventDefault(); browser.backTo(browser.path.length - 1); }}>
      <CategoriesContent {...browser} />
      {navigation}
    </dialog>
  );
}
