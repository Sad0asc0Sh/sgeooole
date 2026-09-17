"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import type { Product } from "@/types/product";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import { useVelocitySnap } from "@/hooks/useVelocitySnap";
import HomeProductCard from "./HomeProductCard";
import styles from "./HomeProductRail.module.css";

export type HomeProductRailProps = {
  title: string;
  description: string;
  products: Product[];
  viewAllHref: string;
  railKey: string;
  now: number;
  tone?: "plain" | "promotion";
  countdown?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

export default function HomeProductRail({
  title, description, products, viewAllHref, railKey, now,
  tone = "plain", countdown, loading = false, error = false, onRetry,
}: HomeProductRailProps) {
  const headingId = useId();
  const carouselId = useId();
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [edges, setEdges] = useState({ beginning: true, end: false, locked: false });
  const { onTouchStart, onTouchEnd } = useVelocitySnap();
  const syncEdges = (swiper: SwiperInstance) => {
    const next = { beginning: swiper.isBeginning, end: swiper.isEnd, locked: Boolean(swiper.isLocked) };
    setEdges((previous) => previous.beginning === next.beginning && previous.end === next.end && previous.locked === next.locked ? previous : next);
  };

  return (
    <section aria-labelledby={headingId} className={`${styles.section} ${tone === "promotion" ? styles.promotion : ""}`} data-product-rail={railKey}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={headingId}>{title}</h2>
            <p>{description}</p>
          </div>
          <div className={styles.actions}>
            {countdown && <div className={styles.sectionCountdown}>{countdown}</div>}
            <Link href={viewAllHref} className={styles.viewAll}>مشاهده همه <ChevronLeft size={16} aria-hidden /></Link>
            {!loading && !error && <div className={styles.navigation}>
              <button type="button" aria-label={`محصولات قبلی ${title}`} aria-controls={carouselId} disabled={edges.beginning || edges.locked} onClick={() => swiperRef.current?.slidePrev()}>
                <ChevronRight size={18} aria-hidden />
              </button>
              <button type="button" aria-label={`محصولات بعدی ${title}`} aria-controls={carouselId} disabled={edges.end || edges.locked} onClick={() => swiperRef.current?.slideNext()}>
                <ChevronLeft size={18} aria-hidden />
              </button>
            </div>}
          </div>
        </header>

        {loading ? (
          <div className={styles.skeletonRail} role="status" aria-label={`در حال بارگذاری ${title}`}>
            {Array.from({ length: 6 }, (_, index) => <div key={index} className={styles.skeletonCard} aria-hidden />)}
          </div>
        ) : error ? (
          <div className={styles.feedback} role="status">
            <p>بارگذاری محصولات انجام نشد.</p>
            <button type="button" onClick={onRetry} className={styles.viewAll}>تلاش مجدد</button>
          </div>
        ) : (
          <Swiper
            id={carouselId}
            dir="rtl"
            modules={[A11y]}
            a11y={{ prevSlideMessage: "محصول قبلی", nextSlideMessage: "محصول بعدی", slideLabelMessage: "{{index}} از {{slidesLength}}" }}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
              const saved = getScrollManager().getHorizontal(railKey);
              if (typeof saved === "number" && saved > 0) swiper.slideTo(Math.min(saved, products.length), 0);
              syncEdges(swiper);
            }}
            onSlideChange={(swiper) => {
              getScrollManager().saveHorizontal(railKey, swiper.activeIndex);
              syncEdges(swiper);
            }}
            onResize={syncEdges}
            onUpdate={syncEdges}
            onLock={syncEdges}
            onUnlock={syncEdges}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            shortSwipes={false}
            longSwipes={false}
            speed={300}
            spaceBetween={12}
            slidesPerView={1.65}
            breakpointsBase="container"
            breakpoints={{
              360: { slidesPerView: 2 },
              480: { slidesPerView: 2.5 },
              640: { slidesPerView: 3 },
              800: { slidesPerView: 4 },
              1040: { slidesPerView: 5 },
              1280: { slidesPerView: 6 },
            }}
            className={styles.carousel}
            grabCursor
            watchOverflow
          >
            {products.map((product) => (
              <SwiperSlide key={product.id} className={styles.slide}>
                <HomeProductCard product={product} now={now} />
              </SwiperSlide>
            ))}
            <SwiperSlide className={styles.slide}>
              <Link href={viewAllHref} className={styles.moreCard}>
                <span className={styles.moreIcon}><ChevronLeft size={24} aria-hidden /></span>
                <span>مشاهده همه</span>
                <span className={styles.moreDescription}>{title}</span>
              </Link>
            </SwiperSlide>
          </Swiper>
        )}
      </div>
    </section>
  );
}
