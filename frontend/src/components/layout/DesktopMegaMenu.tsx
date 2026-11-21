"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useCategoryTree } from "@/hooks/useCategories";
import MegaMenuPanel from "@/components/features/categories/MegaMenuPanel";
import { normalizeCategoryTree } from "@/components/features/categories/tree";

const CLOSE_DELAY_MS = 200;

/**
 * Desktop hover mega menu — a full-width clone of snappshop's AllCategories
 * panel: pill rail on the right, fixed-width link columns that wrap. The page
 * behind stays scrollable (no backdrop dim, no scroll lock), like the original.
 */
export default function DesktopMegaMenu() {
    const pathname = usePathname();
    const { categoryTree, isLoading } = useCategoryTree();
    const categories = useMemo(
        () => normalizeCategoryTree(categoryTree),
        [categoryTree],
    );
    const [isOpen, setIsOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [panelTop, setPanelTop] = useState<number | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerRef = useRef<HTMLDivElement | null>(null);

    // The active root must survive tree refreshes.
    useEffect(() => {
        if (!categories.length) return;
        if (!activeId || !categories.some((c) => c.id === activeId)) {
            setActiveId(categories[0].id);
        }
    }, [categories, activeId]);

    const clearCloseTimer = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const updateTop = useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) setPanelTop(rect.bottom);
    }, []);

    const openMenu = () => {
        clearCloseTimer();
        updateTop();
        setIsOpen(true);
    };

    const scheduleClose = () => {
        clearCloseTimer();
        closeTimer.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
    };

    useEffect(() => () => clearCloseTimer(), []);

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

    return (
        <div className="relative">
            {/* Trigger */}
            <div
                ref={triggerRef}
                onMouseEnter={openMenu}
                onMouseLeave={scheduleClose}
                aria-haspopup="true"
                aria-expanded={isOpen}
                className="flex items-center gap-2 cursor-pointer py-2 px-2 text-ekg-900 hover:text-kala-600 transition-colors"
            >
                <Menu className="w-6 h-6" />
                <span className="font-bold text-sm">همه دسته‌بندی‌ها</span>
            </div>

            {isOpen && createPortal(
                <>
                    {/* Transparent click-away layer — no dimming, like the original */}
                    <div
                        aria-hidden="true"
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 z-[39]"
                    />

                    {/* Panel */}
                    <div
                        onMouseEnter={clearCloseTimer}
                        onMouseLeave={scheduleClose}
                        style={{
                            top: panelTop ?? 0,
                            maxHeight: panelTop ? `calc(100dvh - ${panelTop + 16}px)` : undefined,
                        }}
                        className="fixed inset-x-0 z-[40] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.12)] border-b border-ekg-200/70 overflow-hidden"
                        role="region"
                        aria-label="همه دسته‌بندی‌ها"
                    >
                        <div className="w-full max-w-[1440px] mx-auto flex items-start">
                            {skeleton ? (
                                <div className="flex w-full gap-6 p-6" aria-hidden="true">
                                    <div className="w-[146px] flex flex-col gap-3">
                                        {Array.from({ length: 9 }).map((_, i) => (
                                            <div key={i} className="h-10 rounded-lg bg-ekg-100 animate-pulse" />
                                        ))}
                                    </div>
                                    <div className="flex-1 flex flex-wrap gap-x-6 gap-y-2 content-start">
                                        {Array.from({ length: 24 }).map((_, i) => (
                                            <div key={i} className="h-4 w-[168px] rounded bg-ekg-100 animate-pulse" />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start w-full py-6 px-4 lg:px-6">
                                    <MegaMenuPanel
                                        roots={categories}
                                        activeId={activeId}
                                        onActivate={setActiveId}
                                        contentMaxHeight={panelTop ? `calc(100dvh - ${panelTop + 16}px - 48px)` : undefined}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>,
                document.body,
            )}
        </div>
    );
}
