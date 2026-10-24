"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ChevronLeft, LayoutGrid, Shapes } from "lucide-react";
import ResilientImage from "@/components/ui/ResilientImage";
import { categoryService, type Category } from "@/services/categoryService";
import { trackCategoryClick, trackCategoryView } from "@/lib/categoryTracking";
import { CATEGORY_FILTER_HREF } from "@/lib/categoryNavigation";
import styles from "./HomeCategoryShowcase.module.css";

type HomeCategoryShowcaseProps = {
  /** Server-rendered featured categories; used as SWR fallback data. */
  featured: Category[] | null;
  /** Server-rendered popular categories; merged after featured, de-duplicated. */
  popular: Category[] | null;
};

type CategoryVisual = Category["image"] | Category["icon"] | string | null | undefined;

const MAX_CATEGORIES = 10;
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Persian two-digit plaque index, deterministic on server and client. */
function formatIndex(index: number): string {
  return String(index + 1)
    .padStart(2, "0")
    .replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}

function imageUrl(value: CategoryVisual): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.url || undefined;
}

function categoryHref(category: Category): string {
  return `/products?category=${encodeURIComponent(category.slug || category._id)}&includeChildren=true`;
}

function CategoryCard({ category, index }: { category: Category; index: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const visual = imageUrl(category.image) || imageUrl(category.icon);
  const showImage = Boolean(visual) && !imageFailed;

  return (
    <Link
      href={categoryHref(category)}
      className={styles.card}
      onClick={() => {
        void trackCategoryClick(category._id, "homepage");
      }}
      data-category-id={category._id}
    >
      <span className={styles.cardTop} aria-hidden="true">
        <span className={styles.index}>{formatIndex(index)}</span>
        <span className={styles.go}>
          <ArrowLeft size={12} strokeWidth={2.2} />
        </span>
      </span>

      <span className={styles.thumb} aria-hidden="true">
        {showImage ? (
          <ResilientImage
            src={visual as string}
            alt=""
            fill
            sizes="60px"
            quality={75}
            showSkeleton={false}
            wrapperClassName={styles.thumbArt}
            className={styles.thumbImg}
            fallbackSrc="/placeholder.png"
            onRetryExhausted={() => setImageFailed(true)}
          />
        ) : (
          <Shapes className={styles.thumbFallback} size={22} strokeWidth={1.7} />
        )}
      </span>

      <span className={styles.copy}>
        <span className={styles.name}>{category.name}</span>
        <span className={styles.cta} aria-hidden="true">
          مشاهده محصولات
          <ChevronLeft size={10} strokeWidth={2.5} />
        </span>
      </span>
    </Link>
  );
}

/**
 * Homepage category showcase.
 *
 * Replaces the old middle-banner row under the hero: both category feeds
 * (featured + popular) are merged, de-duplicated and shown as one premium
 * "atlas" rail. The middle banners now live below the timed-offers section.
 */
export default function HomeCategoryShowcase({
  featured,
  popular,
}: HomeCategoryShowcaseProps) {
  const headingId = useId();
  const viewedIds = useRef(new Set<string>());

  const featuredState = useSWR<Category[]>(
    "homepage-categories-featured",
    () => categoryService.getHomepage("featured"),
    {
      fallbackData: featured ?? undefined,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      keepPreviousData: true,
    }
  );

  const popularState = useSWR<Category[]>(
    "homepage-categories-popular",
    () => categoryService.getHomepage("popular"),
    {
      fallbackData: popular ?? undefined,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      keepPreviousData: true,
    }
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const merged: Category[] = [];

    const push = (list: Category[] | undefined) => {
      list?.forEach((category) => {
        if (!category) return;
        // Dedupe on both id and slug: the analytics "popular" feed may return
        // an aggregate row whose id differs from the category document.
        const keys = [category._id, category.slug].filter(
          (key): key is string => Boolean(key)
        );
        if (keys.length === 0 || keys.some((key) => seen.has(key))) return;
        keys.forEach((key) => seen.add(key));
        merged.push(category);
      });
    };

    // Featured first — it is the curated, editorial order.
    push(featuredState.data);
    push(popularState.data);

    return merged.slice(0, MAX_CATEGORIES);
  }, [featuredState.data, popularState.data]);

  const isLoading =
    categories.length === 0 &&
    (featuredState.isLoading || popularState.isLoading);
  const hasError =
    categories.length === 0 &&
    Boolean(featuredState.error || popularState.error);
  const isRetrying = featuredState.isValidating || popularState.isValidating;

  useEffect(() => {
    categories.slice(0, 3).forEach((category) => {
      if (viewedIds.current.has(category._id)) return;
      viewedIds.current.add(category._id);
      void trackCategoryView(category._id, "homepage", "view");
    });
  }, [categories]);

  // A successful, genuinely empty feed should remove the section entirely.
  if (!isLoading && !hasError && categories.length === 0) {
    return null;
  }

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      aria-busy={isLoading || undefined}
      data-home-categories="showcase"
    >
      <div className={styles.shell}>
        <span className={styles.rings} aria-hidden="true" />

        <div className={styles.inner}>
          <header className={styles.header}>
            <div className={styles.heading}>
              <p className={styles.kicker}>مسیر خرید</p>
              <h2 className={styles.title} id={headingId}>
                دسته‌بندی‌ها
              </h2>
              <p className={styles.subtitle}>
                از میان دسته‌های اصلی، سریع‌تر به انتخاب درست برسید.
              </p>
            </div>

            <Link href={CATEGORY_FILTER_HREF} className={styles.allLink}>
              <LayoutGrid className={styles.allIcon} size={13} aria-hidden="true" />
              <span>همه دسته‌بندی‌ها</span>
              <ChevronLeft className={styles.allArrow} size={13} aria-hidden="true" />
            </Link>
          </header>

          {isLoading ? (
            <div
              className={styles.skeletonRail}
              role="status"
              aria-label="در حال بارگذاری دسته‌بندی‌ها"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className={styles.skeletonItem} aria-hidden="true" />
              ))}
            </div>
          ) : hasError ? (
            <div className={styles.feedback} role="status">
              <p>بارگذاری دسته‌بندی‌ها انجام نشد.</p>
              <button
                type="button"
                className={styles.retry}
                disabled={isRetrying}
                onClick={() => {
                  void Promise.all([featuredState.mutate(), popularState.mutate()]);
                }}
              >
                {isRetrying ? "در حال تلاش…" : "تلاش مجدد"}
              </button>
            </div>
          ) : (
            <ul className={styles.rail} aria-label="دسته‌بندی‌های فروشگاه">
              {categories.map((category, index) => (
                <li key={category._id || category.slug} className={styles.item}>
                  <CategoryCard category={category} index={index} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
