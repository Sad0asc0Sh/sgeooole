"use client";
import { useState, useEffect } from "react";
import { Star, ShieldCheck, Store, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Product, ProductColor } from "@/services/productService";
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

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
    const [selectedColor, setSelectedColor] = useState<ProductColor | null>(
        product.colors && product.colors.length > 0 ? product.colors[0] : null
    );
    const [now, setNow] = useState(() => Date.now());

    // Update now every second for real-time countdown checks
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (product.colors && product.colors.length > 0) {
            setSelectedColor(product.colors[0]);
        } else {
            setSelectedColor(null);
        }
    }, [product]);

    return (
        <div className="min-h-screen bg-white pb-24 pt-14">
            {/* Track product view */}
            <ProductHistoryTracker product={product} />

            {/* Header (Transparent/Floating) */}
            <ProductHeader product={product} />

            {/* Gallery Slider - Compact */}
            <ProductGallery product={product} />

            {/* Info Section - Seamless connection with gallery */}
            <div className="px-4 py-2 relative bg-white z-10">

                {/* === Digikala-style Category Navigation === */}

                {/* Row 1: Full Category Path (Welfvita > Main Category > Subcategory) */}
                <div className="space-y-1.5 mb-2">
                    {product.categoryPath && product.categoryPath.length > 0 && (
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-500 flex-wrap">
                            {/* Site Name as first breadcrumb item */}
                            <Link
                                href="/"
                                className="text-vita-600 hover:underline hover:text-vita-700 transition-colors"
                            >
                                ویلف ویتا
                            </Link>
                            {product.categoryPath.map((cat, index) => (
                                <span key={cat.id} className="flex items-center">
                                    <span className="mx-1 text-gray-400">&lt;</span>
                                    <Link
                                        href={`/products?category=${cat.slug}${index < product.categoryPath!.length - 1 ? '&includeChildren=true' : ''}`}
                                        className={`hover:underline transition-colors ${index === product.categoryPath!.length - 1
                                            ? 'text-red-500 hover:text-red-600'
                                            : 'text-gray-600 hover:text-vita-700'
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
                                className="text-gray-600 hover:underline hover:text-vita-700 transition-colors"
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
                    // Helper logic for offer details - Priority: Campaign > Special Offer > Flash Deal
                    // Check if we have an active campaign or time-based offer
                    const endTime = product.specialOfferEndTime || product.flashDealEndTime;
                    if (!endTime) return null;

                    const endTs = Date.parse(endTime);
                    // Use real-time now state for countdown check
                    const isCountdownActive = !Number.isNaN(endTs) && endTs > now;
                    if (!isCountdownActive) return null;

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
                        <Store size={18} className={product.countInStock > 0 ? "text-vita-500" : "text-red-500"} />
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
    );
}
