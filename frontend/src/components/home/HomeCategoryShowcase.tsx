"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Shapes } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import { categoryImageSources, categoryProductHref } from "@/lib/categoryNavigation";
import { categoryService, type Category } from "@/services/categoryService";
import HomeImage from "./HomeImage";
import styles from "./HomeCategoryShowcase.module.css";

type HomeCategoryShowcaseProps = {
  /** Server-rendered homepage categories; used as SWR fallback data. */
  categories: Category[] | null;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function HomeCategoryPlaceholder() {
  return (
    <section className={styles.section} aria-busy="true">
      <div className={styles.stage}>
        <div className={styles.skeletonRail} role="status" aria-label="در حال بارگذاری دسته‌بندی‌ها">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className={styles.skeletonItem} aria-hidden="true">
              <span className={styles.skeletonBadge} />
              <span className={styles.skeletonLabel} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Homepage category strip — reverse-engineered from technolife.com's
 * "CircleCategories" (#stories) component and localized to ekgkala's
 * saffron (kala) and warm stone (ekg) tokens:
 *
 *   carousel: RTL Swiper with fluid CSS `--cat-slides` breakpoints
 *             (3.2 -> 3.5 -> 4.5 -> 5 -> 5.5 -> 6 -> 7 -> 8 slides)
 *             for zero-CLS SSR parity, 6000ms hover-pausing autoplay
 *   badge   : outer circle with 2px brand-colored padding -> thin ring
 *   disc    : white circle that shrinks 4px on desktop hover -> thicker ring
 *   hairline: 1px light-tint border circle holding the image
 *   label   : 12px mobile (2-line clamp) / 15-16px desktop below the ring
 *   nav     : 32px desktop-only white circle buttons (prev right, next left)
 */
export default function HomeCategoryShowcase({ categories }: HomeCategoryShowcaseProps) {
  const carouselId = useId();
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [edges, setEdges] = useState({ beginning: true, end: false, locked: false });
  const [reducedMotion, setReducedMotion] = useState(false);

  // وقتی داده از SSR آمده، هیچ درخواست تکراری در mount نزن
  // (قبلاً revalidateOnMount: true باعث دانلود دوباره‌ی همان لیست می‌شد).
  const hasSsrData = categories !== null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<Category[]>(
    "homepage-categories",
    () => categoryService.getHomepage(),
    {
      fallbackData: categories ?? undefined,
      revalidateOnMount: !hasSsrData,
      revalidateOnFocus: false,
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
  const hasMultipleItems = !showSkeleton && !showError && items.length > 1;

  useEffect(() => {
    const media = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!media) return;
    const syncMotion = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        swiperRef.current?.autoplay?.stop();
      } else if (hasMultipleItems) {
        swiperRef.current?.autoplay?.start();
      }
    };
    syncMotion();
    if (media.addEventListener) {
      media.addEventListener("change", syncMotion);
      return () => media.removeEventListener("change", syncMotion);
    }
    media.addListener?.(syncMotion);
    return () => media.removeListener?.(syncMotion);
  }, [hasMultipleItems]);

  const syncEdges = useCallback((swiper: SwiperInstance) => {
    const next = {
      beginning: swiper.isBeginning,
      end: swiper.isEnd,
      locked: Boolean(swiper.isLocked),
    };
    setEdges((prev) =>
      prev.beginning === next.beginning &&
      prev.end === next.end &&
      prev.locked === next.locked
        ? prev
        : next
    );
  }, []);

  // A successful, genuinely empty feed should remove the section entirely.
  if (showSkeleton) return <HomeCategoryPlaceholder />;
  if (!showError && items.length === 0) return null;

  return (
    <section className={styles.section} data-home-categories="carousel">
      <h2 className={styles.srTitle}>دسته‌بندی‌های فروشگاه</h2>

      <div className={styles.stage}>
        {showError ? (
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
          <Swiper
            id={carouselId}
            dir="rtl"
            modules={[A11y, Autoplay]}
            a11y={{
              prevSlideMessage: "دسته‌بندی قبلی",
              nextSlideMessage: "دسته‌بندی بعدی",
              slideLabelMessage: "{{index}} از {{slidesLength}}",
            }}
            slidesPerView="auto"
            spaceBetween={0}
            speed={350}
            grabCursor
            watchOverflow
            centerInsufficientSlides
            resistanceRatio={0.65}
            autoplay={
              reducedMotion || items.length <= 1
                ? false
                : {
                    delay: 6000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                  }
            }
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
              syncEdges(swiper);
            }}
            onSlideChange={syncEdges}
            onResize={syncEdges}
            onUpdate={syncEdges}
            onLock={syncEdges}
            onUnlock={syncEdges}
            onBreakpoint={syncEdges}
            className={styles.carousel}
          >
            {items.map((category, index) => {
              const [url, ...backups] = categoryImageSources(category);
              return (
                <SwiperSlide key={category._id || category.slug} className={styles.slide}>
                  <Link
                    href={categoryProductHref(category)}
                    className={styles.category}
                    title={category.name}
                    data-category-id={category._id}
                  >
                    <span className={styles.badge}>
                      <span className={styles.disc}>
                        <span className={styles.hairline}>
                          {url ? (
                            <HomeImage
                              src={url}
                              backupSources={backups}
                              alt={category.name}
                              width={114}
                              height={114}
                              loading={index < 4 ? "eager" : "lazy"}
                            />
                          ) : (
                            <Shapes className={styles.fallbackIcon} strokeWidth={1.5} aria-hidden="true" />
                          )}
                        </span>
                      </span>
                    </span>
                    <span className={styles.label}>{category.name}</span>
                  </Link>
                </SwiperSlide>
              );
            })}
          </Swiper>
        )}

        {hasMultipleItems && (
          <>
            <button
              type="button"
              className={`${styles.nav} ${styles.navPrev}${edges.locked ? ` ${styles.navHidden}` : ""}`}
              onClick={() => swiperRef.current?.slidePrev()}
              disabled={edges.beginning || edges.locked}
              aria-label="دسته‌بندی‌های قبلی"
              aria-controls={carouselId}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.navNext}${edges.locked ? ` ${styles.navHidden}` : ""}`}
              onClick={() => swiperRef.current?.slideNext()}
              disabled={edges.end || edges.locked}
              aria-label="دسته‌بندی‌های بعدی"
              aria-controls={carouselId}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
