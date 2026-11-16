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
import { X } from "lucide-react";
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
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    // Keep the page in place while the full-screen gallery is open.
    useEffect(() => {
        if (!isGalleryOpen) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeButtonRef.current?.focus();
        const scrollY = window.scrollY;
        const previous = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top,
            left: document.body.style.left,
            right: document.body.style.right,
            width: document.body.style.width,
        };
        Object.assign(document.body.style, {
            overflow: "hidden", position: "fixed", top: `-${scrollY}px`,
            left: "0", right: "0", width: "100%",
        });
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsGalleryOpen(false);
            if (event.key === "Tab") {
                const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
                ) ?? []).filter((element) => element.getAttribute("aria-disabled") !== "true");
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            Object.assign(document.body.style, previous);
            window.removeEventListener("keydown", onKeyDown);
            window.scrollTo(0, scrollY);
            previousFocus?.focus({ preventScroll: true });
        };
    }, [isGalleryOpen]);

    // Memoize handlers
    const handleThumbnailClick = useCallback((index: number) => {
        modalSwiperRef.current?.slideTo(index);
    }, []);

    const openGallery = useCallback((index: number) => {
        setInitialSlide(index);
        setActiveIndex(index);
        setIsGalleryOpen(true);
    }, []);

    const closeGallery = useCallback(() => {
        swiperRef.current?.slideTo(activeIndex);
        setIsGalleryOpen(false);
    }, [activeIndex]);

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
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="گالری تصاویر محصول"
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
                    ref={closeButtonRef}
                    type="button"
                    aria-label="بستن گالری تصاویر"
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
                            onSlideChange={(swiper) => {
                                setActiveIndex(swiper.activeIndex);
                                swiperRef.current?.slideTo(swiper.activeIndex);
                            }}
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
                                            loading={index === initialSlide ? "eager" : "lazy"}
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
                                type="button"
                                aria-label={`نمایش تصویر ${faNum(index + 1)}`}
                                aria-pressed={activeIndex === index}
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
            <div className="w-full max-w-full min-w-0 bg-white flex flex-col min-h-0">
                <div className="relative w-full max-w-full aspect-square max-h-[420px] lg:max-h-[460px] min-h-0 min-w-0 overflow-hidden bg-white">
                    <div className="absolute inset-0 min-h-0 min-w-0 max-w-full overflow-hidden">
                        <Swiper
                            spaceBetween={10}
                            slidesPerView={1}
                            pagination={{ clickable: true }}
                            loop={false}
                            modules={[Pagination]}
                            onSwiper={(swiper) => { swiperRef.current = swiper; }}
                            onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                            onClick={() => openGallery(activeIndex)}
                            role="button"
                            tabIndex={0}
                            aria-label="باز کردن گالری تصاویر محصول"
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openGallery(activeIndex);
                                }
                            }}
                            className="!w-full !h-full !max-w-full cursor-zoom-in [&_.swiper-slide]:!h-full [&_.swiper-wrapper]:!max-w-full [&_.swiper-pagination]:!bottom-1 lg:[&_.swiper-pagination]:hidden"
                        >
                            {product.images.map((img, index) => (
                                <SwiperSlide key={index} className="!w-full !h-full">
                                    <div className="relative w-full h-full min-h-0 min-w-0 overflow-hidden">
                                        <ResilientImage
                                            src={img}
                                            alt={galleryAlt(index)}
                                            fill
                                            className="object-contain object-center !p-5 sm:!p-7"
                                            sizes="(max-width: 1023px) 100vw, 45vw"
                                            priority={index === 0}
                                            fetchPriority={index === 0 ? "high" : "auto"}
                                            /* Only the initial image competes for the first paint. */
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
                    </div>
                </div>

                <div className="shrink-0 min-w-0 flex gap-2 px-2 overflow-x-auto no-scrollbar pt-3 pb-3 justify-start bg-white">
                    {product.images.map((img, index) => (
                        <button
                            key={index}
                            type="button"
                            aria-label={`نمایش تصویر ${faNum(index + 1)}`}
                            aria-pressed={activeIndex === index}
                            onClick={() => { setActiveIndex(index); swiperRef.current?.slideTo(index); }}
                            className={`relative w-14 h-14 lg:w-16 lg:h-16 rounded-lg overflow-hidden border flex-shrink-0 transition-colors bg-white ${activeIndex === index
                                ? "border-kala-500"
                                : "border-gray-200 hover:border-gray-400"
                                }`}
                        >
                            <ResilientImage
                                src={product.cardImages?.[index] || img}
                                backupSrc={img}
                                alt={thumbnailAlt(index)}
                                fill
                                className="object-contain !p-1"
                                sizes="(min-width: 1024px) 64px, 56px"
                                loading="lazy"
                                quality={60}
                                placeholder="blur"
                                blurDataURL={getBlurDataURL()}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {modalContent}
        </>
    );
}
