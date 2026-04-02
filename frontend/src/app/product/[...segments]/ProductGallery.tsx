"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Pagination, Zoom, Navigation, Thumbs } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/zoom";
import "swiper/css/navigation";
import "swiper/css/thumbs";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
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
    const [swiperInstance, setSwiperInstance] = useState<SwiperType | null>(null);
    const [modalSwiperInstance, setModalSwiperInstance] = useState<SwiperType | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [modalActiveIndex, setModalActiveIndex] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [mounted, setMounted] = useState(false);
    const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    const getImageKey = (index: number, url: string) => `${index}:${url}`;

    const handleImageLoad = (key: string) => {
        setLoadedImages(prev => ({ ...prev, [key]: true }));
    };

    useEffect(() => {
        setMounted(true);
        setPortalContainer(document.body);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // Scroll Lock: Prevent body scroll when gallery modal is open
    useEffect(() => {
        if (isGalleryOpen) {
            // Store current scroll position
            const scrollY = window.scrollY;

            // Lock body scroll
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';

            // Store scroll position in data attribute
            document.body.dataset.scrollY = String(scrollY);
        } else {
            // Restore scroll position
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

    // Update modal active index when initialSlide changes
    useEffect(() => {
        if (isGalleryOpen) {
            setModalActiveIndex(initialSlide);
        }
    }, [isGalleryOpen, initialSlide]);

    if (!mounted) return (
        <div className="h-[260px] w-full bg-gradient-to-b from-gray-100 to-gray-50 flex items-center justify-center">
            <div className="w-24 h-24 rounded-2xl bg-gray-200 animate-pulse" />
        </div>
    );

    const isFlashDealActive = Boolean(
        product.isFlashDeal &&
        product.flashDealEndTime &&
        new Date(product.flashDealEndTime).getTime() > now
    );

    const showCampaignBadge = Boolean(
        product.campaignLabel &&
        !(isFlashDealLabel(product.campaignLabel) && !isFlashDealActive)
    );

    const handleThumbnailClick = (index: number) => {
        if (modalSwiperInstance) {
            modalSwiperInstance.slideTo(index);
        }
    };

    // Modal content to be rendered via Portal
    const modalContent = isGalleryOpen && portalContainer ? createPortal(
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
                    zIndex: 2147483647, // Maximum possible z-index
                    backgroundColor: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        setIsGalleryOpen(false);
                    }
                }}
            >
                {/* Close Button - Prominent white button */}
                <button
                    onClick={() => setIsGalleryOpen(false)}
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
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    aria-label="بستن گالری"
                >
                    <X size={28} color="#333" />
                </button>

                {/* Image Counter */}
                <div
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        zIndex: 2147483647,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: '#fff',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 500,
                    }}
                >
                    {product.images.length} / {modalActiveIndex + 1}
                </div>

                {/* Main Image Area */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 16px' }}>
                    <Swiper
                        modules={[Zoom, Navigation]}
                        zoom={{ maxRatio: 3 }}
                        navigation={{
                            prevEl: '.modal-prev-btn',
                            nextEl: '.modal-next-btn',
                        }}
                        initialSlide={initialSlide}
                        style={{ height: '100%', width: '100%', maxWidth: '900px' }}
                        onSwiper={setModalSwiperInstance}
                        onSlideChange={(swiper) => setModalActiveIndex(swiper.activeIndex)}
                    >
                        {product.images.map((img, index) => (
                            <SwiperSlide key={getImageKey(index, img)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div className="swiper-zoom-container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ position: 'relative', width: '100%', height: '100%', maxHeight: '60vh' }}>
                                        <Image
                                            src={img}
                                            alt={`${product.title} - ${index + 1}`}
                                            fill
                                            unoptimized
                                            style={{ objectFit: 'contain' }}
                                            priority={index === initialSlide}
                                            sizes="100vw"
                                            quality={90}
                                        />
                                    </div>
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>

                    {/* Navigation Arrows */}
                    {product.images.length > 1 && (
                        <>
                            <button
                                className="modal-prev-btn"
                                style={{
                                    position: 'absolute',
                                    left: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    zIndex: 2147483647,
                                    padding: '12px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    borderRadius: '50%',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                }}
                            >
                                <ChevronLeft size={28} color="#333" />
                            </button>
                            <button
                                className="modal-next-btn"
                                style={{
                                    position: 'absolute',
                                    right: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    zIndex: 2147483647,
                                    padding: '12px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    borderRadius: '50%',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                }}
                            >
                                <ChevronRight size={28} color="#333" />
                            </button>
                        </>
                    )}
                </div>

                {/* Modal Thumbnails */}
                <div
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '16px',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            gap: '12px',
                            overflowX: 'auto',
                            justifyContent: 'center',
                            maxWidth: '700px',
                            margin: '0 auto',
                        }}
                        className="no-scrollbar"
                    >
                        {product.images.map((img, index) => (
                            <button
                                key={index}
                                onClick={() => handleThumbnailClick(index)}
                                style={{
                                    position: 'relative',
                                    width: '70px',
                                    height: '70px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: modalActiveIndex === index ? '3px solid #fff' : '2px solid rgba(255, 255, 255, 0.3)',
                                    flexShrink: 0,
                                    opacity: modalActiveIndex === index ? 1 : 0.6,
                                    transform: modalActiveIndex === index ? 'scale(1.1)' : 'scale(1)',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                                    background: 'transparent',
                                    padding: 0,
                                }}
                            >
                                <Image
                                    src={img}
                                    alt={`Thumbnail ${index + 1}`}
                                    fill
                                    unoptimized
                                    style={{ objectFit: 'cover' }}
                                    sizes="70px"
                                    loading="lazy"
                                    quality={50}
                                />
                            </button>
                        ))}
                    </div>
                    <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px', marginTop: '12px' }}>
                        برای بزرگنمایی دو بار ضربه بزنید
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>,
        portalContainer
    ) : null;

    return (
        <>
            {/* Gallery Slider */}
            <div className="relative w-full bg-white rounded-xl lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-sm overflow-hidden">
               {/* Main Image Container - Compact for better viewport fit */}
               <div className="flex justify-center py-4 lg:py-2">
                    <div className="w-[70%] max-w-xs lg:w-full lg:max-w-[340px] aspect-[4/3] lg:aspect-[2/1]">
                       <Swiper
                            key={product.id}
                            modules={[]}
                            pagination={false}
                            slidesPerView={1}
                            className="h-full w-full"
                            onSwiper={setSwiperInstance}
                            onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                        >
                            {product.images.map((img, index) => (
                                <SwiperSlide key={getImageKey(index, img)} className="w-full h-full">
                                    <div
                                        className="w-full h-full relative cursor-zoom-in bg-white"
                                        onClick={() => {
                                            setInitialSlide(index);
                                            setIsGalleryOpen(true);
                                        }}
                                    >
                                        {/* Skeleton Loading Placeholder */}
                                        {!loadedImages[getImageKey(index, img)] && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                                                <div className="relative w-24 h-24">
                                                    <div className="absolute inset-0 bg-gray-100 rounded-2xl overflow-hidden">
                                                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                                                    </div>
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <Image
                                            src={img}
                                            alt={`${product.title} - ${index + 1}`}
                                            fill
                                            unoptimized
                                            className={`object-contain transition-opacity duration-300 ${loadedImages[getImageKey(index, img)] ? 'opacity-100' : 'opacity-0'}`}
                                            sizes="(max-width: 640px) 85vw, 384px"
                                            loading={index === 0 ? undefined : "lazy"}
                                            quality={85}
                                            onLoad={() => handleImageLoad(getImageKey(index, img))}
                                            priority={index === 0}
                                        />
                                        {showCampaignBadge && (
                                            <div className="absolute top-2 left-2 z-20">
                                                <span className={`text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                                    product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                                        product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' || product.campaignTheme === 'green-orange' ? 'bg-gradient-to-r from-lime-400 to-green-500' :
                                                            'bg-gradient-to-r from-blue-400 to-indigo-500'
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

                {/* Thumbnails - Always visible, compact on desktop */}
                <div className="flex gap-2 lg:gap-2 px-4 overflow-x-auto no-scrollbar pt-2 pb-3 lg:pb-4 justify-center bg-white">
                    {product.images.map((img, index) => (
                        <button
                            key={index}
                            onClick={() => swiperInstance?.slideTo(index)}
                            className={`relative w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all duration-200 bg-white shadow-sm ${activeIndex === index
                                ? "border-kala-500 shadow-md scale-110 ring-2 ring-kala-200"
                                : "border-gray-200 opacity-70 hover:opacity-100 hover:border-gray-300"
                                }`}
                        >
                            <Image
                                src={img}
                                alt={`Thumbnail ${index + 1}`}
                                fill
                                unoptimized
                                className="object-cover"
                                sizes="(min-width: 1024px) 56px, 48px"
                                loading="lazy"
                                quality={50}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Modal rendered via Portal to document.body */}
            {modalContent}
        </>
    );
}
