"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { useResilientImage } from "@/components/ui/ResilientImage";
import SectionHeader from "@/components/ui/SectionHeader";
import type { Category } from "@/services/categoryService";
import { trackCategoryView, trackCategoryClick } from "@/lib/categoryTracking";
import { getScrollManager } from "@/lib/scroll/ScrollManager";

/**
 * Category discovery.
 * ============================================================================
 * WHAT CHANGED AND WHY
 *
 * The homepage previously rendered this component twice, back to back —
 * «دسته‌های ویژه» as gold-ringed circles, then «دسته‌های محبوب» as grey cards.
 * Two problems:
 *
 *   1. Cognitive fatigue. Two adjacent rails of category icons, styled
 *      differently, asking the same question ("which category?"). Users cannot
 *      tell what distinguishes "featured" from "popular" — those are *admin*
 *      concepts, not shopper concepts.
 *   2. The `circle` variant clipped every icon into a ring with a gold gradient
 *      border. Product-category icons (a dome camera, an NVR chassis, a cable
 *      reel) are wide, and a circular mask cut them off.
 *
 * Now there is one category section, one visual treatment, taking the union of
 * both admin-managed lists — so both admin fields still drive the homepage, but
 * the customer sees one coherent answer.
 *
 * AUTO-SCROLL REMOVED
 * The old rail scrolled itself sideways every 6 seconds. That moves a tap
 * target out from under a finger mid-reach, has no pause control, and ignores
 * `prefers-reduced-motion`. Removing it also deletes ~90 lines of timer and
 * pause-state bookkeeping. Horizontal position restoration — which was genuinely
 * useful — is kept.
 */

function CategoryTile({ category, onSelect }: { category: Category; onSelect: () => void }) {
    const iconUrl = category.image?.url || category.icon?.url || null;
    const { src, onError, onLoad, ref, phase } = useResilientImage(
        iconUrl ?? "/placeholder.svg",
        "/placeholder.svg",
    );

    return (
        <Link
            href={`/products?category=${category.slug || category._id}&includeChildren=true`}
            onClick={onSelect}
            className="group flex h-full flex-col items-center gap-2.5 rounded-xl border border-line-soft bg-surface p-3 text-center transition-colors hover:border-kala-200 hover:bg-kala-50/40"
        >
            {/* Square frame, `object-contain`: shows the whole icon whatever its
                aspect ratio, which the previous circular mask could not. */}
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-surface-sunken">
                {phase === "skeleton" ? (
                    <div className="skeleton absolute inset-0" aria-hidden="true" />
                ) : null}

                {iconUrl ? (
                    <img
                        ref={ref}
                        src={src}
                        alt=""
                        onError={onError}
                        onLoad={onLoad}
                        aria-hidden="true"
                        className="h-full w-full object-contain p-1.5 transition-opacity duration-300"
                        style={{ opacity: phase === "loaded" || phase === "error" ? 1 : 0 }}
                    />
                ) : (
                    <Package size={22} className="text-ink-faint" aria-hidden="true" />
                )}
            </div>

            {/* The link text is the accessible name, so the image above is
                intentionally `alt=""` rather than repeating it. */}
            <span className="line-clamp-2 text-[11.5px] font-medium leading-5 text-ink-muted transition-colors group-hover:text-kala-700">
                {category.name}
            </span>
        </Link>
    );
}

interface CategoryRailProps {
    title: string;
    description?: string;
    data: Category[];
}

export default function CategoryRail({ title, description, data }: CategoryRailProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Restore the user's horizontal position when they navigate back into the
    // homepage. Kept from the original implementation.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const key = "home_categories";
        const saved = getScrollManager().getHorizontal(key);
        if (typeof saved === "number" && saved > 0) {
            container.scrollLeft = saved;
        }

        const handleScroll = () => {
            getScrollManager().saveHorizontal(key, container.scrollLeft);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        data.slice(0, 6).forEach((category) => {
            if (category._id) trackCategoryView(category._id, "homepage", "view");
        });
    }, [data]);

    if (!data || data.length === 0) return null;

    return (
        <div className="space-y-5">
            <SectionHeader
                id="home-categories"
                title={title}
                description={description}
                actionHref="/categories"
                actionLabel="همه دسته‌بندی‌ها"
            />

            {/* Scroll strip on mobile, grid from `sm` up. `role="list"` because
                the flex/grid container's semantics are otherwise lost, and this
                is genuinely a list of destinations. */}
            <div
                ref={containerRef}
                role="list"
                aria-labelledby="home-categories"
                className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6 xl:grid-cols-8"
                style={{ scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}
            >
                {data.map((category) => (
                    <div
                        key={category._id}
                        role="listitem"
                        className="w-[104px] shrink-0 sm:w-auto"
                        style={{ scrollSnapAlign: "start" }}
                    >
                        <CategoryTile
                            category={category}
                            onSelect={() => trackCategoryClick(category._id, "homepage")}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
