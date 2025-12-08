"use client";

import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import { isFlashDealLabel } from "@/lib/flashDealUtils";

interface ProductRailProps {
  title: string;
  products: any[];
}

export default function ProductRail({ title, products }: ProductRailProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
        <button className="flex items-center gap-0.5 text-blue-500 text-xs font-bold hover:text-blue-600 transition-colors">
          <span>مشاهده همه</span>
          <ChevronLeft size={14} />
        </button>
      </div>

      <Swiper
        modules={[FreeMode]}
        freeMode
        spaceBetween={12}
        slidesPerView={"auto"}
        className="w-full !px-4 !pb-4"
        grabCursor
      >
        {products.map((product) => {
          // Check if flash deal countdown is still active
          const isFlashDealActive = Boolean(
            product.isFlashDeal &&
            product.flashDealEndTime &&
            new Date(product.flashDealEndTime).getTime() > now
          );

          const isSpecialOfferCountdownActive = Boolean(
            product.isSpecialOffer &&
            product.specialOfferEndTime &&
            new Date(product.specialOfferEndTime).getTime() > now
          );
          const hasFlashLabel = isFlashDealLabel(product.campaignLabel);
          const shouldShowCampaignHeader =
            (product.campaignLabel || product.campaignTheme) &&
            (!hasFlashLabel || isFlashDealActive);

          // Determine Header Type - Only show flash header if countdown is active
          let headerConfig = null;

          if (isFlashDealActive) {
            headerConfig = {
              type: 'flash',
              title: 'پیشنهاد لحظه‌ای',
              color: 'text-amber-500',
              borderColor: 'bg-amber-500',
              endTime: product.flashDealEndTime,
            };
          } else if (shouldShowCampaignHeader) {
            // Map campaign themes to colors
            let themeColor = 'text-blue-600';
            let themeBorder = 'bg-gradient-to-r from-blue-400 to-indigo-500';

            // Check for specific themes
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
              endTime: product.flashDealEndTime || product.specialOfferEndTime,
              iconColor: themeColor
            };
          } else if (
            (product.isSpecialOffer && isSpecialOfferCountdownActive) ||
            (!product.isFlashDeal && !product.isSpecialOffer && product.discount && product.discount > 0)
          ) {
            headerConfig = {
              type: 'amazing',
              title: 'شگفت‌انگیز',
              color: 'text-red-500',
              borderColor: 'bg-red-500',
              endTime: product.specialOfferEndTime,
            };
          }

          const showSpecialOfferChrome =
            !(headerConfig?.type === 'amazing') ||
            isSpecialOfferCountdownActive ||
            !product.isSpecialOffer;

          // Effective discount: only apply if flash deal is active OR special offer is active
          const effectiveDiscount =
            product.discount > 0 &&
              (isFlashDealActive || (!product.isFlashDeal && (!product.isSpecialOffer || isSpecialOfferCountdownActive)))
              ? product.discount
              : 0;

          const showSpecialOfferPricing = effectiveDiscount > 0 && Boolean(product.oldPrice);

          // Price reversion: when flash deal or special offer expires, revert to original price
          const displayPrice =
            (!isFlashDealActive && product.isFlashDeal && product.oldPrice)
              ? product.oldPrice
              : (!isSpecialOfferCountdownActive && product.isSpecialOffer && product.oldPrice)
                ? product.oldPrice
                : product.price;

          return (
            <SwiperSlide key={product.id} style={{ width: "148px", height: "auto" }}>
              <Link href={`/product/${product.id}`} className="block h-full">
                <div className={`bg-white rounded-lg border border-gray-200 h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group ${headerConfig ? 'pt-0' : 'p-3'}`}>

                  {/* Special Header Line */}
                  {headerConfig && showSpecialOfferChrome && (
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
                    <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
                      <Image
                        src={product.image || "/placeholder.png"}
                        alt={product.name}
                        fill
                        className={`object-contain p-2 group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? "grayscale opacity-60" : ""}`}
                      />

                      {/* Timer Overlay (Top Right) */}
                      {(headerConfig?.endTime) && (
                        <ProductTimerBadge
                          targetDate={headerConfig.endTime}
                          color={headerConfig.color}
                        />
                      )}

                      {/* Badges - Only show if no header, or adjust position */}


                      {/* OUT OF STOCK OVERLAY */}
                      {product.countInStock === 0 && (
                        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                          <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                            ناموجود
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${product.countInStock === 0 ? "text-gray-400" : "text-gray-700"
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
                        className={`flex items-center justify-end gap-1 ${product.countInStock === 0 ? "text-gray-400" : "text-gray-800"
                          }`}
                      >
                        <span className="text-[15px] font-black tracking-tight">
                          {displayPrice.toLocaleString("fa-IR")}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${product.countInStock === 0 ? "text-gray-400" : "text-gray-600"
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
        <SwiperSlide style={{ width: "148px", height: "auto" }}>
          <div className="bg-white h-full rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-gray-300 transition-colors">
            <div className="w-10 h-10 border border-gray-200 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-50 transition-colors">
              <ChevronLeft size={20} />
            </div>
            <span className="text-sm font-bold text-gray-700">مشاهده همه</span>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
}
