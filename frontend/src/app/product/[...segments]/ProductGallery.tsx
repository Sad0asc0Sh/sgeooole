"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Pagination, Zoom, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/zoom";
import "swiper/css/navigation";

import ResilientImage from "@/components/ui/ResilientImage";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Product } from "@/services/productService";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { isFlashDealLabel } from "@/lib/flashDealUtils";

type ProductGalleryProps = {
    product: Product;
};

export default function ProductGallery({ product }: ProductGalleryProps) {
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [initialSlide, setInitialSlide] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Scroll Lock: Prevent body scroll when gallery modal is open
    useEffect(() => {
        if (isGalleryOpen) {
            const scrollY = window.scrollY;
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
            document.body.dataset.scrollY = String(scrollY);
        } else {
            const scrollY = document.body.dataset.scrollY;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY));
                delete document.body.dataset.scrollY;
            }
        }

        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
        };
    }, [isGalleryOpen]);

    // Memoize handlers
    const handleThumbnailClick = useCallback((index: number) => {
        modalSwiperRef.current?.slideTo(index);
    }, []);

    const openGallery = useCallback((index: number) => {
        setInitialSlide(index);
        setIsGalleryOpen(true);
    }, []);

    const closeGallery = useCallback(() => {
        setIsGalleryOpen(false);
    }, []);

    // Use refs instead of state to avoid re-renders
    const swiperRef = useRef<SwiperType | null>(null);
    const modalSwiperRef = useRef<SwiperType | null>(null);

    // Early return AFTER all hooks
    if (!mounted) return (
        <div className="h-[260px] w-full bg-gradient-to-b from-gray-100 to-gray-50 flex items-center justify-center">
            <div className="w-24 h-24 rounded-2xl bg-gray-200 animate-pulse" />
        </div>
    );

    // Compute flash deal status once (no interval needed)
    const now = Date.now();
    const isFlashDealActive = Boolean(
        product.isFlashDeal &&
        product.flashDealEndTime &&
        new Date(product.flashDealEndTime).getTime() > now
    );

    const showCampaignBadge = Boolean(
        product.campaignLabel &&
        !(isFlashDealLabel(product.campaignLabel) && !isFlashDealActive)
    );

    // Modal content
    const modalContent = isGalleryOpen ? createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 2147483647,
                    backgroundColor: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        closeGallery();
                    }
                }}
            >
                <button
                    onClick={closeGallery}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        zIndex: 2147483647,
                        padding: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <X size={24} color="#000" strokeWidth={2.5} />
                </button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px 20px' }}>
                        <Swiper
                            spaceBetween={20}
                            slidesPerView={1}
                            zoom={true}
                            navigation={true}
                            pagination={{ clickable: true }}
                            loop={false}
                            modules={[Pagination, Zoom, Navigation]}
                            initialSlide={initialSlide}
                            onSwiper={(swiper) => { modalSwiperRef.current = swiper; }}
                            onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                            style={{
                                width: '100%',
                                height: '100%',
                                maxWidth: '1200px',
                            }}
                        >
                            {product.images.map((img, index) => (
                                <SwiperSlide key={index}>
                                    <div className="swiper-zoom-container"
                                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <ResilientImage
                                            src={img}
                                            alt={`${product.name} - Image ${index + 1}`}
                                            fill
                                            unoptimized
                                            className="object-contain"
                                            sizes="100vw"
                                            priority={index === initialSlide}
                                            loading="eager"
                                            quality={85}
                                            maxRetries={2}
                                        />
                                    </div>
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '8px', overflowX: 'auto' }}>
                        {product.images.map((img, index) => (
                            <button
                                key={index}
                                onClick={() => handleThumbnailClick(index)}
                                className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all duration-200 ${activeIndex === index
                                    ? "border-white shadow-lg scale-110"
                                    : "border-gray-600 opacity-60 hover:opacity-100 hover:border-gray-400"
                                    }`}
                            >
                                <ResilientImage
                                    src={img}
                                    alt={`Thumbnail ${index + 1}`}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                    sizes="64px"
                                    loading="lazy"
                                    quality={60}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    ) : null;

    return (
        <>
            <div className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0 h-full">
                <div className="relative w-full aspect-square min-h-0 min-w-0 bg-gradient-to-b from-gray-50 to-white">
                    <div className="absolute inset-0 min-h-0 min-w-0">
                        <Swiper
                            spaceBetween={10}
                            slidesPerView={1}
                            pagination={{ clickable: true }}
                            navigation={true}
                            loop={false}
                            modules={[Pagination, Navigation]}
                            onSwiper={(swiper) => { swiperRef.current = swiper; }}
                            onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                            onClick={() => openGallery(activeIndex)}
                            className="!w-full !h-full cursor-pointer [&_.swiper-slide]:!h-full"
                        >
                            {product.images.map((img, index) => (
                                <SwiperSlide key={index} className="!w-full !h-full">
                                    <div className="relative w-full h-full min-h-0 min-w-0 overflow-hidden">
                                        <ResilientImage
                                            src={img}
                                            alt={`${product.name} - Image ${index + 1}`}
                                            fill
                                            unoptimized
                                            className="object-contain object-center !p-4"
                                            sizes="(min-width: 1024px) 45vw, 100vw"
                                            priority={index === 0}
                                            loading="eager"
                                            quality={80}
                                            maxRetries={2}
                                        />

                                        {showCampaignBadge && index === 0 && (
                                            <div className="absolute top-4 left-4 z-20">
                                                <span className={`text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg ${product.campaignTheme === 'gold-red'
                                                    ? 'bg-gradient-to-r from-yellow-400 to-red-600'
                                                    : product.campaignTheme === 'red-purple'
                                                        ? 'bg-gradient-to-r from-rose-500 to-purple-700'
                                                        : product.campaignTheme === 'gold'
                                                            ? 'bg-gradient-to-r from-amber-400 to-yellow-600'
                                                            : 'bg-gradient-to-r from-lime-500 to-orange-400'
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
                </div>

                <div className="shrink-0 flex gap-2 lg:gap-2 px-4 overflow-x-auto no-scrollbar pt-2 pb-3 lg:pb-4 justify-center bg-white">
                    {product.images.map((img, index) => (
                        <button
                            key={index}
                            onClick={() => swiperRef.current?.slideTo(index)}
                            className={`relative w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all duration-200 bg-white shadow-sm ${activeIndex === index
                                ? "border-kala-500 shadow-md scale-110 ring-2 ring-kala-200"
                                : "border-gray-200 opacity-70 hover:opacity-100 hover:border-gray-300"
                                }`}
                        >
                            <ResilientImage
                                src={img}
                                alt={`Thumbnail ${index + 1}`}
                                fill
                                unoptimized
                                className="object-cover"
                                sizes="(min-width: 1024px) 56px, 48px"
                                loading="lazy"
                                quality={60}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {modalContent}
        </>
    );
}
