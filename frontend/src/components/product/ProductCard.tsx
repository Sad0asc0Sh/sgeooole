"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import { Heart, Star, AlertTriangle } from "lucide-react";

import { Product } from "@/services/productService";
import { useWishlist } from "@/hooks/useWishlist";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";
import {
    getNextPromotionExpiry,
} from "@/lib/promotions/productPromotion";
import { resolveCardPricing } from "@/lib/promotions/variantCardPricing";
import { campaignStripeClass } from "@/lib/campaignTheme";
import { getServerNow } from "@/lib/serverClock";
import styles from "./ProductCard.module.css";



interface ProductCardProps {
    product: Product;
    priority?: boolean;
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [isHovered, setIsHovered] = useState(false);
    const [, forcePromotionBoundaryRender] = useState(0);

    const isFavorite = isInWishlist(product.id);
    const isOutOfStock = product.countInStock <= 0;
    const pricing = resolveCardPricing(product, { now: getServerNow(), context: "listing" });
    const promotionKind = pricing.kind;
    const endTime = pricing.endTime;

    // ProductTimerBadge owns its second-by-second display. The card itself only
    // needs another render when the nearest promotion crosses its end boundary.
    useEffect(() => {
        const currentTime = getServerNow();
        const nextExpiry = getNextPromotionExpiry(product, currentTime);
        if (!nextExpiry) return;

        // Browser timers cannot represent delays greater than a signed 32-bit integer.
        const delay = Math.min(Math.max(0, nextExpiry - currentTime) + 50, 2_147_483_647);
        const id = window.setTimeout(
            () => forcePromotionBoundaryRender((version) => version + 1),
            delay,
        );

        return () => window.clearTimeout(id);
    }, [product]);

