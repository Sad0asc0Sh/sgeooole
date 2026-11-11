"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pagination, Zoom, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/zoom";
import "swiper/css/navigation";

import ResilientImage from "@/components/ui/ResilientImage";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Share2, Printer, Check, MoreHorizontal } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import { Product } from "@/services/productService";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { isFlashDealLabel } from "@/lib/flashDealUtils";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { promotionPillClass } from "@/lib/campaignTheme";
import { getServerNow } from "@/lib/serverClock";
import { getBlurDataURL } from "@/lib/blurPlaceholder";

type ProductGalleryProps = {
    product: Product;
};

export default function ProductGallery({ product }: ProductGalleryProps) {
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [initialSlide, setInitialSlide] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [copied, setCopied] = useState(false);

    const isFavorite = isInWishlist(product.id);

    const handleShare = async () => {
        const productUrl = typeof window !== "undefined" ? window.location.href : "";
        if (!productUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.title,
                    text: product.title,
                    url: productUrl,
                });
                return;
            } catch {
                // Fall through to copy-link when share is dismissed.
            }
        }
        try {
            await navigator.clipboard.writeText(productUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            try {
                window.prompt("لینک محصول را کپی کنید:", productUrl);
            } catch {
                // Clipboard unavailable; nothing to do.
            }
        }
    };

    // Preload the next slide in the background while the current one is shown.
    useEffect(() => {
        const next = product.images?.[activeIndex + 1];
        if (next) {
            const im = new window.Image();
            im.src = next;
        }
    }, [activeIndex, product.images]);

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

    // SEO: no `mounted` gate here. The gallery must render in the server HTML
    // (Swiper + next/image both SSR their markup) so crawlers can see the main
    // product images; a client-only placeholder made the PDP ship zero gallery
    // <img> tags. The modal below is the only client-gated part (portal, open state).
    const faNum = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
    const brandSuffix = product.brand ? ` برند ${product.brand}` : "";
    const galleryAlt = (index: number) =>
        index === 0
            ? `خرید ${product.name}${brandSuffix}`
            : `${product.name} - نمای ${faNum(index + 1)}`;
    const thumbnailAlt = (index: number) => `${product.name} - تصویر کوچک ${faNum(index + 1)}`;

    // Compute flash deal status once (no interval needed)
    const now = getServerNow();
    const isFlashDealActive = Boolean(
        product.isFlashDeal &&
        product.flashDealEndTime &&
        new Date(product.flashDealEndTime).getTime() > now
    );

    // The badge is shown only while the promotion behind the label is still live
    // (a stale label with an ended countdown must not survive).
    const promotion = resolveProductPromotion(product, now);
    const showCampaignBadge = Boolean(
        product.campaignLabel &&
        !(isFlashDealLabel(product.campaignLabel) && !isFlashDealActive) &&
        promotion.kind !== "none"
    );
    // Same scheme as the card badge and the detail banner: a live flash deal
    // keeps its amber→orange→red gradient instead of a campaign tint.
    const campaignPill = promotionPillClass(promotion.kind, product.campaignTheme);

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
                                            alt={galleryAlt(index)}
                                            fill
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
                                    src={product.cardImages?.[index] || img}
                                    backupSrc={img}
                                    alt={thumbnailAlt(index)}
                                    fill
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
            <div className="w-full max-w-full min-w-0 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0 h-full">
                <div className="relative w-full max-w-full aspect-[4/3] max-h-[45vh] supports-[height:100dvh]:max-h-[45dvh] [@media(pointer:coarse)]:max-h-[42svh] md:aspect-square md:max-h-none [@media(pointer:coarse)]:md:max-h-[42svh] min-h-0 min-w-0 overflow-hidden bg-white">
                    <div className="absolute inset-0 min-h-0 min-w-0 max-w-full overflow-hidden">
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
                            className="!w-full !h-full !max-w-full cursor-pointer [&_.swiper-slide]:!h-full [&_.swiper-wrapper]:!max-w-full"
                        >
                            {product.images.map((img, index) => (
                                <SwiperSlide key={index} className="!w-full !h-full">
                                    <div className="relative w-full h-full min-h-0 min-w-0 overflow-hidden">
                                        <ResilientImage
                                            src={img}
                                            alt={galleryAlt(index)}
                                            fill
                                            className="object-contain object-center !p-4 mix-blend-multiply"
                                            sizes="(max-width: 1023px) 100vw, 45vw"
                                            priority={index === 0}
                                            fetchPriority={index === 0 ? "high" : "auto"}
                                            /* Phase 2 SEO #12: only the first image is eager/high-priority;
                                               the rest lazy-load. Optimizer ON (no unoptimized) so Next.js
                                               emits a real srcset (AVIF/WebP) — product images live on
                                               Parspack, which is in next.config remotePatterns. */
                                            loading={index === 0 ? "eager" : "lazy"}
                                            quality={80}
                                            maxRetries={2}
                                            placeholder="blur"
                                            blurDataURL={getBlurDataURL()}
                                        />

                                        {showCampaignBadge && index === 0 && (
                                            <div className="absolute top-4 left-4 z-20">
                                                <span className={`text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg ${campaignPill}`}>
                                                    {product.campaignLabel}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </SwiperSlide>
                            ))}
                        </Swiper>

                        {/* Vertical action rail (mobile140 PDP parity): wishlist / share / print */}
                        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleWishlist(product); }}
                                aria-label={isFavorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
                                className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors ${isFavorite
                                    ? "bg-red-50 text-red-500"
                                    : "bg-white/85 text-gray-700 hover:bg-white"
                                    }`}
                            >
                                <Heart size={18} className={isFavorite ? "fill-red-500" : ""} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                                aria-label={copied ? "لینک کپی شد" : "اشتراک‌گذاری"}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-700 backdrop-blur hover:bg-white transition-colors"
                            >
                                {copied ? <Check size={18} /> : <Share2 size={18} />}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); window.print(); }}
                                aria-label="چاپ مشخصات"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-700 backdrop-blur hover:bg-white transition-colors"
                            >
                                <Printer size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 min-w-0 flex gap-2 lg:gap-2 px-4 overflow-x-auto no-scrollbar pt-2 pb-3 lg:pb-4 justify-center bg-white">
                    {(product.images.length > 5 ? product.images.slice(0, 5) : product.images).map((img, index) => (
                        <button
                            key={index}
                            onClick={() => swiperRef.current?.slideTo(index)}
                            className={`relative w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all duration-200 bg-white shadow-sm ${activeIndex === index
                                ? "border-kala-500 shadow-md scale-110 ring-2 ring-kala-200"
                                : "border-gray-200 opacity-70 hover:opacity-100 hover:border-gray-300"
                                }`}
                        >
                            <ResilientImage
                                src={product.cardImages?.[index] || img}
                                backupSrc={img}
                                alt={thumbnailAlt(index)}
                                fill
                                className="object-cover"
                                sizes="(min-width: 1024px) 56px, 48px"
                                loading="lazy"
                                quality={60}
                                placeholder="blur"
                                blurDataURL={getBlurDataURL()}
                            />
                        </button>
                    ))}
                    {product.images.length > 5 && (
                        <button
                            type="button"
                            onClick={() => openGallery(5)}
                            aria-label={`مشاهده ${product.images.length} تصویر`}
                            className="relative w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0 bg-white shadow-sm flex items-center justify-center"
                        >
                            <ResilientImage
                                src={product.cardImages?.[5] || product.images[5]}
                                alt={thumbnailAlt(5)}
                                fill
                                className="object-cover blur-sm opacity-50"
                                sizes="(min-width: 1024px) 56px, 48px"
                                loading="lazy"
                                quality={60}
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-gray-800">
                                <MoreHorizontal size={20} aria-hidden />
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {modalContent}
        </>
    );
}
