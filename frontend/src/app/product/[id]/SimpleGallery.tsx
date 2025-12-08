"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "@/services/productService";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { isFlashDealLabel } from "@/lib/flashDealUtils";

type SimpleGalleryProps = {
    product: Product;
};

/**
 * Simple Product Gallery (Fallback without Swiper)
 * Use this if Swiper causes issues
 */
export default function SimpleGallery({ product }: SimpleGalleryProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [now, setNow] = useState(() => Date.now());

    // Ensure images array exists and has at least one image
    const images = product.images && product.images.length > 0 ? product.images : [product.image];
    const hasMultipleImages = images.length > 1;

    const isFlashDealActive = Boolean(
        product.isFlashDeal &&
        product.flashDealEndTime &&
        new Date(product.flashDealEndTime).getTime() > now
    );

    const showCampaignBadge = Boolean(
        product.campaignLabel &&
        !(isFlashDealLabel(product.campaignLabel) && !isFlashDealActive)
    );

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const handlePrev = () => {
        setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    console.log('[SIMPLE GALLERY] Images:', images);
    console.log('[SIMPLE GALLERY] Images count:', images.length);
    console.log('[SIMPLE GALLERY] Active index:', activeIndex);

    return (
        <div className="relative bg-gray-50 w-full pb-10">
            {/* Main Image */}
            <div className="relative h-[380px] w-full bg-white flex items-center justify-center">
                <Image
                    src={images[activeIndex]}
                    alt={`${product.title} - ${activeIndex + 1}`}
                    fill
                    className="object-contain p-8"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={activeIndex === 0}
                    quality={85}
                    placeholder="blur"
                    blurDataURL={getBlurDataURL()}
                />

                {/* Navigation Arrows */}
                {hasMultipleImages && (
                    <>
                        <button
                            onClick={handlePrev}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg transition-all"
                            aria-label="تصویر قبلی"
                        >
                            <ChevronRight size={24} className="text-gray-700" />
                        </button>
                        <button
                            onClick={handleNext}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg transition-all"
                            aria-label="تصویر بعدی"
                        >
                            <ChevronLeft size={24} className="text-gray-700" />
                        </button>
                    </>
                )}

                {/* Pagination Dots */}
                {hasMultipleImages && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                        {images.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveIndex(index)}
                                className={`w-2 h-2 rounded-full transition-all ${
                                    index === activeIndex
                                        ? 'bg-green-500 w-6'
                                        : 'bg-gray-300 hover:bg-gray-400'
                                }`}
                                aria-label={`تصویر ${index + 1}`}
                            />
                        ))}
                    </div>
                )}

                {/* Campaign Badge */}
                {showCampaignBadge && (
                    <div className="absolute top-4 left-4 z-20">
                        <span className={`text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${
                            product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold'
                                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                : product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red'
                                ? 'bg-gradient-to-r from-rose-500 to-purple-700'
                                : product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' || product.campaignTheme === 'green-orange'
                                ? 'bg-gradient-to-r from-lime-400 to-green-500'
                                : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                        }`}>
                            {product.campaignLabel}
                        </span>
                    </div>
                )}
            </div>

            {/* Thumbnails - Always show even with single image */}
            {images.length > 0 && (
                <div className="flex gap-3 px-4 overflow-x-auto mt-4 pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {images.map((img, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveIndex(index)}
                            className={`relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                                index === activeIndex
                                    ? 'border-green-500 shadow-md scale-105'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                            type="button"
                            aria-label={`انتخاب تصویر ${index + 1}`}
                        >
                            <Image
                                src={img}
                                alt={`Thumbnail ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="64px"
                                quality={75}
                                placeholder="blur"
                                blurDataURL={getBlurDataURL()}
                            />
                        </button>
                    ))}
                </div>
            )}

            {/* Debug Info */}
            <div className="mt-2 px-4 text-xs text-gray-400">
                تصویر {activeIndex + 1} از {images.length}
            </div>
        </div>
    );
}
