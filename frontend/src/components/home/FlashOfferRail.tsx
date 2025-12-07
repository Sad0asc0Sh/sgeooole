"use client";

import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { productService, Product } from "@/services/productService";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * Card content (SwiperSlide is added by parent)
 * Enhanced to match ProductRail cards styling
 */
function FlashDealCard({ product }: { product: Product }) {
  const router = useRouter();
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const handlePointerDown = (clientX: number) => {
    dragRef.current = { startX: clientX, moved: false };
  };

  const handlePointerMove = (clientX: number) => {
    if (!dragRef.current) return;
    if (Math.abs(clientX - dragRef.current.startX) > 5) {
      dragRef.current.moved = true;
    }
  };

  const handlePointerUp = () => {
    const moved = dragRef.current?.moved;
    dragRef.current = null;
    if (!moved) {
      router.push(buildProductUrl(product));
    }
  };

  // Calculate effective discount and pricing
  const isFlashDealActive = Boolean(
    product.isFlashDeal &&
    product.flashDealEndTime &&
    new Date(product.flashDealEndTime).getTime() > now
  );
  const effectiveDiscount = product.discount > 0 && isFlashDealActive ? product.discount : 0;
  const showDiscountPricing = effectiveDiscount > 0 && Boolean(product.oldPrice || product.compareAtPrice);
  const displayPrice = product.price;
  const originalPrice = product.oldPrice || product.compareAtPrice || product.price;

  // Header config for flash deals
  const hasHeader = product.isFlashDeal;
  let themeColor = 'text-amber-500';
  let themeBorder = 'bg-amber-500';
  let themeTitle = 'پیشنهاد لحظه‌ای';

  // Override with campaign theme if present
  if (product.campaignLabel || product.campaignTheme) {
    themeTitle = product.campaignLabel || 'پیشنهاد لحظه‌ای';

    if (product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold') {
      themeColor = 'text-amber-600';
      themeBorder = 'bg-gradient-to-r from-amber-400 to-orange-500';
    } else if (product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red') {
      themeColor = 'text-rose-600';
      themeBorder = 'bg-gradient-to-r from-rose-500 to-purple-700';
    } else if (product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime') {
      themeColor = 'text-lime-600';
      themeBorder = 'bg-gradient-to-r from-lime-400 to-green-500';
    } else {
      themeColor = 'text-blue-600';
      themeBorder = 'bg-gradient-to-r from-blue-400 to-indigo-500';
    }
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group ${hasHeader ? 'pt-0' : 'p-3'}`}
      onMouseDown={(e) => handlePointerDown(e.clientX)}
      onMouseMove={(e) => handlePointerMove(e.clientX)}
      onMouseUp={handlePointerUp}
      onMouseLeave={() => (dragRef.current = null)}
      onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
      onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
      onTouchEnd={handlePointerUp}
      role="button"
      aria-label={product.name || "product"}
    >
      {/* Special Header Line - Matches ProductRail */}
      {hasHeader && (
        <div className="w-full mb-2">
          <div className={`h-1 w-full ${themeBorder}`} />
          <div className="flex items-center justify-between px-2 py-1 bg-white gap-1">
            <div className={`text-[10px] font-bold whitespace-nowrap truncate ${themeColor}`}>
              {themeTitle}
            </div>
          </div>
          <div className="h-px w-full bg-gray-100" />
        </div>
      )}

      <div className={hasHeader ? "px-3 pb-3" : ""}>
        {/* Image */}
        <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
          <Image
            src={product.image || "/placeholder.png"}
            alt={product.name}
            fill
            className={`object-contain p-2 group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? "grayscale opacity-60" : ""
              }`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
            quality={75}
            placeholder="blur"
            blurDataURL={getBlurDataURL()}
          />

          {/* Out of Stock Overlay */}
          {product.countInStock === 0 && (
            <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
              <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                ناموجود
              </span>
            </div>
          )}
        </div>

        {/* Product Name */}
        <h3
          className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] text-right ${product.countInStock === 0 ? "text-gray-400" : "text-gray-700"
            }`}
        >
          {product.name}
        </h3>

        {/* Price Section - Enhanced to match ProductRail */}
        <div className="flex flex-col gap-1 mt-auto">
          {/* Row 1: Discount Badge + Old Price */}
          <div className="flex items-center justify-between h-5">
            {product.countInStock > 0 && effectiveDiscount > 0 && showDiscountPricing ? (
              <>
                <div className="flex items-center gap-1">
                  <div className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md ${product.campaignTheme === 'gold-red' ? 'bg-[#ef394e]' :
                    product.campaignTheme === 'red-purple' ? 'bg-rose-600' :
                      'bg-[#ef394e]'
                    }`}>
                    {effectiveDiscount.toLocaleString("fa-IR")}٪
                  </div>
                  <span className="text-[11px] text-gray-300 line-through decoration-gray-300">
                    {originalPrice.toLocaleString("fa-IR")}
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
  );
}

/**
 * Flash Offer Rail Component - horizontal strip of flash deals
 */
export default function FlashOfferRail() {
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="py-4 bg-white border-b border-gray-100">
      {/* Header Section - Matches ProductRail */}
      <div className="px-4 mb-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-gray-900">پیشنهاد لحظه‌ای</h3>
          <span className="text-[11px] text-gray-400 font-medium">
            محصولات منتخب برای شما
          </span>
        </div>
        <Link
          href="/products?sort=flash"
          className="flex items-center gap-0.5 text-blue-500 text-xs font-bold hover:text-blue-600 transition-colors"
        >
          <span>مشاهده همه</span>
          <ChevronLeft size={14} />
        </Link>
      </div>

      {loading ? (
        <div className="px-4">
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-[148px] h-[260px] rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>
      ) : (
        <Swiper
          modules={[FreeMode]}
          freeMode={true}
          loop={false}
          spaceBetween={12}
          slidesPerView="auto"
          className="flash-offer-swiper w-full !px-4 !pb-4"
          grabCursor={true}
        >
          {flashDeals.map((product) => (
            <SwiperSlide key={product.id} style={{ width: "148px", height: "auto" }}>
              <FlashDealCard product={product} />
            </SwiperSlide>
          ))}

          {/* "See All" Card (Last Slide) - Matches ProductRail */}
          <SwiperSlide style={{ width: "148px", height: "auto" }}>
            <Link href="/products?sort=flash" className="block h-full">
              <div className="bg-white h-full rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-gray-300 transition-colors min-h-[260px]">
                <div className="w-10 h-10 border border-gray-200 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-50 transition-colors">
                  <ChevronLeft size={20} />
                </div>
                <span className="text-sm font-bold text-gray-700">مشاهده همه</span>
              </div>
            </Link>
          </SwiperSlide>
        </Swiper>
      )}
    </div>
  );
}
