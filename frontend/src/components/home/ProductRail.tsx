"use client";

import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import {
  getNextPromotionExpiry,
  resolveProductPromotion,
} from "@/lib/promotions/productPromotion";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import imageStyles from "@/components/product/ProductImageFrame.module.css";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import { useVelocitySnap } from "@/hooks/useVelocitySnap";

interface ProductRailProps {
  title: string;
  products: any[];
  viewAllHref?: string;
}

export default function ProductRail({ title, products, viewAllHref = "/products" }: ProductRailProps) {
  const [, forcePromotionBoundaryRender] = useState(0);
  const { onTouchStart, onTouchEnd } = useVelocitySnap();
  const now = Date.now();

  // Timer badges update their own text. This rail only needs to render at the
  // closest promotion expiry, not once for every second and every product.
  useEffect(() => {
    const nextExpiry = products.reduce<number | null>((nearest, product) => {
      const expiry = getNextPromotionExpiry(product, Date.now());
      if (!expiry) return nearest;
      return nearest === null ? expiry : Math.min(nearest, expiry);
    }, null);

    if (!nextExpiry) return;

    const delay = Math.max(0, nextExpiry - Date.now()) + 50;
    const id = window.setTimeout(
      () => forcePromotionBoundaryRender((version) => version + 1),
      delay,
    );

    return () => window.clearTimeout(id);
  }, [products]);

  return (
    <div className="py-4 bg-white border-b border-gray-100">
      {/* Header Section */}
      <div className="px-4 mb-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <span className="text-[11px] text-gray-400 font-medium">
            محصولات منتخب برای شما
          </span>
        </div>
        <Link
          href={viewAllHref}
          className="flex items-center gap-0.5 text-blue-500 text-xs font-bold hover:text-blue-600 transition-colors"
        >
          <span>مشاهده همه</span>
          <ChevronLeft size={14} />
        </Link>
      </div>

      <div className="relative">
        <Swiper
          modules={[Navigation]}
          navigation={{
            nextEl: `.swiper-button-next-custom-${title.replace(/\s/g, '')}`,
            prevEl: `.swiper-button-prev-custom-${title.replace(/\s/g, '')}`,
          }}
          onSwiper={(swiper) => {
            const saved = getScrollManager().getHorizontal("rail_" + title);
            if (typeof saved === "number" && saved > 0) {
              swiper.slideTo(saved, 0);
            }
          }}
          onSlideChange={(swiper) => {
            getScrollManager().saveHorizontal("rail_" + title, swiper.activeIndex);
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          shortSwipes={false}
          longSwipes={false}
          followFinger={true}
          speed={300}
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
          className="w-full !px-4 !pb-4"
          grabCursor
        >
          {products.map((product, index) => {
            const { kind: promotionKind, effectiveDiscount, displayPrice, endTime } =
              resolveProductPromotion(product, now);
            const showSpecialOfferPricing = effectiveDiscount > 0 && Boolean(product.oldPrice);

            let headerConfig = null;
            if (promotionKind === 'flash') {
              headerConfig = {
                type: 'flash',
                title: 'پیشنهاد لحظه‌ای',
                color: 'text-amber-500',
                borderColor: 'bg-amber-500',
                endTime,
              };
            } else if (promotionKind === 'campaign') {
              let themeColor = 'text-blue-600';
              let themeBorder = 'bg-gradient-to-r from-blue-400 to-indigo-500';

              if (product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold') {
                themeColor = 'text-amber-600';
                themeBorder = 'bg-gradient-to-r from-amber-400 to-orange-500';
              } else if (product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red') {
                themeColor = 'text-rose-600';
                themeBorder = 'bg-gradient-to-r from-rose-500 to-purple-700';
              } else if (product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime') {
                themeColor = 'text-lime-600';
                themeBorder = 'bg-gradient-to-r from-lime-400 to-green-500';
              }

              headerConfig = {
                type: 'campaign',
                title: product.campaignLabel || 'فروش ویژه',
                color: themeColor,
                borderColor: themeBorder,
                endTime,
                iconColor: themeColor,
              };
            } else if (promotionKind === 'amazing') {
              headerConfig = {
                type: 'amazing',
                title: 'شگفت‌انگیز',
                color: 'text-red-500',
                borderColor: 'bg-red-500',
                endTime,
              };
            }

            const isOutOfStock = product.countInStock === 0;
            const isLowStock = product.countInStock > 0 && product.countInStock <= 3;

            return (
              <SwiperSlide key={product.id} style={{ width: "148px", height: "auto" }}>
                <Link href={`/product/${product.id}`} className="block h-full">
                  <div className={`bg-white rounded-lg border border-gray-200 h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group ${headerConfig ? 'pt-0' : 'p-3'}`}>

                    {/* Special Header Line */}
                    {headerConfig && (
                      <div className="w-full mb-2">
                        <div className={`h-1 w-full ${headerConfig.borderColor}`} />
                        <div className="flex items-center justify-between px-2 py-1 bg-white gap-1">

                          <div className={`text-[10px] font-bold whitespace-nowrap truncate ${headerConfig.color}`}>
                            {headerConfig.title}
                          </div>
                        </div>
                        <div className="h-px w-full bg-gray-100" />
                      </div>
                    )}

                    <div className={headerConfig ? "px-3 pb-3" : ""}>
                      {/* Image */}
                      <div className={`${imageStyles.frame} mb-3 rounded-md`}>
                        <ResilientImage
                          src={product.image || "/placeholder.png"}
                          alt={product.name}
                          fill
                          className={`${imageStyles.image} group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? "grayscale opacity-60" : ""}`}
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 148px"
                          priority={index < 3}
                          fetchPriority={index < 3 ? "high" : "auto"}
                          loading={index < 3 ? "eager" : "lazy"}
                          quality={70}
                          placeholder="blur"
                          blurDataURL={getBlurDataURL()}
                          fallbackSrc="/placeholder.png"
                        />

                        {/* Timer Overlay (Top Right) */}
                        {(headerConfig?.endTime) && (
                          <ProductTimerBadge
                            targetDate={headerConfig.endTime}
                            color={headerConfig.color}
                          />
                        )}

                        {/* Low Stock Badge */}
                        {isLowStock && (
                          <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md">
                            <AlertTriangle size={12} />
                            <span>تنها {product.countInStock} عدد</span>
                          </div>
                        )}

                        {/* Badges - Only show if no header, or adjust position */}


                        {/* OUT OF STOCK OVERLAY */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                            <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                              ناموجود
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${isOutOfStock ? "text-gray-400" : "text-gray-700"
                          }`}
                      >
                        {product.name}
                      </h3>

                      {/* Price Section */}
                      <div className="flex flex-col gap-1 mt-auto">
                        {/* Row 1: Old Price (if discount and in stock) */}
                        <div className="flex items-center justify-between h-5">
                          {product.countInStock > 0 && effectiveDiscount > 0 && showSpecialOfferPricing ? (
                            <>
                              <div className="flex items-center gap-1">
                                <div className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md ${product.campaignTheme === 'gold-red' ? 'bg-[#ef394e]' :
                                  product.campaignTheme === 'red-purple' ? 'bg-rose-600' :
                                    'bg-[#ef394e]'
                                  }`}>
                                  {effectiveDiscount.toLocaleString("fa-IR")}٪
                                </div>
                                <span className="text-[11px] text-gray-300 line-through decoration-gray-300">
                                  {(product.compareAtPrice || product.price).toLocaleString("fa-IR")}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="h-5" />
                          )}
                        </div>

                        {/* Row 2: Current Price */}
                        <div
                          className={`flex items-center justify-end gap-1 ${isOutOfStock ? "text-gray-400" : "text-gray-800"
                            }`}
                        >
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
                      </div>
                    </div>
                  </div>
                </Link>
              </SwiperSlide>
            );
          })}

          {/* "See All" Card (Last Slide) */}
          <SwiperSlide style={{ height: "auto" }}>
            <Link href={viewAllHref} className="block h-full">
              <div className="bg-gradient-to-b from-white to-blue-50/60 h-full rounded-xl border border-blue-100 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 px-4 py-6 min-h-[200px]">
                <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <ChevronLeft size={22} strokeWidth={2.5} />
                </div>
                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors duration-300">
                  مشاهده همه
                </span>
                <span className="text-[10px] text-gray-400 group-hover:text-blue-400 transition-colors duration-300">
                  مشاهده تمام محصولات
                </span>
              </div>
            </Link>
          </SwiperSlide>
        </Swiper>

        {/* Navigation Arrows - Desktop Only */}
        <button className={`swiper-button-prev-custom-${title.replace(/\s/g, '')} hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all`}>
          <ChevronLeft className="rotate-180" size={20} />
        </button>
        <button className={`swiper-button-next-custom-${title.replace(/\s/g, '')} hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all`}>
          <ChevronLeft size={20} />
        </button>
      </div>
    </div>
  );
}
