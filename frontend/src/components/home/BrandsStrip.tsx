"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import SectionHeader from "@/components/ui/SectionHeader";
import { brandService, HomepageBrand } from "@/services/brandService";

/**
 * Brands carried.
 * ============================================================================
 * WHY THIS IS KEPT
 * Brand is a primary filter in this category — an installer very often arrives
 * knowing they need Dahua or Hikvision and nothing else. So this is real
 * discovery, not a logo wall, and it links straight into the filtered listing.
 *
 * WHAT WAS FIXED
 *   - Each logo was a `<div onClick>` with mouse-only drag-to-scroll built from
 *     five pieces of local state (`isDown`, `startX`, `scrollLeft`,
 *     `isDragging`, `hoveredBrand`). Not focusable, not keyboard-operable, and
 *     inert under touch. They are now real `<Link>`s: keyboard, middle-click,
 *     "open in new tab" and native touch scrolling all work, and the five state
 *     variables plus four mouse handlers are gone.
 *   - Each brand supplied its own `textColor` and `hoverColor` from the API and
 *     applied them inline, so this strip could render arbitrary colours that
 *     belong to no palette. Brand *logos* keep their own colours (correct — that
 *     is the brand's identity); the surrounding chrome is now EKGKala's.
 *   - `SectionTitle`'s gold highlighter swipe is replaced by the shared header.
 */
export default function BrandsStrip() {
    const [brands, setBrands] = useState<HomepageBrand[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        brandService
            .getHomepageBrands()
            .then((data) => {
                if (isMounted) setBrands(data);
            })
            .catch(() => {
                if (isMounted) setBrands([]);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (!isLoading && brands.length === 0) return null;

    return (
        <div className="space-y-5">
            {/* No `actionHref`: the app has `/brands/[slug]` but no `/brands`
                index, so a "all brands" link would 404. */}
            <SectionHeader
                id="home-brands"
                title="برندهای موجود"
                description="تأمین از نمایندگی‌های رسمی."
            />

            {isLoading ? (
                <div className="flex gap-3 overflow-hidden" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="skeleton h-20 w-32 shrink-0 rounded-xl" />
                    ))}
                </div>
            ) : (
                <ul
                    aria-labelledby="home-brands"
                    className="no-scrollbar flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6"
                    style={{ scrollSnapType: "x proximity" }}
                >
                    {brands.map((brand) => (
                        <li
                            key={brand._id}
                            className="w-32 shrink-0 sm:w-auto"
                            style={{ scrollSnapAlign: "start" }}
                        >
                            <Link
                                href={`/products?brand=${encodeURIComponent(brand.slug || brand._id)}`}
                                className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface px-3 py-4 transition-colors hover:border-kala-200 hover:bg-kala-50/40"
                            >
                                {brand.logo?.url ? (
                                    <div className="relative h-9 w-full">
                                        <ResilientImage
                                            src={brand.logo.url}
                                            alt=""
                                            fill
                                            aria-hidden="true"
                                            // Logos are grayscale at rest so the
                                            // strip reads as one calm band, then
                                            // resolve to full colour on hover.
                                            // Keeps a dozen competing brand
                                            // palettes from fighting each other.
                                            className="object-contain grayscale opacity-70 transition-[filter,opacity] duration-300 hover:grayscale-0 hover:opacity-100"
                                            sizes="128px"
                                            fallbackSrc="/placeholder.svg"
                                        />
                                    </div>
                                ) : null}
                                <span className="text-center text-[11.5px] font-semibold tracking-wide text-ink-muted">
                                    {brand.name}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
