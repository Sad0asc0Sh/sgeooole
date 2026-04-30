"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Star, ShieldCheck, Store, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Product, ProductColor } from "@/services/productService";
import CountdownTimer from "@/components/ui/CountdownTimer";
import ProductTabs from "@/components/product/ProductTabs";
import ProductHeader from "./ProductHeader";
import ProductGallery from "./ProductGallery";
import ColorSelector from "./ColorSelector";
import ProductActions from "./ProductActions";
import ProductHistoryTracker from "./ProductHistoryTracker";
import ProductSocialActions from "./ProductSocialActions";

type ProductDetailClientProps = {
    product: Product;
};

export default function ProductDetailClient({ product: initialProduct }: ProductDetailClientProps) {
    const [product, setProduct] = useState<Product>(initialProduct);
    const [selectedColor, setSelectedColor] = useState<ProductColor | null>(
        product.colors && product.colors.length > 0 ? product.colors[0] : null
    );

    // Sync state only when product ID changes (route transitions)
    useEffect(() => {
        if (initialProduct.id !== product.id) {
            setProduct(initialProduct);
            // Reset color selection for new product
            if (initialProduct.colors && initialProduct.colors.length > 0) {
                setSelectedColor(initialProduct.colors[0]);
            } else {
                setSelectedColor(null);
            }
        }
    }, [initialProduct.id, product.id, initialProduct.colors]);

    // Memoize flash deal status
    const isFlashDealActive = useMemo(() => 
        Boolean(
            product.isFlashDeal &&
            product.flashDealEndTime &&
            new Date(product.flashDealEndTime).getTime() > Date.now()
        ),
        [product.isFlashDeal, product.flashDealEndTime]
    );

    const showCampaignBadge = useMemo(() => 
        Boolean(
            product.campaignLabel &&
            !(product.campaignLabel.includes('فلش') && !isFlashDealActive)
        ),
        [product.campaignLabel, isFlashDealActive]
    );

    // Memoize color change handler
    const handleColorChange = useCallback((color: ProductColor) => {
        setSelectedColor(color);
    }, []);

    return (
        <div className="min-h-screen bg-white pb-24 pt-14 md:pt-0">
            {/* Track product view */}
            <ProductHistoryTracker product={product} />

            {/* Header (Transparent/Floating) - Only show on mobile */}
            <div className="lg:hidden">
                <ProductHeader product={product} />
            </div>


            {/* Desktop Two-Column Layout - With proper header clearance */}
            <div className="hidden lg:block max-w-7xl mx-auto px-6 pb-8 pt-8">
                <div className="flex flex-row-reverse gap-10 min-w-0">
                    {/* Right Column - Gallery + Breadcrumb + Title (all sticky together) */}
                    <div className="w-[45%] max-w-[45%] min-w-0 flex-shrink self-start sticky top-36 will-change-transform flex flex-col max-h-[calc(100vh-theme(spacing.36)-2rem)]">
                        <ProductGallery product={product} />

                        {/* Breadcrumb - Below Gallery */}
                        <div className="shrink-0 space-y-1.5 mt-5">
                            {product.categoryPath && product.categoryPath.length > 0 && (
                                <div className="flex items-center gap-1 text-sm font-medium text-gray-500 flex-wrap">
                                    <Link
                                        href="/"
                                        className="text-kala-600 hover:underline hover:text-kala-700 transition-colors"
                                    >
                                        ای‌کا‌جی کالا
                                    </Link>
                                    {product.categoryPath.map((cat, index) => (
                                        <span key={cat.id} className="flex items-center">
                                            <span className="mx-1 text-gray-400">&lt;</span>
                                            <Link
                                                href={`/products?category=${cat.slug}${index < product.categoryPath!.length - 1 ? '&includeChildren=true' : ''}`}
                                                className={`hover:underline transition-colors ${index === product.categoryPath!.length - 1
                                                    ? 'text-red-500 hover:text-red-600'
                                                    : 'text-gray-600 hover:text-kala-700'
                                                    }`}
                                            >
                                                {cat.name}
                                            </Link>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {product.brand && product.categoryPath && product.categoryPath.length > 0 && (
                                <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
                                    <Link
                                        href={`/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`}
                                        className="text-gray-600 hover:underline hover:text-kala-700 transition-colors"
                                    >
                                        {product.brand}
                                    </Link>
                                    <span className="mx-1 text-gray-400">&lt;</span>
                                    <span className="text-gray-700 font-semibold">
                                        {product.categoryPath[product.categoryPath.length - 1].name} {product.brand}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Title - Below Breadcrumb */}
                        <div className="shrink-0 mt-4">
                            <h1 className="text-xl font-bold text-gray-900 leading-snug mb-1">{product.title}</h1>
                            {product.enTitle && (
                                <span className="text-sm text-gray-400 font-mono">{product.enTitle}</span>
                            )}
                        </div>
                    </div>

                    {/* Left Column - Product Info */}
                    <div className="flex-1 min-w-0">

                        {/* Rating Section */}
                        {product.rating > 0 && (
                            <div className="flex items-center gap-2 mb-4">
                                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-base font-bold text-gray-800">{product.rating}</span>
                                <span className="text-sm text-gray-400">
                                    ({product.reviewCount} {product.reviewCount === 0 ? "" : "دیدگاه"})
                                </span>
                            </div>
                        )}

                        {/* Timer for Special Offers */}
                        {(() => {
                            const now = Date.now();
                            const flashEndTs = product.flashDealEndTime ? Date.parse(product.flashDealEndTime) : NaN;
                            const specialEndTs = product.specialOfferEndTime ? Date.parse(product.specialOfferEndTime) : NaN;

                            const flashActive = Boolean(product.isFlashDeal && Number.isFinite(flashEndTs) && flashEndTs > now);
                            const specialActive = Boolean(product.isSpecialOffer && Number.isFinite(specialEndTs) && specialEndTs > now);

                            const endTime = flashActive
                                ? product.flashDealEndTime
                                : specialActive
                                    ? product.specialOfferEndTime
                                    : undefined;

                            if (!endTime) return null;

                            const theme = product.campaignTheme;
                            let themeClass = 'bg-red-50 text-red-600';

                            if (theme === 'gold-red' || theme === 'gold') {
                                themeClass = 'bg-amber-50 text-amber-700';
                            } else if (theme === 'red-purple' || theme === 'fire' || theme === 'red') {
                                themeClass = 'bg-rose-50 text-rose-700';
                            } else if (theme === 'lime-orange' || theme === 'lime' || theme === 'green-orange') {
                                themeClass = 'bg-lime-50 text-lime-700';
                            } else if (theme) {
                                themeClass = 'bg-blue-50 text-blue-700';
                            }

                            let label = product.campaignLabel;
                            if (!label) {
                                if (product.isSpecialOffer) {
                                    label = 'پیشنهاد شگفت‌انگیز';
                                } else if (product.isFlashDeal) {
                                    label = 'پیشنهاد لحظه‌ای';
                                } else {
                                    label = 'فروش ویژه';
                                }
                            }

                            if (!product.campaignLabel) {
                                if (flashActive) label = 'پیشنهاد لحظه‌ای';
                                else if (specialActive) label = 'پیشنهاد شگفت‌انگیز';
                            }

                            return (
                                <div className="mb-6">
                                    <div className={`p-4 rounded-xl flex items-center justify-between ${themeClass}`}>
                                        <span className="text-base font-bold flex items-center gap-2">
                                            <Store size={18} />
                                            {label}
                                        </span>
                                        <div className="flex items-center gap-2" dir="ltr">
                                            <CountdownTimer
                                                targetDate={endTime}
                                                className="text-base font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Wishlist & Share Actions */}
                        <ProductSocialActions product={product} />

                        <hr className="border-gray-100 my-6" />

                        {/* Color Selector */}
                        <ColorSelector
                            colors={product.colors || []}
                            selectedColor={selectedColor}
                            onColorChange={setSelectedColor}
                        />

                        {/* Features (Stock, Brand) */}
                        <div className="bg-gray-50 rounded-xl p-5 space-y-4 mb-6">
                            {product.brand && (
                                <>
                                    <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <ShieldCheck size={20} className="text-gray-400" />
                                        <span>برند: {product.brand}</span>
                                    </div>
                                    <div className="h-px bg-gray-200 w-full" />
                                </>
                            )}
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Store size={20} className={product.countInStock > 0 ? "text-kala-500" : "text-red-500"} />
                                <span>
                                    {product.countInStock > 0 ? "موجود در انبار" : "ناموجود"}
                                </span>
                            </div>
                        </div>

                        {/* Low Stock Warning */}
                        {product.countInStock > 0 && product.countInStock <= 3 && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-pulse">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <AlertTriangle size={22} className="text-amber-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base font-bold text-amber-800">
                                        تنها {product.countInStock} عدد باقی مانده!
                                    </span>
                                    <span className="text-sm text-amber-600">
                                        قبل از اتمام موجودی اقدام کنید
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Desktop Price & Add to Cart Box */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
                            <ProductActions product={product} selectedColor={selectedColor} isDesktop={true} />
                        </div>

                        {/* Product Tabs */}
                        <ProductTabs product={product} />
                    </div>
                </div>
            </div>

            {/* Mobile Layout - Unchanged */}
            <div className="lg:hidden">
                {/* Gallery Slider - Compact */}
                <ProductGallery product={product} />

                {/* Info Section - Seamless connection with gallery */}
                <div className="px-4 py-2 relative bg-white z-10">

                    {/* === Digikala-style Category Navigation === */}

                    {/* Row 1: Full Category Path (EkgKala > Main Category > Subcategory) */}
                    <div className="space-y-1.5 mb-2">
                        {product.categoryPath && product.categoryPath.length > 0 && (
                            <div className="flex items-center gap-1 text-xs font-medium text-gray-500 flex-wrap">
                                {/* Site Name as first breadcrumb item */}
                                <Link
                                    href="/"
                                    className="text-kala-600 hover:underline hover:text-kala-700 transition-colors"
                                >
                                    ای‌کا‌جی کالا
                                </Link>
                                {product.categoryPath.map((cat, index) => (
                                    <span key={cat.id} className="flex items-center">
                                        <span className="mx-1 text-gray-400">&lt;</span>
                                        <Link
                                            href={`/products?category=${cat.slug}${index < product.categoryPath!.length - 1 ? '&includeChildren=true' : ''}`}
                                            className={`hover:underline transition-colors ${index === product.categoryPath!.length - 1
                                                ? 'text-red-500 hover:text-red-600'
                                                : 'text-gray-600 hover:text-kala-700'
                                                }`}
                                        >
                                            {cat.name}
                                        </Link>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Row 2: Brand + Product's Last Category */}
                        {product.brand && product.categoryPath && product.categoryPath.length > 0 && (
                            <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                                <Link
                                    href={`/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`}
                                    className="text-gray-600 hover:underline hover:text-kala-700 transition-colors"
                                >
                                    {product.brand}
                                </Link>
                                <span className="mx-1 text-gray-400">&lt;</span>
                                <span className="text-gray-700 font-semibold">
                                    {/* Product type in this category */}
                                    {product.categoryPath[product.categoryPath.length - 1].name} {product.brand}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Title & Rating */}
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-col">
                            <h1 className="text-base font-bold text-gray-900 leading-snug">{product.title}</h1>
                            {product.enTitle && (
                                <span className="text-xs text-gray-400 font-mono mt-1">{product.enTitle}</span>
                            )}
                        </div>
                    </div>

                    {/* Timer for Special Offers / Flash Deals / Campaign Offers */}
                    {(() => {
                        // Helper logic for offer details - Priority: Campaign Label > Flash Deal > Special Offer
                        // Check if we have an active campaign or time-based offer
                        const now = Date.now();
                        const flashEndTs = product.flashDealEndTime ? Date.parse(product.flashDealEndTime) : NaN;
                        const specialEndTs = product.specialOfferEndTime ? Date.parse(product.specialOfferEndTime) : NaN;

                        const flashActive = Boolean(product.isFlashDeal && Number.isFinite(flashEndTs) && flashEndTs > now);
                        const specialActive = Boolean(product.isSpecialOffer && Number.isFinite(specialEndTs) && specialEndTs > now);

                        const endTime = flashActive
                            ? product.flashDealEndTime
                            : specialActive
                                ? product.specialOfferEndTime
                                : undefined;

                        if (!endTime) return null;

                        // Determine theme class based on campaignTheme
                        const theme = product.campaignTheme;
                        let themeClass = 'bg-red-50 text-red-600'; // Default for Special Offer

                        if (theme === 'gold-red' || theme === 'gold') {
                            themeClass = 'bg-amber-50 text-amber-700';
                        } else if (theme === 'red-purple' || theme === 'fire' || theme === 'red') {
                            themeClass = 'bg-rose-50 text-rose-700';
                        } else if (theme === 'lime-orange' || theme === 'lime' || theme === 'green-orange') {
                            themeClass = 'bg-lime-50 text-lime-700';
                        } else if (theme) {
                            themeClass = 'bg-blue-50 text-blue-700';
                        }

                        // Determine label - Use campaignLabel if available, otherwise use defaults
                        let label = product.campaignLabel;
                        if (!label) {
                            if (product.isSpecialOffer) {
                                label = 'پیشنهاد شگفت‌انگیز';
                            } else if (product.isFlashDeal) {
                                label = 'پیشنهاد لحظه‌ای';
                            } else {
                                label = 'فروش ویژه';
                            }
                        }

                        if (!product.campaignLabel) {
                            if (flashActive) label = 'پیشنهاد لحظه‌ای';
                            else if (specialActive) label = 'پیشنهاد شگفت‌انگیز';
                        }

                        return (
                            <div className="mb-4">
                                <div className={`p-3 rounded-xl flex items-center justify-between ${themeClass}`}>
                                    <span className="text-sm font-bold flex items-center gap-2">
                                        <Store size={16} />
                                        {label}
                                    </span>
                                    <div className="flex items-center gap-2" dir="ltr">
                                        <CountdownTimer
                                            targetDate={endTime}
                                            className="text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Rating Section */}
                    {product.rating > 0 && (
                        <div className="flex items-center gap-1 mb-4">
                            <Star size={14} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-bold text-gray-800">{product.rating}</span>
                            <span className="text-xs text-gray-400">
                                ({product.reviewCount} {product.reviewCount === 0 ? "" : "دیدگاه"})
                            </span>
                        </div>
                    )}

                    {/* Wishlist & Share Actions */}
                    <ProductSocialActions product={product} />

                    <hr className="border-gray-100 mb-6" />

                    {/* Color Selector (if colors available) */}
                    <ColorSelector
                        colors={product.colors || []}
                        selectedColor={selectedColor}
                        onColorChange={setSelectedColor}
                    />

                    {/* Features (Stock, Brand) */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
                        {product.brand && (
                            <>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <ShieldCheck size={18} className="text-gray-400" />
                                    <span>برند: {product.brand}</span>
                                </div>
                                <div className="h-px bg-gray-200 w-full" />
                            </>
                        )}
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <Store size={18} className={product.countInStock > 0 ? "text-kala-500" : "text-red-500"} />
                            <span>
                                {product.countInStock > 0 ? "موجود در انبار" : "ناموجود"}
                            </span>
                        </div>
                    </div>

                    {/* Low Stock Warning - Only show when stock is 1, 2, or 3 */}
                    {product.countInStock > 0 && product.countInStock <= 3 && (
                        <div className="mb-6 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-pulse">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <AlertTriangle size={20} className="text-amber-600" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-amber-800">
                                    تنها {product.countInStock} عدد باقی مانده!
                                </span>
                                <span className="text-xs text-amber-600">
                                    قبل از اتمام موجودی اقدام کنید
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Product Tabs (Description, Specs, Reviews) */}
                    <ProductTabs product={product} />

                </div>

                {/* Sticky Action Bar */}
                <ProductActions product={product} selectedColor={selectedColor} />
            </div>
        </div>
    );
}
