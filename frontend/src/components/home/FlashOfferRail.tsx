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
 */
function FlashDealCard({ product }: { product: Product }) {
  const router = useRouter();
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);

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

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 flex flex-col h-full cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group p-3"
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
      {/* Image */}
      <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
        <Image
          src={product.image || "/placeholder.png"}
          alt={product.name}
          fill
          className={`object-contain p-4 group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? "grayscale opacity-60" : ""
            }`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          loading="lazy"
          quality={75}
          placeholder="blur"
          blurDataURL={getBlurDataURL()}
        />

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
      <h3
        className={`text-[12px] font-bold leading-6 line-clamp-2 mb-2 min-h-[48px] text-right ${product.countInStock === 0 ? "text-gray-400" : "text-gray-800"
          }`}
      >
        {product.name}
      </h3>

      {/* Price Section */}
      <div className="flex flex-col gap-1 mt-auto">
        {/* Current Price */}
        <div
          className={`flex items-center justify-end gap-1 ${product.countInStock === 0 ? "text-gray-400" : "text-gray-900"
            }`}
        >
          <span className="text-[16px] font-black tracking-tight">
            {product.price.toLocaleString("fa-IR")}
          </span>
          <span
            className={`text-[11px] font-medium ${product.countInStock === 0 ? "text-gray-400" : "text-gray-600"
              }`}
          >
            تومان
          </span>
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
    <div className="py-6 bg-white border-b border-gray-100">
      {/* Header */}
      <div className="flex items-end justify-between px-4 mb-4">
        <Link
          href="/products?sort=flash"
          className="flex items-center text-blue-500 text-[12px] font-bold hover:text-blue-600 transition-colors mb-1"
        >
          مشاهده همه
          <ChevronLeft className="w-4 h-4 mr-1" />
        </Link>
        <div className="text-right">
          <h2 className="text-xl font-black text-gray-900 mb-1">پیشنهاد لحظه‌ای</h2>
          <p className="text-xs text-gray-500 font-medium">محصولات منتخب برای شما</p>
        </div>
      </div>

      {loading ? (
        <div className="px-4">
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-[160px] h-[260px] rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
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
          dir="rtl"
        >
          {flashDeals.map((product) => (
            <SwiperSlide key={product.id} style={{ width: "160px", height: "auto" }}>
              <FlashDealCard product={product} />
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
}
