"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Images, X, ZoomIn } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Navigation, Pagination, Zoom } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/zoom";

import ResilientImage from "@/components/ui/ResilientImage";
import { promotionPillClass } from "@/lib/campaignTheme";
import { isFlashDealLabel } from "@/lib/flashDealUtils";
import { resolveProductPromotion, type ProductPromotionState } from "@/lib/promotions/productPromotion";
import { brandAltSuffix } from "@/lib/productData";
import type { Product } from "@/types/product";

const placeholder = "/placeholder.svg";
const previewWidth = 48;
const galleryBreakpoints = { 768: { slidesPerView: 1, slidesOffsetAfter: 0 } } as const;
const galleryStageStyle = { "--gallery-preview-width": `${previewWidth}px` } as CSSProperties;
const faNum = (number: number) => number.toLocaleString("fa-IR", { useGrouping: false });

type ProductGalleryProps = {
    product: Product;
    promotion?: ProductPromotionState;
};

export default function ProductGallery({ product, promotion = resolveProductPromotion(product) }: ProductGalleryProps) {
    const photos = product.images.length ? product.images : [product.image || placeholder];
    const thumbnails = photos.map((photo, index) => product.cardImages?.[index] || (index === 0 && product.cardImage) || photo);
    // Packages and colours can share photos. Reset both sliders only when the full-size set changes.
    const collectionKey = JSON.stringify([product.id, photos]);
    const [position, setPosition] = useState({ collectionKey, index: 0 });
    const activeIndex = position.collectionKey === collectionKey ? position.index : 0;
    const multiple = photos.length > 1;
    const canOpen = multiple || photos[0] !== placeholder;
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const isViewerVisible = isGalleryOpen && canOpen;
    const previewRef = useRef<SwiperType | null>(null);
    const viewerRef = useRef<SwiperType | null>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const activeThumbRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setPosition((previous) => previous.collectionKey === collectionKey ? previous : { collectionKey, index: 0 });
        if (!canOpen) setIsGalleryOpen(false);
    }, [canOpen, collectionKey]);

    useEffect(() => {
        if (!isViewerVisible) return;
        const opener = openerRef.current;
        const scrollY = window.scrollY;
        const { style } = document.body;
        const previous = { overflow: style.overflow, position: style.position, top: style.top, left: style.left, right: style.right, width: style.width };
        Object.assign(style, { overflow: "hidden", position: "fixed", top: `-${scrollY}px`, left: "0", right: "0", width: "100%" });
        closeButtonRef.current?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsGalleryOpen(false);
            if (event.key !== "Tab") return;

            const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ) ?? []).filter((element) => element.tabIndex >= 0 && element.getAttribute("aria-disabled") !== "true");
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            Object.assign(style, previous);
            window.removeEventListener("keydown", onKeyDown);
            window.scrollTo(0, scrollY);
            opener?.focus({ preventScroll: true });
            if (document.activeElement !== opener) previewRef.current?.el.focus({ preventScroll: true });
        };
    }, [isViewerVisible]);

    useEffect(() => {
        if (isViewerVisible) activeThumbRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }, [activeIndex, collectionKey, isViewerVisible]);

    const selectImage = (index: number) => {
        setPosition((previous) => previous.collectionKey === collectionKey && previous.index === index
            ? previous
            : { collectionKey, index });
    };
    const openGallery = (index: number, opener: HTMLElement) => {
        if (!canOpen) return;
        openerRef.current = opener;
        selectImage(index);
        previewRef.current?.slideTo(index, 0);
        setIsGalleryOpen(true);
    };

    const caption = `${faNum(activeIndex + 1)} / ${faNum(photos.length)}`;
    // گارد SEO: برندِ populate‌نشده (ObjectId خام ۲۴-هگز) هرگز وارد alt نمی‌شود
    const brandSuffix = brandAltSuffix(product.brand);
    const imageAlt = (index: number) => index === 0
        ? `خرید ${product.name}${brandSuffix}`
        : `${product.name} - نمای ${faNum(index + 1)}`;
    const showCampaignBadge = product.campaignLabel && promotion.kind !== "none"
        && (!isFlashDealLabel(product.campaignLabel) || promotion.isFlashDealActive);

    const renderThumbnails = (inViewer: boolean) => photos.map((photo, index) => (
        <button
            key={index}
            ref={inViewer && activeIndex === index ? activeThumbRef : undefined}
            type="button"
            aria-label={`نمایش تصویر ${faNum(index + 1)}`}
            aria-pressed={activeIndex === index}
            onClick={() => {
                if (inViewer) {
                    viewerRef.current?.slideTo(index);
                } else {
                    selectImage(index);
                    previewRef.current?.slideTo(index);
                }
            }}
            className={inViewer
                ? "product-gallery-dialog__thumb"
                : `relative w-14 h-14 lg:w-16 lg:h-16 rounded-lg overflow-hidden border flex-shrink-0 transition-colors bg-white ${activeIndex === index ? "border-kala-500" : "border-gray-200 hover:border-gray-400"}`}
        >
            <ResilientImage
                src={thumbnails[index]}
                backupSrc={photo}
                alt=""
                fill
                wrapperClassName="absolute inset-0"
                className={inViewer ? "object-cover" : "object-contain !p-1"}
                sizes={inViewer ? "64px" : "(min-width: 1024px) 64px, 56px"}
                loading="lazy"
            />
        </button>
    ));

    // The preview is in the server HTML. Only the open viewer is portalled.
    return (
        <>
            <div className="product-gallery w-full max-w-full min-w-0 bg-white flex flex-col min-h-0">
                <div className="product-gallery__stage relative w-full max-w-full aspect-square max-h-[420px] lg:max-h-[460px] min-h-0 min-w-0 overflow-hidden bg-white" data-multiple={multiple} style={galleryStageStyle}>
                    <Swiper
                        key={collectionKey}
                        initialSlide={activeIndex}
                        spaceBetween={10}
                        slidesPerView="auto"
                        slidesOffsetAfter={multiple ? previewWidth : 0}
                        breakpoints={galleryBreakpoints}
                        allowTouchMove={multiple}
                        pagination={multiple ? { clickable: true } : false}
                        modules={[Pagination]}
                        onSwiper={(swiper) => { previewRef.current = swiper; }}
                        onSlideChange={(swiper) => selectImage(swiper.activeIndex)}
                        onClick={(swiper) => openGallery(swiper.clickedIndex ?? swiper.activeIndex, swiper.el)}
                        role={canOpen ? "button" : undefined}
                        tabIndex={canOpen ? 0 : undefined}
                        aria-label={canOpen ? "باز کردن گالری تصاویر محصول" : undefined}
                        onKeyDown={(event) => {
                            if (!canOpen || event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openGallery(activeIndex, event.currentTarget);
                            } else if (multiple && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
                                event.preventDefault();
                                if (event.key === "ArrowRight") previewRef.current?.slideNext();
                                else previewRef.current?.slidePrev();
                            }
                        }}
                        className={`!w-full !h-full !max-w-full [&_.swiper-slide]:!h-full [&_.swiper-wrapper]:!max-w-full [&_.swiper-pagination]:!bottom-1 lg:[&_.swiper-pagination]:hidden ${canOpen ? "cursor-zoom-in" : ""}`}
                    >
                        {photos.map((photo, index) => (
                            <SwiperSlide key={index} className="product-gallery__slide !h-full">
                                <div className="product-gallery__photo relative w-full h-full min-h-0 min-w-0 overflow-hidden">
                                    <ResilientImage
                                        src={photo}
                                        backupSrc={thumbnails[index]}
                                        alt={imageAlt(index)}
                                        fill
                                        wrapperClassName="absolute inset-0"
                                        className="product-gallery__image object-contain object-center"
                                        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 45vw"
                                        fetchPriority={index === 0 ? "high" : "auto"}
                                        loading={index === activeIndex ? "eager" : "lazy"}
                                    />
                                    {showCampaignBadge && index === 0 && (
                                        <div className="product-gallery__campaign absolute top-4 left-4 z-20">
                                            <span className={`text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg ${promotionPillClass(promotion.kind, product.campaignTheme)}`}>
                                                {product.campaignLabel}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                    {canOpen && (
                        <button
                            type="button"
                            className="product-gallery__counter"
                            onClick={(event) => openGallery(activeIndex, event.currentTarget)}
                            aria-label={multiple ? `گالری تصاویر، تصویر ${faNum(activeIndex + 1)} از ${faNum(photos.length)}` : "بزرگ‌نمایی عکس محصول"}
                        >
                            {multiple ? <Images size={15} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />}
                            {multiple && <bdi aria-hidden="true">{caption}</bdi>}
                        </button>
                    )}
                </div>
                {canOpen && (
                    <div className="product-gallery__thumbnails shrink-0 min-w-0 flex gap-2 px-2 overflow-x-auto no-scrollbar pt-3 pb-3 justify-start bg-white">
                        {renderThumbnails(false)}
                    </div>
                )}
            </div>

            {isViewerVisible && createPortal(
                <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="گالری تصاویر محصول" className="product-gallery-dialog" dir="rtl">
                    <button ref={closeButtonRef} type="button" aria-label="بستن گالری تصاویر" className="product-gallery-dialog__close" onClick={() => setIsGalleryOpen(false)}>
                        <X size={24} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="تغییر بزرگ‌نمایی تصویر" className="product-gallery-dialog__zoom-button" onClick={() => viewerRef.current?.zoom.toggle()}>
                        <ZoomIn size={21} aria-hidden="true" />
                    </button>
                    {multiple && <output className="product-gallery-dialog__count"><bdi>{caption}</bdi></output>}
                    <div className="product-gallery-dialog__stage">
                        <Swiper
                            key={collectionKey}
                            initialSlide={activeIndex}
                            spaceBetween={20}
                            zoom
                            navigation={multiple}
                            pagination={multiple ? { clickable: true } : false}
                            a11y={{ prevSlideMessage: "تصویر قبلی", nextSlideMessage: "تصویر بعدی", paginationBulletMessage: "رفتن به تصویر {{index}}" }}
                            modules={[A11y, Navigation, Pagination, Zoom]}
                            onSwiper={(swiper) => { viewerRef.current = swiper; }}
                            onSlideChange={(swiper) => {
                                selectImage(swiper.activeIndex);
                                previewRef.current?.slideTo(swiper.activeIndex, 0);
                            }}
                        >
                            {photos.map((photo, index) => (
                                <SwiperSlide key={index} className="!h-full">
                                    <div className="swiper-zoom-container product-gallery-dialog__zoom">
                                        <ResilientImage
                                            src={photo}
                                            backupSrc={thumbnails[index]}
                                            alt={imageAlt(index)}
                                            fill
                                            wrapperClassName="absolute inset-0"
                                            className="object-contain"
                                            sizes="100vw"
                                            loading={index === activeIndex ? "eager" : "lazy"}
                                        />
                                    </div>
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                    {multiple && (
                        <div className="product-gallery-dialog__thumbnails">
                            <div className="product-gallery-dialog__thumbnail-track">{renderThumbnails(true)}</div>
                        </div>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}
