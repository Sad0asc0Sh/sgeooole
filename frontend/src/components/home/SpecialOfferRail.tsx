"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/free-mode";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import { useSpecialOffers } from "@/hooks/useProducts";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import imageStyles from "@/components/product/ProductImageFrame.module.css";
import PromotionSection from "@/components/promotion/PromotionSection";
import PromotionHeader from "@/components/promotion/PromotionHeader";
import PromotionBadge from "@/components/promotion/PromotionBadge";
import Countdown from "@/components/ui/Countdown";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";

import type { Product } from "@/types/product";

/**
 * Special Offer Rail Component
 * OPTIMIZED: Uses SWR for caching, useMemo for computed values
 */
interface SpecialOfferRailProps {
  initialProducts?: Product[];
}

function SpecialOfferRail({ initialProducts }: SpecialOfferRailProps) {
  // SWR-based fetching with automatic caching
  const { specialOffers: products, isLoading, error } = useSpecialOffers(10, initialProducts ? { fallbackData: initialProducts } : undefined);
  const [now, setNow] = useState(() => Date.now());

  // Calculate earliest end time for global countdown
  const earliestEndTime = useMemo(() => {
    if (products.length === 0) return undefined;
    const times = products
      .filter((p) => p.specialOfferEndTime)
      .map((p) => new Date(p.specialOfferEndTime!).getTime())
      .sort((a, b) => a - b);
    return times[0];
  }, [products]);

  const isExpired = !earliestEndTime || earliestEndTime <= now;

  // Update timer every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hide section if loading, error, no products, or expired
  if (isLoading || error || products.length === 0 || isExpired) {
    return null;
  }

  return (
    <PromotionSection>
      <PromotionHeader
        title={getPromotionCopy("promotion.section.curated.title")}
        description={getPromotionCopy("promotion.section.curated.description")}
        actionHref="/products?sort=special"
        actionLabel={getPromotionCopy("promotion.action.viewAll")}
        countdown={<Countdown targetDate={earliestEndTime} variant="promotion" />}
      />

      <div className="relative mt-5">
        <Swiper
          modules={[FreeMode, Navigation]}
          freeMode
          navigation={{
            nextEl: '.swiper-button-next-special',
            prevEl: '.swiper-button-prev-special',
          }}
          spaceBetween={12}
          slidesPerView={2.3}
          breakpoints={{
            640: {
              slidesPerView: 2.5,
            },
            768: {
              slidesPerView: 3.5,
            },
            1024: {
              slidesPerView: 5,
            },
            1280: {
              slidesPerView: 6,
            },
          }}
          className="w-full !pb-2"
          grabCursor
        >
          {products.map((product, index) => {
            const isOutOfStock = product.countInStock === 0;
            const isLowStock = product.countInStock > 0 && product.countInStock <= 3;
            const hasSpecialOfferCountdown = Boolean(
              product.isSpecialOffer &&
              product.specialOfferEndTime &&
              new Date(product.specialOfferEndTime).getTime() > now
            );
            const effectiveDiscount = product.discount > 0 && (!product.isSpecialOffer || hasSpecialOfferCountdown)
              ? product.discount
              : 0;
            const displayPrice = (!hasSpecialOfferCountdown && product.oldPrice)
              ? product.oldPrice
              : product.price;

            return (
              <SwiperSlide
                key={product.id}
                style={{ width: "148px", height: "auto" }}
              >
                <Link href={`/product/${product.id}`} className="block h-full">
                  <div className="group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-ekg-100 bg-white p-3 shadow-sm transition-all duration-300 hover:border-kala-200 hover:shadow-md">
                    <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <PromotionBadge label={getPromotionCopy("promotion.reason.curated.label")} tone="curated" />
                        {isLowStock ? (
                          <PromotionBadge label={getPromotionCopy("promotion.reason.limitedStock.label")} tone="limited" />
                        ) : product.campaignLabel ? (
                          <PromotionBadge label={product.campaignLabel} tone="campaign" />
                        ) : null}
                      </div>
                    </div>

                    {/* Product Image */}
                    <div className={`${imageStyles.frame} mb-3 rounded-lg`}>
                      <ResilientImage
                        src={product.image || "/placeholder.png"}
                        alt={product.name}
                        fill
                        className={`${imageStyles.image} transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-105'}`}
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 148px"
                        loading={index < 2 ? "eager" : "lazy"}
                        priority={index < 2}
                        fetchPriority={index < 2 ? "high" : "auto"}
                        quality={70}
                        placeholder="blur"
                        blurDataURL={getBlurDataURL()}
                        fallbackSrc="/placeholder.png"
                      />

                      {/* Out of Stock Overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-700 shadow-sm">
                            ناموجود
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Product Name */}
                    <h3 className={`mb-2 min-h-[40px] text-right text-[11px] font-bold leading-5 line-clamp-2 ${isOutOfStock ? 'text-gray-400' : 'text-gray-700'}`}>
                      {product.name}
                    </h3>

                    {/* Price Section */}
                    <div className="mt-auto flex flex-col gap-1">
                      <div className="flex h-5 items-center justify-between gap-1">
                        {product.countInStock > 0 && effectiveDiscount > 0 && hasSpecialOfferCountdown ? (
                          <>
                            <PromotionBadge label={`${effectiveDiscount.toLocaleString("fa-IR")}٪`} tone="discount" />
                            <span className="text-[11px] text-gray-300 line-through decoration-gray-300">
                              {(product.compareAtPrice || product.price).toLocaleString("fa-IR")}
                            </span>
                          </>
                        ) : (
                          <div className="h-5" />
                        )}
                      </div>

                      <div className={`flex items-center justify-end gap-1 ${isOutOfStock ? 'text-gray-400' : 'text-gray-800'}`}>
                        <span className="text-[15px] font-black tracking-tight">
                          {displayPrice.toLocaleString("fa-IR")}
                        </span>
                        <span className={`text-[10px] font-medium ${isOutOfStock ? 'text-gray-400' : 'text-gray-600'}`}>
                          تومان
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </SwiperSlide>
            );
          })}

          {/* See All Card */}
          <SwiperSlide style={{ height: "auto" }}>
            <Link href="/products?sort=special" className="block h-full">
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
        <button className="swiper-button-prev-special absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ekg-100 bg-white/90 text-ekg-700 shadow-sm backdrop-blur-sm transition-all hover:border-kala-200 hover:bg-white md:flex">
          <ChevronLeft className="rotate-180" size={20} />
        </button>
        <button className="swiper-button-next-special absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ekg-100 bg-white/90 text-ekg-700 shadow-sm backdrop-blur-sm transition-all hover:border-kala-200 hover:bg-white md:flex">
          <ChevronLeft size={20} />
        </button>
      </div>
    </PromotionSection>
  );
}

// Export with memo for component-level memoization
export default memo(SpecialOfferRail);
