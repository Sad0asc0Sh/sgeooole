"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, LayoutGrid, Shapes } from "lucide-react";
import { useResilientImage } from "@/components/ui/ResilientImage";
import { categoryService, type Category } from "@/services/categoryService";
import { CATEGORY_FILTER_HREF } from "@/lib/categoryNavigation";
import styles from "./HomeCategoryShowcase.module.css";

type HomeCategoryShowcaseProps = {
  /** Server-rendered homepage categories; used as SWR fallback data. */
  categories: Category[] | null;
};

type CategoryVisual = Category["image"] | Category["icon"] | string | null | undefined;

const SCROLL_STEP_FACTOR = 0.8;

function imageUrl(value: CategoryVisual): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.url || undefined;
}

function categoryHref(category: Category): string {
  return `/products?category=${encodeURIComponent(category.slug || category._id)}&includeChildren=true`;
}

function CategoryCircleImage({ url, name }: { url: string; name: string }) {
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
 * Homepage category carousel.
 *
 * Design reverse-engineered from technolife.com's category strip: a white
 * panel with circular, ring-outlined category badges, labels underneath and
 * circular arrow buttons on both edges. Colors and radii follow the site's
 * own saffron/stone palette so the section reads native, not borrowed.
 */
export default function HomeCategoryShowcase({ categories }: HomeCategoryShowcaseProps) {
  const headingId = useId();
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
    <section
      className={styles.section}
      aria-labelledby={headingId}
      aria-busy={showSkeleton || undefined}
      data-home-categories="carousel"
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.title} id={headingId}>
            دسته‌بندی‌ها
          </h2>
          <Link href={CATEGORY_FILTER_HREF} className={styles.allLink}>
            <LayoutGrid size={14} aria-hidden="true" />
            <span>همه دسته‌بندی‌ها</span>
            <ChevronLeft size={14} aria-hidden="true" />
          </Link>
        </header>

        <div className={styles.stage}>
          <span className={`${styles.fade} ${styles.fadeStart}`} aria-hidden="true" />

          {showSkeleton ? (
            <div className={styles.skeletonRail} role="status" aria-label="در حال بارگذاری دسته‌بندی‌ها">
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index} className={styles.skeletonItem} aria-hidden="true">
                  <span className={styles.skeletonCircle} />
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
                    <Link href={categoryHref(category)} className={styles.category} data-category-id={category._id}>
                      <span className={styles.ring}>
                        {url ? (
                          <CategoryCircleImage url={url} name={category.name} />
                        ) : (
                          <Shapes size={30} strokeWidth={1.6} aria-hidden="true" />
                        )}
                      </span>
                      <span className={styles.name}>{category.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <span className={`${styles.fade} ${styles.fadeEnd}`} aria-hidden="true" />

          {!showSkeleton && !showError && items.length > 3 && (
            <>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowStart}`}
                onClick={() => scrollRail("prev")}
                disabled={edge.start}
                aria-label="دسته‌بندی‌های قبلی"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowEnd}`}
                onClick={() => scrollRail("next")}
                disabled={edge.end}
                aria-label="دسته‌بندی‌های بعدی"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