    const handleToggleWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(product);
    };

    // A single resolver gives the three promotion types a stable precedence.
    // Notably, a plain percentage can no longer create a "شگفت‌انگیز" label.
    let headerConfig = null;

    if (promotionKind === 'flash') {
        headerConfig = {
            type: 'flash',
            title: 'پیشنهاد لحظه‌ای',
            color: 'text-orange-600',
            borderColor: 'legacy-grad-timed bg-gradient-to-r from-amber-400 via-orange-500 to-red-600',
            endTime,
            iconColor: 'text-orange-600',
        };
    } else if (promotionKind === 'campaign') {
        // One shared resolver keeps the card stripe in lock-step with the
        // product-detail badges (lib/campaignTheme.ts is the single source).
        const { stripe: themeBorder, text: themeColor } = campaignStripeClass(product.campaignTheme);

        headerConfig = {
            type: 'campaign',
            title: product.campaignLabel || 'فروش ویژه',
            color: themeColor,
            borderColor: themeBorder,
            endTime,
            iconColor: themeColor,
        };
    } else if (promotionKind === 'amazing') {
        headerConfig = {
            type: 'amazing',
            title: 'شگفت‌انگیز',
            color: 'text-red-500',
            borderColor: 'bg-red-500',
            endTime,
            iconColor: 'text-red-500',
        };
    }

    return (
        <div
            className={`${styles.card} ${isOutOfStock ? styles.outOfStockCard : ""} group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full ${headerConfig ? 'pt-0' : 'pt-0'} ${isHovered ? 'shadow-md border-ekg-200' : 'shadow-sm border-ekg-100/80'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Special Header Line */}
            {headerConfig && (
                <div className="w-full">
                    {/* Colored Line */}
                    <div className={`h-1 w-full ${headerConfig.borderColor}`} />

                    {/* Header Content */}
                    <div className="flex items-center justify-between px-1 py-1 bg-white gap-1">
                        {/* Left: Timer - REMOVED (Moved to overlay) */}


                        {/* Right: Title */}
                        <div className={`text-[10px] font-bold whitespace-nowrap truncate ${headerConfig.color}`}>
                            {headerConfig.title}
                        </div>
                    </div>
                    {/* Separator */}
                    <div className="h-px w-full bg-gray-100" />
                </div>
            )}

            {/* Image Gallery Slider */}
            <div className={`${styles.imageFrame} relative aspect-square overflow-hidden`}>
                {/* Timer Overlay (Top Right) */}
                {(headerConfig?.endTime) && (
                    <ProductTimerBadge
                        targetDate={headerConfig.endTime}
                        color={headerConfig.color}
                    />
                )}

                <button
                    type="button"
                    onClick={handleToggleWishlist}
                    aria-label={isFavorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
                    className={`${styles.wishlistButton} ${isFavorite ? styles.wishlistButtonActive : ""} flex items-center justify-center transition-all`}
                >
                    <Heart size={18} className={isFavorite ? "fill-red-500 text-red-500" : "text-gray-500"} />
                </button>

                {/* Low Stock Badge (Bottom Left) */}
                {product.countInStock > 0 && product.countInStock <= 3 && (
                    <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md">
                        <AlertTriangle size={12} />
                        <span>تنها {product.countInStock} عدد</span>
                    </div>
                )}

                <Link href={buildProductUrl(product)} className="block w-full h-full">
                    {/* Static Image */}
                    <div className="relative w-full h-full">
                        <ResilientImage
                            src={product.image || "/placeholder.svg"}
                            alt={product.title}
                            fill
                            className={`${styles.productImage} ${isOutOfStock ? styles.outOfStockImage : ""} transition-transform duration-500 ${isOutOfStock ? "" : "group-hover:scale-105"}`}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 16vw"
                            loading={priority ? "eager" : "lazy"}
                            priority={priority}
                            fetchPriority={priority ? "high" : "auto"}
                            quality={75}
                            placeholder="blur"
                            blurDataURL={getBlurDataURL()}
                            fallbackSrc="/placeholder.svg"
                        />
                        {isOutOfStock && (
                            <div className={styles.outOfStockOverlay} aria-label="این کالا ناموجود است">
                                <span className={styles.outOfStockBadge}>ناموجود</span>
                            </div>
                        )}
                    </div>
                </Link>
            </div>

            {/* Content */}
            <div className={`${styles.content} p-4 flex flex-col flex-1 gap-2`}>
                {/* Category - only show if it's a valid category name */}
                {product.category &&
                    product.category !== "عمومی" &&
                    !/^[a-fA-F0-9]{24}$/.test(product.category) && (
                        <span className="text-[10px] text-gray-400 font-medium truncate">
                            {product.category}
                        </span>
                    )}

                {/* Title */}
                <Link href={buildProductUrl(product)} className="block">
                    <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2 min-h-[2.5em] hover:text-kala-600 transition-colors">
                        {product.title}
                    </h3>
                </Link>

                {/* Rating */}
                <div className="flex items-center gap-1 mt-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-bold text-gray-700">{product.rating || 0}</span>
                    <span className="text-[10px] text-gray-400">({product.reviewCount || 0})</span>
                </div>

                {isOutOfStock && (
                    <span className={styles.stockStatus}>فعلاً ناموجود</span>
                )}

                <div className={`${styles.footerRow} mt-auto`}>
                    <div className={`${styles.priceColumn} flex flex-col`}>
                        <div className={`${styles.oldPriceRow} flex items-center gap-1 mb-1 h-5`}>
                            {pricing.originalPrice && !isOutOfStock ? (
                                <>
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                        {pricing.discountPercent.toLocaleString("fa-IR")}٪
                                    </span>
                                    <span className={`${styles.oldPriceValue} text-[11px] text-gray-400 line-through decoration-red-500/50`}>
                                        {pricing.originalPrice.toLocaleString("fa-IR")}
                                    </span>
                                </>
                            ) : pricing.isPartial ? (
                                <span className="text-[10px] text-gray-500">تخفیف روی چند مدل</span>
                            ) : null}
                        </div>
                        <div className={`${styles.priceLine} ${isOutOfStock ? "text-gray-400" : ""}`} aria-label={pricing.isFrom ? `شروع از ${pricing.displayPrice.toLocaleString("fa-IR")} تومان` : `${pricing.displayPrice.toLocaleString("fa-IR")} تومان`}>
                            {pricing.isFrom && !isOutOfStock && <span className="text-[10px] text-gray-500 ml-1">از</span>}
                            <span className={`${styles.priceValue} text-base font-black ${isOutOfStock ? "text-gray-500" : "text-gray-900"}`}>
                                {pricing.displayPrice.toLocaleString("fa-IR")}
                            </span>
                            <span className={`${styles.priceCurrency} text-[10px] text-gray-500`}>تومان</span>
                        </div>
                        {pricing.isPartial && pricing.originalPrice && !isOutOfStock && (
                            <span className="text-[10px] text-gray-500">تخفیف روی چند مدل</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
