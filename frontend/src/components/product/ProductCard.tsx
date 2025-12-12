"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Star, AlertTriangle } from "lucide-react";

import { Product } from "@/services/productService";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";
import { isFlashDealLabel } from "@/lib/flashDealUtils";



interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    const { addToCart } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [isHovered, setIsHovered] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    const isFavorite = isInWishlist(product.id);
    const discountPercentage = product.discount || 0;

    // Check if flash deal countdown is still active
    const isFlashDealActive = Boolean(
        product.isFlashDeal &&
        product.flashDealEndTime &&
        new Date(product.flashDealEndTime).getTime() > now
    );

    const isSpecialOfferCountdownActive = Boolean(
        product.isSpecialOffer &&
        product.specialOfferEndTime &&
        new Date(product.specialOfferEndTime).getTime() > now
    );
    const hasFlashLabel = isFlashDealLabel(product.campaignLabel);

    // Effective discount: only apply if flash deal is active OR special offer is active
    const effectiveDiscount =
        product.discount > 0 &&
            (isFlashDealActive || (!product.isFlashDeal && (!product.isSpecialOffer || isSpecialOfferCountdownActive)))
            ? product.discount
            : 0;

    const showSpecialOfferPricing = effectiveDiscount > 0 && Boolean(product.oldPrice);

    // Price reversion: when flash deal or special offer expires, revert to original price
    const displayPrice =
        (!isFlashDealActive && product.isFlashDeal && product.oldPrice)
            ? product.oldPrice
            : (!isSpecialOfferCountdownActive && product.isSpecialOffer && product.oldPrice)
                ? product.oldPrice
                : product.price;

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart(product, 1);
    };

    const handleToggleWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(product);
    };

    // Determine Header Type - Only show flash header if countdown is active
    let headerConfig = null;
    const shouldShowCampaignHeader =
        (product.campaignLabel || product.campaignTheme) &&
        (!hasFlashLabel || isFlashDealActive);

    if (isFlashDealActive) {
        // Default Flash Deal Style (Amber)
        let themeColor = 'text-amber-500';
        let themeBorder = 'bg-amber-500';
        let themeTitle = 'پیشنهاد لحظه‌ای';

        // If Campaign Theme is present, override with Campaign Style
        if (product.campaignLabel || product.campaignTheme) {
            themeTitle = product.campaignLabel || 'پیشنهاد لحظه‌ای'; // Use label if present, else default

            if (product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold') {
                themeColor = 'text-amber-600';
                themeBorder = 'bg-gradient-to-r from-amber-400 to-orange-500';
            } else if (product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red') {
                themeColor = 'text-rose-600';
                themeBorder = 'bg-gradient-to-r from-rose-500 to-purple-700';
            } else if (product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime') {
                themeColor = 'text-lime-600';
                themeBorder = 'bg-gradient-to-r from-lime-400 to-green-500';
            } else {
                // Default Blue Campaign if theme is Blue or generic
                themeColor = 'text-blue-600';
                themeBorder = 'bg-gradient-to-r from-blue-400 to-indigo-500';
            }
        }

        headerConfig = {
            type: 'flash',
            title: themeTitle,
            color: themeColor,
            borderColor: themeBorder,
            endTime: product.flashDealEndTime,
            iconColor: themeColor
        };
    } else if (shouldShowCampaignHeader) {
        // Map campaign themes to colors
        let themeColor = 'text-blue-600';
        let themeBorder = 'bg-gradient-to-r from-blue-400 to-indigo-500';

        // Check for specific themes
        if (product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold') {
            themeColor = 'text-amber-600';
            themeBorder = 'bg-gradient-to-r from-amber-400 to-orange-500';
        } else if (product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red') {
            // Mapping 'fire' to the Pink/Purple gradient theme (as requested to match detail page badge)
            themeColor = 'text-rose-600';
            themeBorder = 'bg-gradient-to-r from-rose-500 to-purple-700';
        } else if (product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime') {
            themeColor = 'text-lime-600';
            themeBorder = 'bg-gradient-to-r from-lime-400 to-green-500';
        }

        headerConfig = {
            type: 'campaign',
            title: product.campaignLabel || 'فروش ویژه',
            color: themeColor,
            borderColor: themeBorder,
            // Use flashDealEndTime as fallback for campaign timer if available, otherwise no timer
            endTime: product.flashDealEndTime || product.specialOfferEndTime,
            iconColor: themeColor
        };
    } else if (
        (product.isSpecialOffer && isSpecialOfferCountdownActive) ||
        (!product.isFlashDeal && !product.isSpecialOffer && product.discount && product.discount > 0)
    ) {
        headerConfig = {
            type: 'amazing',
            title: 'شگفت‌انگیز',
            color: 'text-red-500',
            borderColor: 'bg-red-500',
            endTime: product.specialOfferEndTime,
            iconColor: 'text-red-500'
        };
    }

    const showSpecialOfferChrome =
        !(headerConfig?.type === 'amazing') ||
        isSpecialOfferCountdownActive ||
        !product.isSpecialOffer;

    return (
        <div
            className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full ${headerConfig ? 'pt-0' : 'pt-0'} ${isHovered ? 'shadow-lg border-gray-200' : 'border-gray-100'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Special Header Line */}
            {headerConfig && showSpecialOfferChrome && (
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
            <div className="relative aspect-square bg-gray-50 overflow-hidden">
                {/* Timer Overlay (Top Right) */}
                {(headerConfig?.endTime) && (
                    <ProductTimerBadge
                        targetDate={headerConfig.endTime}
                        color={headerConfig.color}
                    />
                )}

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
                        <Image
                            src={product.image || "/placeholder.svg"}
                            alt={product.title}
                            fill
                            className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            loading="lazy"
                            quality={75}
                            placeholder="blur"
                            blurDataURL={getBlurDataURL()}
                        />
                    </div>
                </Link>
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1 gap-2">
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
                    <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2 min-h-[2.5em] hover:text-vita-600 transition-colors">
                        {product.title}
                    </h3>
                </Link>

                {/* Rating */}
                <div className="flex items-center gap-1 mt-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-bold text-gray-700">{product.rating || 0}</span>
                    <span className="text-[10px] text-gray-400">({product.reviewCount || 0})</span>
                </div>

                <div className="mt-auto pt-3 flex items-end justify-between">
                    {/* Price */}
                    <div className="flex flex-col">
                        {product.oldPrice && showSpecialOfferPricing && (
                            <div className="flex items-center gap-1 mb-1">
                                {effectiveDiscount > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                        {effectiveDiscount}%
                                    </span>
                                )}
                                <span className="text-[11px] text-gray-400 line-through decoration-red-500/50">
                                    {product.oldPrice.toLocaleString("fa-IR")}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <span className="text-base font-black text-gray-900">
                                {displayPrice.toLocaleString("fa-IR")}
                            </span>
                            <span className="text-[10px] text-gray-500">تومان</span>
                        </div>
                    </div>

                    {/* Add to Wishlist Button (Replaces Cart) */}
                    <button
                        onClick={handleToggleWishlist}
                        className={`
              w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm
              ${isFavorite
                                ? "bg-red-50 text-red-500 border border-red-100"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }
            `}
                    >
                        <Heart size={18} className={isFavorite ? "fill-red-500" : ""} />
                    </button>
                </div>
            </div>
        </div>
    );
}
