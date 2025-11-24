"use client";
import { useState, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { Timer } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { productService, Product } from "@/services/productService";
import { useCountdown } from "@/hooks/useCountdown";

/**
 * Individual Flash Deal Card with Countdown Timer
 */
function FlashDealCard({ product }: { product: Product }) {
  const { hours, minutes, seconds, isExpired } = useCountdown(product.flashDealEndTime);

  // Don't show if expired
  if (isExpired) return null;

  return (
    <SwiperSlide style={{ width: "130px" }}>
      <Link href={`/product/${product.id}`}>
        <div className="flex flex-col gap-2 p-2 rounded-xl border border-gray-100 bg-white shadow-sm cursor-pointer select-none hover:shadow-md transition-shadow">
          {/* Timer Badge */}
          <div className="self-start px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-bold">
            {hours}:{minutes}:{seconds}
          </div>

          {/* Image */}
          <div className="aspect-square rounded-lg bg-gray-50 overflow-hidden relative">
            <Image
              src={product.image || "/placeholder.png"}
              alt={product.name}
              fill
              className="object-cover"
            />
            {/* Discount Badge */}
            {product.discount > 0 && (
              <span className="absolute top-2 right-2 bg-[#ef4056] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full z-10">
                {product.discount}٪
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h4 className="text-xs font-medium text-welf-800 truncate">{product.name}</h4>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-sm font-bold text-welf-900">
                {product.price.toLocaleString("fa-IR")}
              </span>
              <span className="text-[10px] text-welf-400">تومان</span>
            </div>
          </div>
        </div>
      </Link>
    </SwiperSlide>
  );
}

/**
 * Flash Offer Rail Component
 * Displays products with individual countdown timers
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

  // Don't show section if no flash deals
  if (!loading && flashDeals.length === 0) {
    return null;
  }

  return (
    <div className="py-6 bg-white">
      <div className="flex items-center gap-2 px-4 mb-2">
        <Timer className="text-vita-500 w-5 h-5" />
        <SectionTitle className="!mb-0 !px-0">پیشنهادات لحظه‌ای</SectionTitle>
      </div>

      {loading ? (
        // Loading skeleton
        <div className="px-4">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-[130px] h-[200px] rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <Swiper
          modules={[FreeMode, Autoplay]}
          freeMode={true}
          loop={flashDeals.length > 3}
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          speed={5000}
          spaceBetween={12}
          slidesPerView={"auto"}
          className="w-full !px-4 free-mode-slider"
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
