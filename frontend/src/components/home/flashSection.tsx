"use client";

import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { productService, Product } from "@/services/productService";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";

/**
 * کارت محصول در سکشن تکنواف
 * با دیزاین مشابه تصویر ارسالی
 */
function TechnavProductCard({ product }: { product: Product }) {
    const router = useRouter();
    const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);

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
            router.push(buildProductUrl(product));
        }
    };

    return (
        <SwiperSlide style={{ width: "148px", height: "auto" }}>
            <div
                className="bg-white rounded-lg border border-gray-200 h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group"
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
                <div className="px-3 py-3">
                    {/* Image */}
                    <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
                        <Image
                            src={product.image || "/placeholder.png"}
                            alt={product.name}
                            fill
                            className={`object-cover group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? 'grayscale opacity-60' : ''}`}
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            loading="lazy"
                            quality={75}
                            placeholder="blur"
                            blurDataURL={getBlurDataURL()}
                        />

                        {/* Timer Overlay (Top Right) */}
                        {(product.flashDealEndTime || product.specialOfferEndTime) && (
                            <ProductTimerBadge
                                targetDate={(product.flashDealEndTime || product.specialOfferEndTime)!}
                                color="text-amber-600"
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
 * سکشن تکنواف - نمایش محصولات با تخفیف در یک بنر طلایی
 */
export default function TechnavSection() {
    const [technavProducts, setTechnavProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let isCancelled = false;
        const fetchTechnavProducts = async () => {
            try {
                setLoading(true);
                // گرفتن محصولات با تخفیف (flash deals)
                const deals = await productService.getFlashDeals(10);
                if (!isCancelled) {
                    setTechnavProducts(deals);
                }
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.error("Error loading technav products:", error);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchTechnavProducts();

        return () => {
            isCancelled = true;
        };
    }, []);

    if (!loading && technavProducts.length === 0) {
        return null;
    }

    return (
        <div className="py-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #d4a574 0%, #b8860b 50%, #8b6914 100%)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 mb-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-white text-xl font-black tracking-tight">پیشنهاد‌لحظه‌ای</h2>
                    <ChevronLeft className="text-white w-5 h-5 cursor-pointer hover:translate-x-1 transition-transform" onClick={() => router.push('/products')} />
                </div>

                <button
                    className="text-white text-sm font-bold hover:underline"
                    onClick={() => router.push('/products')}
                >
                    نمایش همه
                </button>
            </div>

            {loading ? (
                <div className="px-4">
                    <div className="flex gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="w-[130px] h-[200px] rounded-xl bg-white/20 animate-pulse"
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
                        reverseDirection: true,
                    }}
                    speed={4000}
                    spaceBetween={12}
                    slidesPerView={"auto"}
                    className="w-full !px-4 [&_.swiper-wrapper]:!ease-linear"
                    grabCursor={true}
                >
                    {technavProducts.map((product) => (
                        <TechnavProductCard key={product.id} product={product} />
                    ))}
                </Swiper>
            )}
        </div>
    );
}
