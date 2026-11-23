"use client";

import { useMemo, memo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import HomeImage from "./HomeImage";
import { useFlashDeals } from "@/hooks/useProducts";
import { usePromotionBoundary } from "@/hooks/usePromotionBoundary";
import { buildProductUrl } from "@/lib/paths";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import imageStyles from "@/components/product/ProductImageFrame.module.css";
import PromotionSection from "@/components/promotion/PromotionSection";
import PromotionHeader from "@/components/promotion/PromotionHeader";
import PromotionBadge from "@/components/promotion/PromotionBadge";
import Countdown from "@/components/ui/Countdown";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import { useVelocitySnap } from "@/hooks/useVelocitySnap";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { resolveCardPricing } from "@/lib/promotions/variantCardPricing";
import type { Product } from "@/types/product";
import styles from "./HomeProductRail.module.css";

/**
 * Flash Offer Rail Component - horizontal strip of flash deals
 * OPTIMIZED: Uses SWR for caching, React.memo for card components
 */
function FlashOfferRail({ initialProducts, initialNow }: { initialProducts?: Product[]; initialNow?: number }) {
  const { flashDeals, refresh } = useFlashDeals(100, initialProducts);
  const now = usePromotionBoundary(flashDeals, () => { void refresh(); }, initialNow);
  const { onTouchStart, onTouchEnd } = useVelocitySnap();

  // Filter products with active countdown - removes expired products in real-time.
  // Variable products need at least one sellable discounted variant to stay in the rail.
  const activeFlashDeals = useMemo(() => {
    return flashDeals.filter((product) => {
      if (!resolveProductPromotion(product, now).isFlashDealActive) return false;
      return resolveCardPricing(product, { now, context: "promo" }).hasDiscountedVariant;
    });
  }, [flashDeals, now]);

  if (activeFlashDeals.length === 0) {
    return null;
  }

  return (
    <PromotionSection>
      <PromotionHeader
        title={getPromotionCopy("promotion.section.timed.title")}
        description={getPromotionCopy("promotion.section.timed.description")}
        actionHref="/products?sort=flash"
        actionLabel={getPromotionCopy("promotion.action.viewAll")}
      />

      <div className="relative mt-5">
        <Swiper
          modules={[Navigation]}
          navigation={{
            nextEl: '.swiper-button-next-flash',
            prevEl: '.swiper-button-prev-flash',
          }}
          onSwiper={(swiper) => {
            const saved = getScrollManager().getHorizontal("flash_deals");
            if (typeof saved === "number" && saved > 0) {
              swiper.slideTo(saved, 0);
            }
          }}
          onSlideChange={(swiper) => {
            getScrollManager().saveHorizontal("flash_deals", swiper.activeIndex);
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          shortSwipes={false}
          longSwipes={false}
          followFinger={true}
          speed={300}
          spaceBetween={12}
          slidesPerView="auto"
          className={`${styles.carousel} ${styles.promotionCarousel}`}
          grabCursor
        >
          {activeFlashDeals.map((product) => {
            // Single source: the card pricing resolver in promo context (all items
            // here are live by filter; the rep is the cheapest discounted variant).
            const pricing = resolveCardPricing(product, { now, context: "promo" });
            const effectiveDiscount = pricing.discountPercent;
            const showSpecialOfferPricing = pricing.originalPrice !== undefined;
            const displayPrice = pricing.displayPrice;

            const isOutOfStock = product.countInStock === 0;
            const isLowStock = product.countInStock > 0 && product.countInStock <= 3;

            return (
              <SwiperSlide key={product.id} className={styles.slide}>
                <Link href={buildProductUrl(product)} prefetch={false} className="block h-full w-full">
                  <div className="group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-ekg-100 bg-white p-3 shadow-sm transition-all duration-300 hover:border-kala-200 hover:shadow-md">
                    <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <PromotionBadge label={getPromotionCopy("promotion.reason.timed.label")} tone="timed" />
                        {isLowStock ? (
                          <PromotionBadge label={getPromotionCopy("promotion.reason.limitedStock.label")} tone="limited" />
                        ) : product.campaignLabel ? (
                          <PromotionBadge label={product.campaignLabel} tone="campaign" />
                        ) : null}
                      </div>
                    </div>

                    <div className={`${imageStyles.frame} ${styles.imageFrame} mb-3`}>
                      <HomeImage
                        src={product.cardImage || product.image || "/placeholder.svg"}
                        backupSources={[product.image]}
                        alt={product.name}
                        width={420}
                        height={420}
                        className={`absolute inset-0 ${imageStyles.image} transition-transform duration-500 ${isOutOfStock ? "grayscale opacity-60" : "group-hover:scale-105"}`}
                      />

                      {/* OUT OF STOCK OVERLAY */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-700 shadow-sm">
                            ناموجود
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mb-2 flex justify-center">
                      {product.flashDealEndTime && (
                        <Countdown targetDate={product.flashDealEndTime} variant="compact" initialNow={initialNow} />
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className={`mb-2 min-h-[40px] text-right text-[11px] font-bold leading-5 line-clamp-2 ${isOutOfStock ? "text-gray-400" : "text-gray-700"
                        }`}
                    >
                      {product.name}
                    </h3>

                    {/* Price Section */}
                    <div className="mt-auto flex flex-col gap-1">
                      {/* Row 1: Old Price (if discount and in stock) */}
                      <div className="flex h-5 items-center justify-between gap-1">
                        {product.countInStock > 0 && effectiveDiscount > 0 && showSpecialOfferPricing && pricing.originalPrice !== undefined ? (
                          <>
                            <PromotionBadge label={`${effectiveDiscount.toLocaleString("fa-IR")}٪`} tone="discount" />
                            <span className="text-[11px] text-gray-300 line-through decoration-gray-300">
                              {pricing.originalPrice.toLocaleString("fa-IR")}
                            </span>
                          </>
                        ) : (
                          <div className="h-5" />
                        )}
                      </div>

                      {/* Row 2: Current Price */}
                      <div
                        className={`flex items-center justify-end gap-1 ${isOutOfStock ? "text-gray-400" : "text-gray-800"
                          }`}
                        aria-label={pricing.isFrom && !isOutOfStock ? `شروع از ${displayPrice.toLocaleString("fa-IR")} تومان` : `${displayPrice.toLocaleString("fa-IR")} تومان`}
                      >
                        {!isOutOfStock && pricing.isFrom && <span className="text-[10px] text-gray-500 ml-1">از</span>}
                        <span className="text-[15px] font-black tracking-tight">
                          {displayPrice.toLocaleString("fa-IR")}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${isOutOfStock ? "text-gray-400" : "text-gray-600"
                            }`}
                        >
                          تومان
                        </span>
                      </div>
                      {pricing.isPartial && !isOutOfStock && (
                        <span className="text-[10px] text-gray-500">تخفیف روی چند مدل</span>
                      )}
                    </div>
                  </div>
                </Link>
              </SwiperSlide>
            );
          })}

          {/* "See All" Card (Last Slide) */}
          <SwiperSlide className={styles.slide}>
            <Link href="/products?sort=flash" className="block h-full w-full">
              <div className="flex h-full min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ekg-200 bg-white/70 px-4 py-6 transition-all duration-300 hover:border-kala-300 hover:bg-white hover:shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-kala-200 bg-kala-50 text-kala-700 transition-colors duration-300">
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </div>
                <span className="text-sm font-bold text-gray-700">
                  {getPromotionCopy("promotion.action.viewAll")}
                </span>
                <span className="text-center text-[10px] leading-5 text-gray-400">
                  {getPromotionCopy("promotion.action.viewAllOpportunities")}
                </span>
              </div>
            </Link>
          </SwiperSlide>
        </Swiper>

        {/* Navigation Arrows - Desktop Only */}
        <button className="swiper-button-prev-flash absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ekg-100 bg-white/90 text-ekg-700 shadow-sm backdrop-blur-sm transition-all hover:border-kala-200 hover:bg-white md:flex">
          <ChevronLeft className="rotate-180" size={20} />
        </button>
        <button className="swiper-button-next-flash absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ekg-100 bg-white/90 text-ekg-700 shadow-sm backdrop-blur-sm transition-all hover:border-kala-200 hover:bg-white md:flex">
          <ChevronLeft size={20} />
        </button>
      </div>
    </PromotionSection>
  );
}

// Export with memo for component-level memoization
export default memo(FlashOfferRail);
