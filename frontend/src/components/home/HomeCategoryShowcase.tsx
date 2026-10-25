"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Shapes } from "lucide-react";
import { useResilientImage } from "@/components/ui/ResilientImage";
import { categoryService, type Category } from "@/services/categoryService";
import styles from "./HomeCategoryShowcase.module.css";

type HomeCategoryShowcaseProps = {
  /** Server-rendered homepage categories; used as SWR fallback data. */
  categories: Category[] | null;
};

type CategoryVisual = Category["image"] | Category["icon"] | string | null | undefined;

const SCROLL_STEP_FACTOR = 0.75;

function imageUrl(value: CategoryVisual): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.url || undefined;
}

function categoryHref(category: Category): string {
  return `/products?category=${encodeURIComponent(category.slug || category._id)}&includeChildren=true`;
}

function CircleImage({ url, name }: { url: string; name: string }) {
  const { src, onError, onLoad, ref, phase } = useResilientImage(url, "/placeholder.png");
  return (
    <img
      ref={ref}
      src={src}
      alt={name}
      onError={onError}
      onLoad={onLoad}
      style={{ opacity: phase === "loaded" || phase === "error" ? 1 : 0 }}
    />
  );
}

/**
 * Homepage category strip — a faithful rebuild of technolife.com's
 * "CircleCategories" mechanism, inspected live from the target site:
 *
 *   slide   : fixed-width column (circle + label), snap-aligned, RTL rail
 *   badge   : outer circle with 2px brand-colored padding → thin ring
 *   disc    : white circle that SHRINKS 4px on hover → the ring thickens
 *   hairline: 1px light-tint border circle holding the image
 *   label   : separate line under the circle (12px mobile / 16px desktop)
 *   nav     : 32px floating white circle buttons at the strip edges
 *
 * The layout sits directly on the page background — no card, no title,
 * exactly like the reference. Only the palette is localized to the
 * store's saffron (kala) and warm stone (ekg) tokens.
 */
export default function HomeCategoryShowcase({ categories }: HomeCategoryShowcaseProps) {
  const railRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState<{ start: boolean; end: boolean }>({ start: true, end: false });

  const { data, error, isLoading, isValidating, mutate } = useSWR<Category[]>(
    "homepage-categories",
    () => categoryService.getHomepage(),
    {
      fallbackData: categories ?? undefined,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      keepPreviousData: true,
    }
  );

  const items = data ?? [];

  // Only surface loading/error UI when there is nothing to show —
  // a failed background refresh must not blank out server-rendered items.
  const showSkeleton = isLoading && items.length === 0;
  const showError = Boolean(error) && items.length === 0;
  const isScrollable = !showSkeleton && !showError && items.length > 1;

  const updateEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    // RTL rails: scrollLeft is 0 at the right edge and negative towards the left.
    const offset = Math.abs(rail.scrollLeft);
    setEdge({ start: offset <= 1, end: offset >= maxScroll - 1 });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, items.length]);

  const scrollRail = (direction: "next" | "prev") => {
    const rail = railRef.current;
    if (!rail) return;
    const amount = rail.clientWidth * SCROLL_STEP_FACTOR;
    // In RTL, moving to the next items means scrolling towards negative left.
    rail.scrollBy({ left: direction === "next" ? -amount : amount, behavior: "smooth" });
  };

  // A successful, genuinely empty feed should remove the section entirely.
  if (!showSkeleton && !showError && items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-busy={showSkeleton || undefined} data-home-categories="carousel">
      <h2 className={styles.srTitle}>دسته‌بندی‌های فروشگاه</h2>

      <div className={styles.stage}>
        {showSkeleton ? (
          <div className={styles.rail} role="status" aria-label="در حال بارگذاری دسته‌بندی‌ها">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className={styles.skeletonItem} aria-hidden="true">
                <span className={styles.skeletonBadge} />
                <span className={styles.skeletonLabel} />
              </span>
            ))}
          </div>
        ) : showError ? (
          <div className={styles.feedback} role="status">
            <p>بارگذاری دسته‌بندی‌ها انجام نشد.</p>
            <button
              type="button"
              className={styles.retry}
              disabled={isValidating}
              onClick={() => {
                void mutate();
              }}
            >
              {isValidating ? "در حال تلاش…" : "تلاش مجدد"}
            </button>
          </div>
        ) : (
          <ul ref={railRef} className={styles.rail} onScroll={updateEdges} aria-label="دسته‌بندی‌های فروشگاه">
            {items.map((category) => {
              const url = imageUrl(category.image) || imageUrl(category.icon);
              return (
                <li key={category._id || category.slug} className={styles.item}>
                  <Link
                    href={categoryHref(category)}
                    className={styles.category}
                    title={category.name}
                    data-category-id={category._id}
                  >
                    <span className={styles.badge}>
                      <span className={styles.disc}>
                        <span className={styles.hairline}>
                          {url ? (
                            <CircleImage url={url} name={category.name} />
                          ) : (
                            <Shapes className={styles.fallbackIcon} strokeWidth={1.5} aria-hidden="true" />
                          )}
                        </span>
                      </span>
                    </span>
                    <span className={styles.label}>{category.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {isScrollable && (
          <>
            <button
              type="button"
              className={`${styles.nav} ${styles.navPrev}`}
              onClick={() => scrollRail("prev")}
              disabled={edge.start}
              aria-label="دسته‌بندی‌های قبلی"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.navNext}`}
              onClick={() => scrollRail("next")}
              disabled={edge.end}
              aria-label="دسته‌بندی‌های بعدی"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
