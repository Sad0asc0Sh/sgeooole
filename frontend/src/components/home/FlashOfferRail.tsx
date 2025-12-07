"use client";

import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import Image from "next/image";
import { productService, Product } from "@/services/productService";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";
import { ChevronLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";

/**
 * Flash Offer Rail Component - horizontal strip of flash deals
 * Custom Design: Gold & Gray Glassmorphism (Dark Theme)
 * Shape: Top & Bottom Zigzag (Sawtooth/Tech)
 */
export default function FlashOfferRail() {
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const fetchFlashDeals = async () => {
      try {
        setLoading(true);
        const deals = await productService.getFlashDeals(10);
        if (!isCancelled) {
          setFlashDeals(deals);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error loading flash deals:", error);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchFlashDeals();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (!loading && flashDeals.length === 0) {
    return null;
  }

  return (
    <div
      className="py-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-y border-amber-500/20 shadow-inner relative overflow-hidden"
      style={{
        // CSS Mask for Zigzag (Sawtooth) Edges - Adjusted for smaller padding
        // 20px width => 10px height zigzag. py-6 (24px) leaves 14px visual padding.
        WebkitMask: "conic-gradient(from -45deg at bottom,#0000,#000 1deg 90deg,#0000 91deg) bottom/20px 51% repeat-x, conic-gradient(from 135deg at top,#0000,#000 1deg 90deg,#0000 91deg) top/20px 51% repeat-x",
        mask: "conic-gradient(from -45deg at bottom,#0000,#000 1deg 90deg,#0000 91deg) bottom/20px 51% repeat-x, conic-gradient(from 135deg at top,#0000,#000 1deg 90deg,#0000 91deg) top/20px 51% repeat-x"
      }}
    >
      {/* Decorative Background Glow */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="px-4 mb-5 flex items-center justify-between relative z-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-400 w-5 h-5 animate-pulse" />
            <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-l from-amber-200 via-amber-400 to-amber-500 drop-shadow-sm">
              پیشنهاد لحظه‌ای
            </h3>
          </div>
          <span className="text-[11px] text-gray-400 font-medium mr-7">
            فرصت محدود خرید با تخفیف ویژه
          </span>
        </div>
        <Link
          href="/products?sort=flash"
          className="flex items-center gap-1 text-amber-400 text-xs font-bold hover:text-amber-300 transition-colors bg-gray-800/50 px-3 py-1.5 rounded-full border border-amber-500/20 backdrop-blur-sm"
        >
          <span>مشاهده همه</span>
          <ChevronLeft size={14} />
        </Link>
      </div>

      {loading ? (
        // Loading skeleton - Dark Theme
        <div className="px-4 flex gap-3 overflow-hidden relative z-10">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="min-w-[148px] h-[240px] bg-gray-800/50 rounded-xl border border-gray-700 animate-pulse"
              style={{
                clipPath: "polygon(0 0, 50% 15px, 100% 0, 100% 100%, 50% calc(100% - 15px), 0 100%)"
              }}
            />
          ))}
        </div>
      ) : (
        <Swiper
          modules={[FreeMode]}
          freeMode
          spaceBetween={12}
          slidesPerView={"auto"}
          className="w-full !px-4 !pb-4 relative z-10"
          grabCursor
        >
          {flashDeals.map((product) => {
            // Calculate active states
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

            // Force Gold/Dark Theme for this section
            const headerConfig = {
              type: 'flash',
              title: 'پیشنهاد طلایی',
              color: 'text-amber-950',
              borderColor: 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500',
              endTime: product.flashDealEndTime || product.specialOfferEndTime,
            };

            const effectiveDiscount =
              product.discount > 0 && (!product.isSpecialOffer || isSpecialOfferCountdownActive)
                ? product.discount
                : 0;

            const showSpecialOfferPricing = effectiveDiscount > 0 && Boolean(product.oldPrice);

            const displayPrice =
              (!isSpecialOfferCountdownActive && product.isSpecialOffer && product.oldPrice)
                ? product.oldPrice
                : product.price;

            return (
              <SwiperSlide key={product.id} style={{ width: "148px", height: "auto" }}>
                <Link href={buildProductUrl(product)} className="block h-full">
                  <div
                    className={`
                      bg-gray-800/40 backdrop-blur-md
                      border border-amber-500/30
                      h-full flex flex-col justify-between
                      cursor-pointer
                      hover:border-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:bg-gray-800/60
                      transition-all duration-300
                      relative overflow-hidden group pt-4 pb-4
                    `}
                    style={{
                      clipPath: "polygon(0 0, 50% 15px, 100% 0, 100% 100%, 50% calc(100% - 15px), 0 100%)",
                      borderRadius: "0" // Remove border radius as clip-path defines shape
                    }}
                  >

                    {/* Gold Header Line - Adjusted for clip-path */}
                    <div className="w-full mb-1 absolute top-0 left-0 right-0 z-20 opacity-50">
                      {/* Optional: Add a subtle top border glow that follows the shape?
                           Standard borders get clipped. We rely on the container border which is also clipped.
                       */}
                    </div>

                    <div className="px-3 pb-1 pt-1">
                      {/* Header Title - Centered below the V notch */}
                      <div className="flex justify-center mb-2">
                        <span className="text-[10px] font-black text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {headerConfig.title}
                        </span>
                      </div>

                      {/* Image */}
                      <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-700/30 rounded-lg overflow-hidden border border-white/5">
                        <Image
                          src={product.image || "/placeholder.png"}
                          alt={product.name}
                          fill
                          className={`object-contain p-2 group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? "grayscale opacity-60" : ""}`}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          loading="lazy"
                          quality={75}
                          placeholder="blur"
                          blurDataURL={getBlurDataURL()}
                        />

                        {/* Timer Overlay (Top Right) */}
                        {(headerConfig?.endTime) && (
                          <ProductTimerBadge
                            targetDate={headerConfig.endTime}
                            color="text-amber-500"
                            className="bg-gray-900/90 border border-amber-500/30 backdrop-blur-sm shadow-lg"
                          />
                        )}

                        {/* OUT OF STOCK OVERLAY */}
                        {product.countInStock === 0 && (
                          <div className="absolute inset-0 bg-gray-900/70 z-10 flex items-center justify-center backdrop-blur-[2px]">
                            <span className="bg-gray-800 text-gray-300 border border-gray-600 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                              ناموجود
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${product.countInStock === 0 ? "text-gray-500" : "text-gray-200"
                          } group-hover:text-amber-200 transition-colors text-center`}
                      >
                        {product.name}
                      </h3>

                      {/* Price Section */}
                      <div className="flex flex-col gap-1 mt-auto">
                        {/* Row 1: Old Price (if discount and in stock) */}
                        <div className="flex items-center justify-center h-5">
                          {product.countInStock > 0 && effectiveDiscount > 0 && showSpecialOfferPricing ? (
                            <>
                              <div className="flex items-center gap-1">
                                <div className="text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                                  {effectiveDiscount.toLocaleString("fa-IR")}٪
                                </div>
                                <span className="text-[11px] text-gray-500 line-through decoration-gray-500">
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
                          className={`flex items-center justify-center gap-1 ${product.countInStock === 0 ? "text-gray-500" : "text-gray-100"
                            }`}
                        >
                          <span className="text-[15px] font-black tracking-tight text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.3)]">
                            {displayPrice.toLocaleString("fa-IR")}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${product.countInStock === 0 ? "text-gray-600" : "text-gray-400"
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
            <Link href="/products?sort=flash" className="block h-full">
              <div
                className="bg-gray-800/40 backdrop-blur-md h-full border border-amber-500/20 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-amber-400 hover:bg-gray-800/60 transition-all duration-300 pt-4 pb-4"
                style={{
                  clipPath: "polygon(0 0, 50% 15px, 100% 0, 100% 100%, 50% calc(100% - 15px), 0 100%)",
                  borderRadius: "0"
                }}
              >
                <div className="w-12 h-12 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-400 group-hover:bg-amber-500/10 group-hover:scale-110 transition-all shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <ChevronLeft size={24} />
                </div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-amber-400 transition-colors">مشاهده همه</span>
              </div>
            </Link>
          </SwiperSlide>
        </Swiper>
      )}
    </div>
  );
}
