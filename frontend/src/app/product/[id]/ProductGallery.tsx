"use client";
import { useState, useEffect } from "react";
import { Pagination, Zoom, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/zoom";
import "swiper/css/navigation";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Product } from "@/services/productService";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { isFlashDealLabel } from "@/lib/flashDealUtils";

type ProductGalleryProps = {
    product: Product;
};

export default function ProductGallery({ product }: ProductGalleryProps) {
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [initialSlide, setInitialSlide] = useState(0);
    const [swiperInstance, setSwiperInstance] = useState<SwiperType | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!mounted) return <div className="h-[380px] w-full bg-gray-50" />;

    const isFlashDealActive = Boolean(
        product.isFlashDeal &&
        product.flashDealEndTime &&
        new Date(product.flashDealEndTime).getTime() > now
    );

    const showCampaignBadge = Boolean(
        product.campaignLabel &&
        !(isFlashDealLabel(product.campaignLabel) && !isFlashDealActive)
    );

    return (
        <>
            {/* Gallery Slider */}
            <div className="relative bg-gray-50 w-full pb-10">
                <div className="h-[380px] w-full">
                    <Swiper
                        key={product.id}
                        modules={[Pagination]}
                        pagination={{ clickable: true }}
                        slidesPerView={1}
                        className="h-full w-full"
                        style={{ height: '380px' }}
                        onSwiper={setSwiperInstance}
                        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                    >
                        {product.images.map((img, index) => (
                            <SwiperSlide key={index} className="flex items-center justify-center w-full h-full">
                                <div
                                    className="w-full h-full flex items-center justify-center text-gray-300 relative cursor-zoom-in"
                                    onClick={() => {
                                        setInitialSlide(index);
                                        setIsGalleryOpen(true);
                                    }}
                                >
                                    <Image
                                        src={img}
                                        alt={`${product.title} - ${index + 1}`}
                                        fill
                                        unoptimized
                                        className="object-contain p-8"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        loading={index === 0 ? undefined : "lazy"}
                                        quality={75}
                                        placeholder="blur"
                                        blurDataURL={getBlurDataURL()}
                                        priority={index === 0}
                                    />
                                    {showCampaignBadge && (
                                        <div className="absolute top-20 left-4 z-20">
                                            <span className={`text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                                product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                                    product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' || product.campaignTheme === 'green-orange' ? 'bg-gradient-to-r from-lime-400 to-green-500' :
                                                        'bg-gradient-to-r from-blue-400 to-indigo-500' // Default to Blue
                                                }`}>
                                                {product.campaignLabel}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>

                {/* Thumbnails */}
                <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar mt-2 pb-4">
                    {product.images.map((img, index) => (
                        <button
                            key={index}
                            onClick={() => swiperInstance?.slideTo(index)}
                            className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${activeIndex === index
                                ? "border-vita-500 shadow-md scale-105"
                                : "border-transparent opacity-60 hover:opacity-100"
                                }`}
                        >
                            <Image
                                src={img}
                                alt={`Thumbnail ${index + 1}`}
                                fill
                                unoptimized
                                className="object-cover"
                                sizes="64px"
                                loading="lazy"
                                quality={75}
                                placeholder="blur"
                                blurDataURL={getBlurDataURL()}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Full Screen Gallery Modal */}
            <AnimatePresence>
                {isGalleryOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/95 flex flex-col"
                    >
                        {/* Gallery Header */}
                        <div className="flex items-center justify-between p-4 text-white z-10">
                            <span className="text-sm font-medium">
                                {product.images.length} / <span id="current-slide">1</span>
                            </span>
                            <button
                                onClick={() => setIsGalleryOpen(false)}
                                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Zoomable Swiper */}
                        <div className="flex-1 h-full w-full overflow-hidden">
                            <Swiper
                                modules={[Zoom, Navigation, Pagination]}
                                zoom={true}
                                navigation={false}
                                pagination={{
                                    type: 'fraction',
                                    el: '#current-slide', // Custom pagination element
                                    formatFractionCurrent: (number) => number,
                                    formatFractionTotal: (number) => number,
                                    renderFraction: (currentClass, totalClass) => {
                                        return `<span class="${currentClass}"></span>`;
                                    }
                                }}
                                initialSlide={initialSlide}
                                className="h-full w-full"
                                onSlideChange={(swiper) => {
                                    const el = document.getElementById('current-slide');
                                    if (el) el.innerText = (swiper.realIndex + 1).toString();
                                }}
                            >
                                {product.images.map((img, index) => (
                                    <SwiperSlide key={index} className="flex items-center justify-center">
                                        <div className="swiper-zoom-container w-full h-full flex items-center justify-center">
                                            <div className="relative w-full h-full max-w-4xl max-h-[80vh]">
                                                <Image
                                                    src={img}
                                                    alt={`${product.title} - ${index + 1}`}
                                                    fill
                                                    unoptimized
                                                    className="object-contain"
                                                    priority={index === initialSlide}
                                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                    quality={75}
                                                    placeholder="blur"
                                                    blurDataURL={getBlurDataURL()}
                                                />
                                            </div>
                                        </div>
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                        </div>

                        {/* Gallery Footer (Thumbnails could go here) */}
                        <div className="p-4 text-center text-white/50 text-xs">
                            برای بزرگنمایی دو بار ضربه بزنید
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
