"use client";

import React, { memo, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import ResilientImage from "@/components/ui/ResilientImage";
import Link from "next/link";
import { Product } from "@/services/productService";
import { buildProductUrl } from "@/lib/paths";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { resolveCardPricing } from "@/lib/promotions/variantCardPricing";
import { campaignPillClass } from "@/lib/campaignTheme";
import { getServerNow } from "@/lib/serverClock";
import imageStyles from "./ProductImageFrame.module.css";

interface OptimizedProductCardProps {
    product: Product;
    variant?: "default" | "flash" | "special";
    priority?: boolean;
    now?: number;
}

/**
 * Optimized Product Card Component
 * - Uses React.memo to prevent unnecessary re-renders
 * - Uses useMemo for computed values
 * - Optimized image loading with blur placeholder
 * - Minimal DOM operations
 */
const OptimizedProductCard = memo(function OptimizedProductCard({
    product,
    variant = "default",
    priority = false,
    now = getServerNow(),
}: OptimizedProductCardProps) {
    // Single price/promotion source: the shared resolver (server-corrected clock).
    // No duplicated timer/discount math here — expired snapshots restore the base
    // price and a stale compareAtPrice can never inflate it.
    const computedValues = useMemo(() => {
        const context = variant === "flash" || variant === "special" ? "promo" : "listing";
        const pricing = resolveCardPricing(product, { now, context });

        const isOutOfStock = product.countInStock === 0;
        const isLowStock = product.countInStock > 0 && product.countInStock <= 3;

        return {
            hasPromotion: pricing.kind !== "none",
            effectiveDiscount: pricing.discountPercent,
            displayPrice: pricing.displayPrice,
            originalPrice: pricing.originalPrice,
            isFrom: pricing.isFrom,
            isPartial: pricing.isPartial,
            isOutOfStock,
            isLowStock,
        };
    }, [product, now, variant]);

    const { hasPromotion, effectiveDiscount, displayPrice, originalPrice, isFrom, isPartial, isOutOfStock, isLowStock } = computedValues;

    // Theme colors based on variant
    const themeClasses = useMemo(() => {
        switch (variant) {
            case "flash":
                return {
                    card: "bg-gray-800/70 border-amber-500/30 hover:border-amber-400",
                    title: "text-gray-200 group-hover:text-amber-200",
                    price: "text-amber-400",
                    badge: "bg-amber-400 text-amber-950",
                };
            case "special":
                return {
                    card: "bg-white border-gray-100 hover:border-gray-200",
                    title: "text-gray-700",
                    price: "text-gray-800",
                    badge: "bg-[#ef394e] text-white",
                };
            default:
                return {
                    card: "bg-white border-gray-100 hover:border-gray-200",
                    title: "text-gray-700",
                    price: "text-gray-800",
                    badge: "bg-[#ef394e] text-white",
                };
        }
    }, [variant]);

    return (
        <Link href={buildProductUrl(product)} className="block h-full" prefetch={false}>
            <div
                className={`
          ${themeClasses.card}
          border rounded-lg h-full flex flex-col justify-between
          cursor-pointer transition-all duration-200
          relative overflow-hidden group p-3
        `}
            >
                {/* Product Image */}
                <div className={`${imageStyles.frame} mb-3 rounded-md`}>
                    <ResilientImage
                        src={product.image || "/placeholder.png"}
                        alt={product.name}
                        fill
                        className={`${imageStyles.image} group-hover:scale-105 transition-transform duration-300 ${isOutOfStock ? "grayscale opacity-60" : ""
                            }`}
                        sizes="148px"
                        loading={priority ? "eager" : "lazy"}
                        priority={priority}
                        quality={75}
                        placeholder="blur"
                        blurDataURL={getBlurDataURL()}
                        fallbackSrc="/placeholder.png"
                    />

                    {/* Campaign Badge */}
                    {product.campaignLabel && hasPromotion && (
                        <div className="absolute top-2 left-2 z-20">
                            <span
                                className={`text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm ${campaignPillClass(product.campaignTheme)}`}
                            >
                                {product.campaignLabel}
                            </span>
                        </div>
                    )}

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                        <div className="absolute inset-0 bg-white/40 z-10 flex items-center justify-center">
                            <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                                ناموجود
                            </span>
                        </div>
                    )}

                    {/* Low Stock Badge */}
                    {isLowStock && (
                        <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md">
                            <AlertTriangle size={12} />
                            <span>تنها {product.countInStock} عدد</span>
                        </div>
                    )}
                </div>

                {/* Product Name */}
                <h3
                    className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${isOutOfStock ? "text-gray-400" : themeClasses.title
                        } transition-colors`}
                >
                    {product.name}
                </h3>

                {/* Price Section */}
                <div className="flex flex-col gap-1 mt-auto">
                    {/* Discount Row (fixed h-5 keeps rail alignment) */}
                    <div className="flex items-center justify-between h-5">
                        {!isOutOfStock && originalPrice !== undefined ? (
                            <>
                                <div className={`${themeClasses.badge} text-[11px] font-bold px-2 py-0.5 rounded-full`}>
                                    {effectiveDiscount.toLocaleString("fa-IR")}٪
                                </div>
                                <span className="text-[11px] text-gray-400 line-through">
                                    {originalPrice.toLocaleString("fa-IR")}
                                </span>
                            </>
                        ) : !isOutOfStock && isPartial ? (
                            <span className="text-[10px] text-gray-500">تخفیف روی چند مدل</span>
                        ) : (
                            <div className="h-5" />
                        )}
                    </div>

                    {/* Price Row */}
                    <div
                        className={`flex items-center justify-end gap-1 ${isOutOfStock ? "text-gray-400" : themeClasses.price}`}
                        aria-label={isFrom && !isOutOfStock ? `شروع از ${displayPrice.toLocaleString("fa-IR")} تومان` : `${displayPrice.toLocaleString("fa-IR")} تومان`}
                    >
                        {!isOutOfStock && isFrom && <span className="text-[10px] text-gray-500 ml-1">از</span>}
                        <span className="text-[15px] font-black tracking-tight">
                            {displayPrice.toLocaleString("fa-IR")}
                        </span>
                        <span className={`text-[10px] font-medium ${isOutOfStock ? "text-gray-400" : "text-gray-600"}`}>
                            تومان
                        </span>
                    </div>
                    {isPartial && originalPrice !== undefined && !isOutOfStock && (
                        <span className="text-[10px] text-gray-500">تخفیف روی چند مدل</span>
                    )}
                </div>
            </div>
        </Link>
    );
});

export default OptimizedProductCard;
