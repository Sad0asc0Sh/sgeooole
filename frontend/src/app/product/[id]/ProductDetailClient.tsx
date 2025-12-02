"use client";
import { useState, useEffect } from "react";
import { Star, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { Product, ProductColor } from "@/services/productService";
import CountdownTimer from "@/components/ui/CountdownTimer";
import ProductTabs from "@/components/product/ProductTabs";
import ProductHeader from "./ProductHeader";
import ProductGallery from "./ProductGallery";
import ColorSelector from "./ColorSelector";
import ProductActions from "./ProductActions";
import ProductHistoryTracker from "./ProductHistoryTracker";

type ProductDetailClientProps = {
    product: Product;
};

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
    const [selectedColor, setSelectedColor] = useState<ProductColor | null>(
        product.colors && product.colors.length > 0 ? product.colors[0] : null
    );

    useEffect(() => {
        if (product.colors && product.colors.length > 0) {
            setSelectedColor(product.colors[0]);
        } else {
            setSelectedColor(null);
        }
    }, [product]);

    return (
        <div className="min-h-screen bg-white pb-24">
            {/* Track product view */}
            <ProductHistoryTracker product={product} />

            {/* Header (Transparent/Floating) */}
            <ProductHeader product={product} />

            {/* Gallery Slider */}
            <ProductGallery product={product} />

            {/* Info Section */}
            <div className="px-4 py-6 -mt-6 relative bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10">

                {/* Title & Rating */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        {product.categoryPath && product.categoryPath.length > 0 ? (
                            <div className="flex items-center gap-1 text-xs font-medium text-vita-600 mb-1">
                                {product.categoryPath.map((cat, index) => (
                                    <span key={cat.id} className="flex items-center">
                                        {index > 0 && <span className="mx-1 text-gray-400">/</span>}
                                        <Link
                                            href={`/products?category=${cat.slug}${index === 0 && product.categoryPath!.length > 1 ? '&includeChildren=true' : ''}`}
                                            className="hover:underline hover:text-vita-700 transition-colors"
                                        >
                                            {cat.name}
                                        </Link>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            product.category && (
                                <span className="text-xs font-medium text-vita-600 mb-1 block">
                                    {product.category}
                                </span>
                            )
                        )}
                        <h1 className="text-lg font-bold text-gray-900 leading-snug">{product.title}</h1>
                        {product.enTitle && (
                            <span className="text-xs text-gray-400 font-mono mt-1">{product.enTitle}</span>
                        )}
                    </div>
                </div>

                {/* Timer for Special Offers / Flash Deals / Campaign Offers */}
                {(() => {
                    // Helper logic for offer details - Priority: Campaign > Special Offer > Flash Deal
                    let offer = null;

                    // Check if we have an active campaign or time-based offer
                    const endTime = product.specialOfferEndTime || product.flashDealEndTime;
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
                            label = 'پیشنهاد ویژه';
                        }
                    }

                    offer = {
                        label,
                        themeClass,
                        targetDate: endTime
                    };

                    if (!offer) return null;

                    return (
                        <div className="mb-4">
                            <div className={`p-3 rounded-xl flex items-center justify-between ${offer.themeClass}`}>
                                <span className="text-sm font-bold flex items-center gap-2">
                                    <Store size={16} />
                                    {offer.label}
                                </span>
                                <div className="flex items-center gap-2" dir="ltr">
                                    <CountdownTimer
                                        targetDate={offer.targetDate}
                                        className="text-sm font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Rating Section */}
                {product.rating > 0 && (
                    <div className="flex items-center gap-1 mb-6">
                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-bold text-gray-800">{product.rating}</span>
                        <span className="text-xs text-gray-400">
                            ({product.reviewCount} {product.reviewCount === 0 ? "" : "دیدگاه"})
                        </span>
                    </div>
                )}

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
                            {product.countInStock > 0
                                ? `موجود در انبار (${product.countInStock} عدد)`
                                : "ناموجود"}
                        </span>
                    </div>
                </div>

                {/* Product Tabs (Description, Specs, Reviews) */}
                <ProductTabs product={product} />

            </div>

            {/* Sticky Action Bar */}
            <ProductActions product={product} selectedColor={selectedColor} />
        </div>
    );
}
