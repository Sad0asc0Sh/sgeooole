"use client";

import React, { memo, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/services/productService";
import { buildProductUrl } from "@/lib/paths";
import { getBlurDataURL } from "@/lib/blurPlaceholder";

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
    now = Date.now(),
}: OptimizedProductCardProps) {
    // Memoize computed values
    const computedValues = useMemo(() => {
        const isFlashActive = Boolean(
            product.isFlashDeal &&
            product.flashDealEndTime &&
            new Date(product.flashDealEndTime).getTime() > now
        );

        const isSpecialActive = Boolean(
            product.isSpecialOffer &&
            product.specialOfferEndTime &&
            new Date(product.specialOfferEndTime).getTime() > now
        );

        const effectiveDiscount = product.discount > 0 && (isFlashActive || isSpecialActive)
            ? product.discount
            : 0;

        const displayPrice = (!isSpecialActive && !isFlashActive && product.oldPrice)
            ? product.oldPrice
            : product.price;

        const isOutOfStock = product.countInStock === 0;

        return {
            isFlashActive,
            isSpecialActive,
            effectiveDiscount,
            displayPrice,
            isOutOfStock,
        };
    }, [product, now]);

    const { effectiveDiscount, displayPrice, isOutOfStock, isFlashActive, isSpecialActive } = computedValues;

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
                <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
                    <Image
                        src={product.image || "/placeholder.png"}
                        alt={product.name}
                        fill
                        className={`object-contain p-2 group-hover:scale-105 transition-transform duration-300 ${isOutOfStock ? "grayscale opacity-60" : ""
                            }`}
                        sizes="148px"
                        loading={priority ? "eager" : "lazy"}
                        priority={priority}
                        quality={75}
                        placeholder="blur"
                        blurDataURL={getBlurDataURL()}
                    />

                    {/* Campaign Badge */}
                    {product.campaignLabel && (
                        <div className="absolute top-2 left-2 z-20">
                            <span
                                className={`text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm ${product.campaignTheme === "gold-red"
                                        ? "bg-gradient-to-r from-yellow-400 to-red-600"
                                        : product.campaignTheme === "red-purple"
                                            ? "bg-gradient-to-r from-rose-500 to-purple-700"
                                            : "bg-gradient-to-r from-lime-500 to-orange-400"
                                    }`}
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
                    {/* Discount Row */}
                    <div className="flex items-center justify-between h-5">
                        {!isOutOfStock && effectiveDiscount > 0 && (isFlashActive || isSpecialActive) ? (
                            <>
                                <div className={`${themeClasses.badge} text-[11px] font-bold px-2 py-0.5 rounded-full`}>
                                    {effectiveDiscount.toLocaleString("fa-IR")}٪
                                </div>
                                <span className="text-[11px] text-gray-400 line-through">
                                    {(product.compareAtPrice || product.oldPrice || product.price).toLocaleString("fa-IR")}
                                </span>
                            </>
                        ) : (
                            <div className="h-5" />
                        )}
                    </div>

                    {/* Price Row */}
                    <div className={`flex items-center justify-end gap-1 ${isOutOfStock ? "text-gray-400" : themeClasses.price}`}>
                        <span className="text-[15px] font-black tracking-tight">
                            {displayPrice.toLocaleString("fa-IR")}
                        </span>
                        <span className={`text-[10px] font-medium ${isOutOfStock ? "text-gray-400" : "text-gray-600"}`}>
                            تومان
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
});

export default OptimizedProductCard;
