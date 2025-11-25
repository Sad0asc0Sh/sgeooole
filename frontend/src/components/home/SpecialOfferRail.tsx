"use client";

import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { ChevronLeft, Percent } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { productService, Product } from "@/services/productService";
import { useCountdown } from "@/hooks/useCountdown";

export default function SpecialOfferRail() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const earliestEndTime =
    products.length > 0
      ? products
        .filter((p) => p.specialOfferEndTime)
        .map((p) => new Date(p.specialOfferEndTime!).getTime())
        .sort((a, b) => a - b)[0]
      : undefined;

  const { hours, minutes, seconds, isExpired } = useCountdown(
    earliestEndTime ? new Date(earliestEndTime).toISOString() : undefined
  );

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await productService.getSpecialOffers(10);
        setProducts(data);
      } catch (err) {
        console.error("Failed to fetch special offer products:", err);
        setError("خطا در دریافت پیشنهادهای ویژه");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading || error || products.length === 0 || isExpired) {
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
          پیشنهاد‌شگفت‌انگیز
            </h2>
          </div>

          {/* Global Countdown Timer */}
          <div className="flex items-center gap-1 text-white font-bold text-xs dir-ltr">
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

            return (
              <SwiperSlide
                key={product.id}
                style={{ width: "148px", height: "auto" }}
              >
                <Link href={`/product/${product.id}`} className="block h-full">
                  <div className="bg-white p-3 rounded-lg h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
                    {/* Product Image */}
                    <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
                      <Image
                        src={product.image || "/placeholder.png"}
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
                    </div>

                    {/* Product Name */}
                    <h3 className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                      {product.name}
                    </h3>

                    {/* Price Section */}
                    <div className="flex flex-col gap-1 mt-auto">
                      <div className="flex items-center justify-between h-5">
                        {product.countInStock > 0 && product.discount > 0 ? (
                          <>
                            <div className="bg-vita-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                              {product.discount}٪
                            </div>
                            <span className="text-[10px] text-gray-300 line-through decoration-gray-300">
                              {(product.price * 1.1).toLocaleString("fa-IR")}
                            </span>
                          </>
                        ) : (
                          <div className="h-5" />
                        )}
                      </div>

                      <div className={`flex items-center justify-end gap-1 ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                        <span className="text-[15px] font-black tracking-tight">
                          {product.price.toLocaleString("fa-IR")}
                        </span>
                        <span className={`text-[10px] font-medium ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-600'}`}>
                          تومان
                        </span>
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

