"use client";

import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { Timer } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { productService, Product } from "@/services/productService";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";

/**
 * Single flash deal card with:
 * - Drag vs click handling
 * - Out-of-stock styling identical to main product cards
 */
function FlashDealCard({ product }: { product: Product }) {
  const router = useRouter();
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);

  // Header Config Logic (Dynamic)
  let headerConfig = {
    type: 'flash',
    title: 'پیشنهاد لحظه‌ای',
    color: 'text-amber-500',
    borderColor: 'bg-amber-500',
    endTime: product.flashDealEndTime || product.specialOfferEndTime,
  };

  if (product.campaignLabel || product.campaignTheme) {
    // If it's a campaign, use campaign styling
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
      endTime: product.flashDealEndTime || product.specialOfferEndTime,
    };
  }

  const handlePointerDown = (clientX: number) => {
    dragRef.current = { startX: clientX, moved: false };
  };

  const handlePointerMove = (clientX: number) => {
    if (!dragRef.current) return;
    if (Math.abs(clientX - dragRef.current.startX) > 6) {
      dragRef.current.moved = true;
    }
  };

  const handlePointerUp = () => {
    const moved = dragRef.current?.moved;
    dragRef.current = null;
    if (!moved) {
      router.push(`/product/${product.id}`);
    }
  };

  return (
    <SwiperSlide style={{ width: "148px", height: "auto" }}>
      <div
        className="bg-white rounded-lg border border-gray-200 h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group pt-0"
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
        {/* Special Header Line */}
        <div className="w-full mb-2">
          <div className={`h-1 w-full ${headerConfig.borderColor}`} />
          <div className="flex items-center justify-between px-2 py-1 bg-white gap-1">

            <div className={`text-[10px] font-bold whitespace-nowrap truncate ${headerConfig.color}`}>
              {headerConfig.title}
            </div>
          </div>
          <div className="h-px w-full bg-gray-100" />
        </div>

        <div className="px-3 pb-3">
          {/* Image */}
          <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
            <Image
              src={product.image || "/placeholder.png"}
              alt={product.name}
              fill
              className={`object-cover group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? 'grayscale opacity-60' : ''}`}
            />

            {/* Timer Overlay (Top Right) */}
            {(headerConfig?.endTime) && (
              <ProductTimerBadge
                targetDate={headerConfig.endTime}
                color={headerConfig.color}
              />
            )}

            {/* Out of Stock Overlay */}
            {product.countInStock === 0 && (
              <div className="absolute inset-0 bg-white/40 z-10 flex items-center justify-center">
                <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                  ناموجود
                </span>
              </div>
            )}
          </div>

          {/* Product Name */}
          <h3 className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
            {product.name}
          </h3>

          {/* Price Section */}
          <div className="flex flex-col gap-1 mt-auto">
            {/* Row 1: Old Price */}
            <div className="flex items-center justify-between h-5">
              {product.countInStock > 0 && product.discount > 0 ? (
                <>
                  <div className="text-white text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ef394e]">
                    {product.discount.toLocaleString("fa-IR")}٪
                  </div>
                  <span className="text-[11px] text-gray-300 line-through decoration-gray-300">
                    {(product.compareAtPrice || product.price).toLocaleString("fa-IR")}
                  </span>
                </>
              ) : <div className="h-5" />}
            </div>

            {/* Row 2: Current Price */}
            <div className={`flex items-center justify-end gap-1 ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
              <span className="text-[15px] font-black tracking-tight">
                {product.price.toLocaleString("fa-IR")}
              </span>
              <span className={`text-[10px] font-medium ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-600'}`}>تومان</span>
            </div>
          </div>
        </div>
      </div>
    </SwiperSlide>
  );
}

/**
 * Flash Offer Rail Component - horizontal strip of flash deals
 */
export default function FlashOfferRail() {
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlashDeals = async () => {
      try {
        setLoading(true);
        const deals = await productService.getFlashDeals(10);
        setFlashDeals(deals);
      } catch (error) {
        console.error("Error loading flash deals:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFlashDeals();
  }, []);

  if (!loading && flashDeals.length === 0) {
    return null;
  }

  return (
    <div className="py-6 bg-white">
      <div className="flex items-center gap-2 px-4 mb-2">
        <Timer className="text-vita-500 w-5 h-5" />
        <SectionTitle className="!mb-0 !px-0">
          پیشنهادهای‌لحظه‌ای
        </SectionTitle>
      </div>

      {loading ? (
        <div className="px-4">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[130px] h-[200px] rounded-xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : (
        <Swiper
          modules={[FreeMode, Autoplay]}
          freeMode={true}
          loop={true}
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
            reverseDirection: true, // Move from left to right
          }}
          speed={4000}
          spaceBetween={12}
          slidesPerView={"auto"}
          className="w-full !px-4 [&_.swiper-wrapper]:!ease-linear"
          grabCursor={true}
        >
          {flashDeals.map((product) => (
            <FlashDealCard key={product.id} product={product} />
          ))}
        </Swiper>
      )}
    </div>
  );
}
