"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { AlertTriangle, ChevronLeft, Percent } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/services/productService";
import { useSpecialOffers } from "@/hooks/useProducts";
import { useCountdown } from "@/hooks/useCountdown";

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
    <div className="py-5 bg-gray-900 relative overflow-hidden touch-pan-y">
      <div className="container mx-auto">
        <div className="px-4 mb-3 flex items-center justify-between">
          {/* Title */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 border-[1.5px] border-white rounded-full flex items-center justify-center">
              <Percent size={12} className="text-white fill-white" />
            </div>
            <h2 className="text-base font-bold text-yellow-400">
              <span className="text-[11px]">پیشنهاد‌شگفت‌انگیز</span>
            </h2>
          </div>

          {/* Global Countdown Timer */}
          <div className="flex items-center gap-1 text-white font-bold text-xs" dir="ltr">
            <div className="bg-white text-vita-600 w-7 h-7 flex items-center justify-center rounded-[4px] shadow-sm">
              {hours}
            </div>
            <span className="mb-1">:</span>
            <div className="bg-white text-vita-600 w-7 h-7 flex items-center justify-center rounded-[4px] shadow-sm">
              {minutes}
            </div>
            <span className="mb-1">:</span>
            <div className="bg-white text-vita-600 w-7 h-7 flex items-center justify-center rounded-[4px] shadow-sm">
              {seconds}
            </div>
          </div>

          {/* View All Button */}
          <button className="flex items-center gap-0.5 text-white text-xs font-medium hover:text-white/90 transition-colors">
            <span>مشاهده همه</span>
            <ChevronLeft size={14} />
          </button>
        </div>

        <Swiper
          modules={[FreeMode]}
          freeMode
          spaceBetween={8}
          slidesPerView="auto"
          className="w-full !px-4 !pb-2"
          grabCursor
        >
          {products.map((product) => {
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
                  <div className="bg-white rounded-lg h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group p-3">

                    <div className="">
                      {/* Product Image */}
                      <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
                        <Image
                        src={product.image || "/placeholder.png"}
                        alt={product.name}
                        fill
                        className={`object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-60' : ''}`}
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
          <SwiperSlide style={{ width: "148px", height: "auto" }}>
            <div className="bg-white h-full rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer group border border-transparent hover:border-gray-100">
              <div className="w-12 h-12 border border-gray-100 rounded-full flex items-center justify-center text-vita-600 group-hover:bg-gray-50 transition-colors">
                <ChevronLeft size={24} />
              </div>
              <span className="text-sm font-bold text-gray-700">
                مشاهده همه
              </span>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
    </div>
  );
}

// Export with memo for component-level memoization
export default memo(SpecialOfferRail);
