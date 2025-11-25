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
import { useCountdown } from "@/hooks/useCountdown";

/**
 * Single flash deal card with:
 * - Drag vs click handling
 * - Out-of-stock styling identical to main product cards
 */
function FlashDealCard({ product }: { product: Product }) {
  const fallbackEndRef = useRef<string>(
    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  );
  const targetEndTime =
    (product as any).flashDealEndTime ||
    (product as any).specialOfferEndTime ||
    fallbackEndRef.current;

  const { hours, minutes, seconds, isExpired } = useCountdown(targetEndTime);
  const router = useRouter();
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
  const isOutOfStock = product.countInStock === 0;

  const imageSrc =
    typeof product.image === "string" && product.image.trim() !== ""
      ? product.image.trim()
      : "/placeholder-product.png";

  if (isExpired) return null;

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
        className="bg-white p-3 rounded-lg border border-gray-200 h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group"
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
        {/* Timer Badge (Hide if out of stock) */}
        {product.countInStock > 0 ? (
          <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-bold shadow-sm">
            {hours}:{minutes}:{seconds}
          </div>
        ) : null}

        {/* Image */}
        <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            className={`object-cover group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? 'grayscale opacity-60' : ''}`}
          />

          {/* Out of Stock Overlay */}
          {product.countInStock === 0 && (
            <div className="absolute inset-0 bg-white/40 z-10 flex items-center justify-center">
              <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                ناموجود
              </span>
            </div>
          )}

          {/* Discount Badge (Only if in stock) */}
          {product.countInStock > 0 && product.discount > 0 && (
            <span className="absolute top-2 right-2 bg-[#ef4056] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full z-10">
              {product.discount}٪
            </span>
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
              <span className="text-[10px] text-gray-300 line-through decoration-gray-300">
                {(product.price * 1.1).toLocaleString("fa-IR")}
              </span>
            ) : <div className="h-5" />}
          </div>

          {/* Row 2: Current Price */}
          <div className={`flex items-center justify-end gap-1 ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
            <span className="text-[15px] font-black tracking-tight">
              {product.price.toLocaleString("fa-IR")}
            </span>
            <span className={`text-[10px] font-medium ${product.countInStock === 0 ? 'text-gray-400' : 'text-amber-500'}`}>تومان</span>
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
          فروش ویژه لحظه‌ای
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
