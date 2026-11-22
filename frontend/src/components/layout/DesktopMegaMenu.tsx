"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useCategoryTree } from "@/hooks/useCategories";
import CategoryCascadeMenu from "@/components/features/categories/CategoryCascadeMenu";
import { normalizeCategoryTree } from "@/components/features/categories/tree";
import menuStyles from "@/components/features/categories/CategoryCascadeMenu.module.css";

/** Warm stone dim (ekg-900 based) instead of a cold black overlay. */
const BACKDROP_DIM = "rgba(28, 25, 23, 0.55)";
const CASCADE_REGION_ID = "desktop-category-cascade";

/**
 * Desktop mega menu — store-native cascade opened by clicking the trigger
 * (a deliberate open, like the reference menu): once open it stays open
 * while the pointer roams the columns, and closes only on a toggle click,
 * an outside click, ✕, Escape or navigation. Desktop only; the mobile
 * experience stays in CategoriesSheet/BottomNav, untouched by this file.
 */
export default function DesktopMegaMenu() {
    const pathname = usePathname();
    const { categoryTree, isLoading } = useCategoryTree();
    const categories = useMemo(
        () => normalizeCategoryTree(categoryTree),
        [categoryTree],
    );
    const [isOpen, setIsOpen] = useState(false);
    const [panelTop, setPanelTop] = useState<number | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    // Click toggles the menu; the panel anchors below the nav row.
    const toggle = useCallback(() => {
        if (!isOpen) {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) setPanelTop(rect.bottom);
        }
        setIsOpen(!isOpen);
    }, [isOpen]);

    // Close on Escape and on navigation.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen]);

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const skeleton = isOpen && isLoading;
    const triggerClass = isOpen
        ? `${menuStyles.trigger} ${menuStyles.triggerActive}`
        : menuStyles.trigger;

    return (
        <div className="relative">
            {/* Trigger — a real button so keyboard users can open the menu too */}
            <button
                type="button"
                ref={triggerRef}
                onClick={toggle}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={CASCADE_REGION_ID}
                className={triggerClass}
            >
                <Menu className="w-5 h-5" aria-hidden="true" />
                <span>دسته بندی محصولات</span>
            </button>

            {isOpen && createPortal(
                <>
                    {/* Warm dimmed click-away layer — sits under the header
                       (z-50) and under the panel. Clicking it closes. */}
                    <div
                        aria-hidden="true"
                        onClick={() => setIsOpen(false)}
                        style={{ background: BACKDROP_DIM }}
                        className="fixed inset-0 z-[39]"
                    />

                    {/* Right-anchored full-height cascade */}
                    <div
                        id={CASCADE_REGION_ID}
                        style={{
                            top: panelTop ?? 0,
                            height: panelTop ? `calc(100dvh - ${panelTop}px)` : "100dvh",
                        }}
                        className="fixed right-0 z-[40] bg-white"
                        role="region"
                        aria-label="دسته بندی محصولات"
                    >
                        {skeleton ? (
                            <div className={menuStyles.menuStack} aria-hidden="true">
                                <div className={menuStyles.firstLevel}>
                                    <div className="flex flex-col gap-2 pt-2 pl-6">
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 p-2"
                                            >
                                                <div className="h-[40px] w-[40px] shrink-0 rounded-full bg-ekg-100 animate-pulse" />
                                                <div className="h-4 w-[110px] rounded bg-ekg-100 animate-pulse" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            categories.length ? (
                                <CategoryCascadeMenu
                                    roots={categories}
                                    onClose={() => setIsOpen(false)}
                                />
                            ) : null
                        )}
                    </div>
                </>,
                document.body,
            )}
        </div>
    );
}
