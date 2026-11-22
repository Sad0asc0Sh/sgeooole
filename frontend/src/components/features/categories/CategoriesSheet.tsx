"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motion, useIsPresent, useReducedMotion } from "framer-motion";
import { useScrollLock } from "@/hooks/useScrollLock";
import CategoriesBrowser from "./CategoriesBrowser";
import styles from "./CategoriesSheet.module.css";

export const MOBILE_CATEGORY_MENU_ID = "mobile-category-menu";

interface CategoriesSheetProps {
  navigation: ReactNode;
  onClose: () => void;
  onNavigate: (event: { preventDefault(): void }, href: string) => void;
}

export default function CategoriesSheet({ navigation, onClose, onNavigate }: CategoriesSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { lock, unlock } = useScrollLock();
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const origin = window.location.href;
    const previousFocus = document.activeElement;
    const isNativeModal = typeof dialog.showModal === "function";
    if (isNativeModal) dialog.showModal();
    else dialog.setAttribute("open", "");
    lock();
    heading.current?.focus({ preventScroll: true });

    return () => {
      if (isNativeModal) dialog.close();
      else dialog.removeAttribute("open");
      unlock();
      if (origin === window.location.href && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [lock, unlock]);

  return (
    <dialog
      ref={ref}
      id={MOBILE_CATEGORY_MENU_ID}
      aria-labelledby="mobile-category-menu-title"
      aria-modal="true"
      dir="rtl"
      className={styles.sheet}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && typeof event.currentTarget.showModal !== "function") {
          event.preventDefault();
          onClose();
        }
      }}
      onClickCapture={(event) => {
        if (isPresent) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <h2 id="mobile-category-menu-title" ref={heading} tabIndex={-1} className="sr-only">
        دسته‌بندی کالاها
      </h2>
      <motion.div
        className={styles.surface}
        initial={reduceMotion ? false : { x: "-100%" }}
        animate={{ x: "0%" }}
        exit={{ x: reduceMotion ? "0%" : "100%" }}
        transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <CategoriesBrowser onNavigate={onNavigate} />
      </motion.div>
      {navigation}
    </dialog>
  );
}
