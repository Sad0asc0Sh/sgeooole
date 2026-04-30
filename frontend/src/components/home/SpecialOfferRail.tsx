"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/free-mode";
import { AlertTriangle, ChevronLeft, Percent } from "lucide-react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import { Product } from "@/services/productService";
import { useSpecialOffers } from "@/hooks/useProducts";
import { useCountdown } from "@/hooks/useCountdown";
import { getBlurDataURL } from "@/lib/blurPlaceholder";

/**
 * Special Offer Rail Component
 * OPTIMIZED: Uses SWR for caching, useMemo for computed values
 */
function SpecialOfferRail() {
  // SWR-based fetching with automatic caching
  const { specialOffers: products, isLoading, error } = useSpecialOffers(10);
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

  const { hours, minutes, seconds, isExpired } = useCountdown(
    earliestEndTime ? new Date(earliestEndTime).toISOString() : undefined
  );

  // Update timer every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hide section if loading, error, no products, or expired
  if (isLoading || error || products.length === 0 || isExpired) {
    return null;
  }

  const resolveImage = (product: Product) =>
    typeof product.image === "string" && product.image.trim() !== ""
      ? product.image.trim()
      : "/placeholder-product.png";

  return (
    <div className="py-5 bg-gradient-to-br from-red-600 via-red-500 to-rose-600 relative overflow-hidden touch-pan-y shadow-2xl">
      {/* Decorative animated background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />
      <div className="container mx-auto">
        <div className="px-4 mb-3 flex items-center justify-between">
          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 backdrop-blur-sm border-2 border-white rounded-full flex items-center justify-center animate-pulse">
              <Percent size={14} className="text-white fill-white" />
            </div>
            <h2 className="text-xl font-black text-white drop-shadow-lg">
              پیشنهاد شگفت‌انگیز
            </h2>
          </div>

          {/* Global Countdown Timer - Red Theme */}
          <div className="flex items-center gap-1.5 text-white font-black text-sm" dir="ltr">
            <div className="bg-red-800 text-white w-9 h-9 flex items-center justify-center rounded-lg shadow-lg border-2 border-white/30">
              {hours}
            </div>
            <span className="mb-1 text-white drop-shadow-md">:</span>
            <div className="bg-red-800 text-white w-9 h-9 flex items-center justify-center rounded-lg shadow-lg border-2 border-white/30">
              {minutes}
            </div>
            <span className="mb-1 text-white drop-shadow-md">:</span>
            <div className="bg-red-800 text-white w-9 h-9 flex items-center justify-center rounded-lg shadow-lg border-2 border-white/30">
              {seconds}
            </div>
          </div>

          {/* View All Button */}
          <Link
            href="/products?sort=special"
            className="flex items-center gap-0.5 text-white text-sm font-bold hover:text-white/90 transition-all hover:scale-105 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30"
          >
            <span>مشاهده همه</span>
            <ChevronLeft size={16} />
          </Link>
        </div>

        <div className="relative">
          <Swiper
            modules={[FreeMode, Navigation]}
            freeMode
            navigation={{
              nextEl: '.swiper-button-next-special',
              prevEl: '.swiper-button-prev-special',
            }}
            spaceBetween={8}
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
            className="w-full !px-4 !pb-2"
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
                    <div className="bg-white rounded-lg h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative group p-3">

                      <div className="">
                        {/* Product Image */}
                        <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md p-2">
                          <ResilientImage
                            src={product.image || "/placeholder.png"}
                            alt={product.name}
                            fill
                            className={`object-contain group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-60' : ''}`}
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 148px"
                            loading={index < 2 ? "eager" : "lazy"}
                            priority={index < 2}
                            fetchPriority={index < 2 ? "high" : "auto"}
                            quality={70}
                            placeholder="blur"
                            blurDataURL={getBlurDataURL()}
                            fallbackSrc="/placeholder.png"
                          />

                          {/* Badges - Only show if no header */}
                          {product.campaignLabel && (
                            <div className="absolute top-2 left-2 z-20">
                              <span className={`text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm ${product.campaignTheme === 'gold-red' ? 'bg-gradient-to-r from-yellow-400 to-red-600' :
                                product.campaignTheme === 'red-purple' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                  'bg-gradient-to-r from-lime-500 to-orange-400'
                                }`}>
                                {product.campaignLabel}
                              </span>
                            </div>
                          )}

                          {/* Low Stock Badge */}
                          {isLowStock && (
                            <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md">
                              <AlertTriangle size={12} />
                              <span>تنها {product.countInStock} عدد</span>
                            </div>
                          )}

                          {/* Out of Stock Overlay */}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-white/40 z-10 flex items-center justify-center">
                              <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                                ناموجود
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Product Name */}
                        <h3 className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${isOutOfStock ? 'text-gray-400' : 'text-gray-700'}`}>
                          {product.name}
                        </h3>

                        {/* Price Section */}
                        <div className="flex flex-col gap-1 mt-auto">
                          <div className="flex items-center justify-between h-5">
                            {product.countInStock > 0 && effectiveDiscount > 0 && hasSpecialOfferCountdown ? (
                              <>
                                <div className={`text-white text-[11px] font-bold px-2 py-0.5 rounded-full ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                  product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                    product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' ? 'bg-gradient-to-r from-lime-400 to-green-500' :
                                      (product.campaignLabel || product.campaignTheme) ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                                        'bg-[#ef394e]'
                                  }`}>
                                  {product.discount.toLocaleString("fa-IR")}٪
                                </div>
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
                    </div>
                  </Link>
                </SwiperSlide>
              );
            })}

            {/* See All Card */}
            <SwiperSlide style={{ height: "auto" }}>
              <Link href="/products?sort=special" className="block h-full">
                <div className="bg-gradient-to-b from-white to-rose-50/60 h-full rounded-xl border border-rose-100 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-rose-300 hover:shadow-lg hover:shadow-rose-100/50 transition-all duration-300 px-4 py-6 min-h-[200px]">
                  <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white group-hover:border-rose-500 group-hover:scale-110 transition-all duration-300 shadow-sm">
                    <ChevronLeft size={22} strokeWidth={2.5} />
                  </div>
                  <span className="text-sm font-bold text-gray-700 group-hover:text-rose-600 transition-colors duration-300">
                    مشاهده همه
                  </span>
                  <span className="text-[10px] text-gray-400 group-hover:text-rose-400 transition-colors duration-300">
                    مشاهده تمام پیشنهادها
                  </span>
                </div>
              </Link>
            </SwiperSlide>
          </Swiper>

          {/* Navigation Arrows - Desktop Only */}
          <button className="swiper-button-prev-special hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all">
            <ChevronLeft className="rotate-180" size={20} />
          </button>
          <button className="swiper-button-next-special hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all">
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Export with memo for component-level memoization
export default memo(SpecialOfferRail);
