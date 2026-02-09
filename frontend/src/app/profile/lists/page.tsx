"use client";
import { useState, useEffect } from "react";
import { ArrowRight, Heart, Trash2, ShoppingCart, Loader2, Plus, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { wishlistService, WishlistItem } from "@/services/wishlistService";
import { useCart } from "@/hooks/useCart";
import { Product } from "@/services/productService";
import { resolvePricing } from "@/lib/pricing";

const ITEMS_PER_PAGE = 15; // 3 rows × 5 columns for desktop

export default function ListsPage() {
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
    const [now, setNow] = useState(() => Date.now());
    const [currentPage, setCurrentPage] = useState(1);

    const { addToCart, updateQuantity, removeFromCart, getItemQuantity, cartItems } = useCart();

    // Fetch wishlist on mount
    useEffect(() => {
        loadWishlist();
    }, []);

    // Tick every second so countdown expirations reflect in wishlist pricing/badges
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // Reset to page 1 when items change
    useEffect(() => {
        setCurrentPage(1);
    }, [items.length]);

    const loadWishlist = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await wishlistService.getWishlist();
            setItems(data);
        } catch (err: any) {
            console.error("[WISHLIST PAGE] Error loading wishlist:", err);
            setError(err.message || "خطا در بارگذاری لیست علاقه‌مندی‌ها");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Remove item from wishlist with optimistic UI update
     */
    const handleRemove = async (productId: string) => {
        if (!confirm("آیا از حذف این محصول از لیست علاقه‌مندی‌ها اطمینان دارید؟")) {
            return;
        }

        const oldItems = [...items];
        setItems(items.filter((item) => item._id !== productId));
        setRemovingIds(new Set(removingIds).add(productId));

        try {
            await wishlistService.removeFromWishlist(productId);
        } catch (err: any) {
            console.error("[WISHLIST PAGE] Error removing item:", err);
            setItems(oldItems);
            alert(err.message || "خطا در حذف محصول");
        } finally {
            setRemovingIds((prev) => {
                const next = new Set(prev);
                next.delete(productId);
                return next;
            });
        }
    };

    /**
     * Convert WishlistItem to Product for useCart
     */
    const mapToProduct = (item: WishlistItem): Product => {
        const pricing = resolvePricing({
            price: item.price,
            discount: item.discount || 0,
            compareAtPrice: item.compareAtPrice || item.price,
            isFlashDeal: item.isFlashDeal,
            flashDealEndTime: item.flashDealEndTime,
            isSpecialOffer: item.isSpecialOffer,
            specialOfferEndTime: item.specialOfferEndTime,
            campaignLabel: item.campaignLabel,
            now,
        });

        return {
            id: item._id,
            name: item.name,
            title: item.name,
            price: pricing.finalPrice,
            oldPrice: pricing.oldPrice,
            compareAtPrice: pricing.basePrice,
            discount: pricing.discount,
            image: item.images && item.images.length > 0 ? item.images[0].url : "/placeholder.jpg",
            images: item.images ? item.images.map(img => img.url) : [],
            category: item.category || "",
            rating: item.rating || 0,
            reviewCount: 0,
            countInStock: item.countInStock ?? item.stock ?? 0,
            slug: item.slug,
            campaignLabel: item.campaignLabel,
            campaignTheme: item.campaignTheme,
            isFlashDeal: item.isFlashDeal,
            flashDealEndTime: item.flashDealEndTime,
            isSpecialOffer: item.isSpecialOffer,
            specialOfferEndTime: item.specialOfferEndTime,
        };
    };

    /**
     * Handle Add/Increase
     */
    const handleIncrease = async (item: WishlistItem) => {
        const qty = getItemQuantity(item._id);
        if (qty === 0) {
            await addToCart(mapToProduct(item), 1);
        } else {
            await updateQuantity(item._id, qty + 1);
        }
    };

    /**
     * Handle Decrease
     */
    const handleDecrease = async (item: WishlistItem) => {
        const qty = getItemQuantity(item._id);
        if (qty > 1) {
            await updateQuantity(item._id, qty - 1);
        } else {
            await removeFromCart(item._id);
        }
    };

    const getPricing = (item: WishlistItem) =>
        resolvePricing({
            price: item.price,
            discount: item.discount || 0,
            compareAtPrice: item.compareAtPrice || item.price,
            isFlashDeal: item.isFlashDeal,
            flashDealEndTime: item.flashDealEndTime,
            isSpecialOffer: item.isSpecialOffer,
            specialOfferEndTime: item.specialOfferEndTime,
            campaignLabel: item.campaignLabel,
            now,
        });

    /**
     * Get first image URL or fallback
     */
    const getImageUrl = (item: WishlistItem) => {
        if (item.images && item.images.length > 0) {
            return item.images[0].url;
        }
        return "/images/placeholder-product.png";
    };

    // Pagination calculations
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = items.slice(startIndex, endIndex);

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
                <div className="md:hidden bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                    <Link href="/profile" className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
                        <ArrowRight size={20} />
                    </Link>
                    <h1 className="font-bold text-lg text-gray-800">لیست علاقه‌مندی‌ها</h1>
                </div>
                <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-4">
                    <h1 className="text-2xl font-black text-gray-800">علاقه‌مندی‌ها</h1>
                </div>
                <div className="p-4 md:max-w-6xl md:mx-auto md:px-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((key) => (
                        <div key={key} className="bg-white p-3 rounded-2xl animate-pulse">
                            <div className="aspect-square bg-gray-200 rounded-xl mb-3" />
                            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
                <div className="md:hidden bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                    <Link href="/profile" className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
                        <ArrowRight size={20} />
                    </Link>
                    <h1 className="font-bold text-lg text-gray-800">لیست علاقه‌مندی‌ها</h1>
                </div>
                <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-4">
                    <h1 className="text-2xl font-black text-gray-800">علاقه‌مندی‌ها</h1>
                </div>
                <div className="text-center py-16 px-4">
                    <p className="text-red-500 text-sm mb-4">{error}</p>
                    <button onClick={loadWishlist} className="px-6 py-2 bg-kala-500 text-white rounded-lg text-sm hover:bg-kala-600 transition">
                        تلاش مجدد
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
            {/* Mobile Header - Only visible on mobile */}
            <div className="md:hidden bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                <Link href="/profile" className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
                    <ArrowRight size={20} />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">لیست علاقه‌مندی‌ها</h1>
                {items.length > 0 && (
                    <span className="mr-auto text-xs text-gray-400">
                        {items.length.toLocaleString('fa-IR')} محصول
                    </span>
                )}
            </div>

            {/* Desktop Breadcrumb - Only visible on desktop */}
            <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black text-gray-800">علاقه‌مندی‌ها</h1>
                    {items.length > 0 && (
                        <span className="text-sm text-gray-500">
                            {items.length.toLocaleString('fa-IR')} محصول
                        </span>
                    )}
                </div>
            </div>

            {/* Wishlist Items */}
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 px-4">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                        <Heart size={40} className="text-gray-300" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <p className="text-gray-800 font-medium text-sm mb-1">لیست علاقه‌مندی‌های شما خالی است</p>
                        <p className="text-gray-400 text-xs mb-6">محصولات مورد علاقه خود را با کلیک روی آیکون قلب ذخیره کنید</p>
                        <Link href="/" className="inline-block px-6 py-2.5 bg-kala-500 text-white text-sm font-bold rounded-lg hover:bg-kala-600 transition-colors">
                            مشاهده محصولات
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    {/* Products Grid */}
                    <div className="p-4 md:max-w-6xl md:mx-auto md:px-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                        {currentItems.map((product) => {
                            const qty = getItemQuantity(product._id);
                            const stock = product.countInStock ?? product.stock;
                            const isOutOfStock = stock !== undefined && stock <= 0;
                            const pricing = getPricing(product);

                            return (
                                <div key={product._id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 hover:shadow-md transition-shadow flex flex-col">
                                    {/* Product Image */}
                                    <Link href={`/product/${product._id}`} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3">
                                        <Image
                                            src={getImageUrl(product)}
                                            fill
                                            className={`object-cover hover:scale-110 transition-transform duration-500 ${isOutOfStock ? "grayscale opacity-60" : ""}`}
                                            alt={product.name}
                                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                                        />
                                        {pricing.discount > 0 && (
                                            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                                {pricing.discount}%
                                            </div>
                                        )}
                                        {isOutOfStock && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                                                <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md">ناموجود</span>
                                            </div>
                                        )}
                                    </Link>

                                    {/* Product Info */}
                                    <Link href={`/product/${product._id}`} className="text-xs font-bold text-gray-800 leading-5 line-clamp-2 hover:text-kala-600 transition-colors mb-auto min-h-[2.5rem]">
                                        {product.name}
                                    </Link>

                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="text-sm font-black text-gray-900">
                                            {pricing.finalPrice.toLocaleString("fa-IR")}
                                        </span>
                                        <span className="text-[9px] text-gray-500">تومان</span>
                                        {pricing.oldPrice && pricing.discount > 0 && (
                                            <span className="text-[10px] text-gray-400 line-through">
                                                {pricing.oldPrice.toLocaleString("fa-IR")}
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 mt-3 h-9">
                                        {qty > 0 ? (
                                            // Stepper
                                            <div className="flex-1 flex items-center justify-between bg-gray-50 rounded-lg border border-gray-100 px-1">
                                                <button
                                                    onClick={() => handleIncrease(product)}
                                                    className="w-8 h-full flex items-center justify-center text-kala-600 hover:bg-kala-100 rounded-md transition"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                                <span className="font-bold text-sm text-gray-800">{qty.toLocaleString('fa-IR')}</span>
                                                <button
                                                    onClick={() => handleDecrease(product)}
                                                    className="w-8 h-full flex items-center justify-center text-red-500 hover:bg-red-50 rounded-md transition"
                                                >
                                                    {qty === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                                                </button>
                                            </div>
                                        ) : (
                                            // Add to Cart Button
                                            <button
                                                onClick={() => handleIncrease(product)}
                                                disabled={isOutOfStock}
                                                className="flex-1 bg-kala-50 text-kala-600 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 hover:bg-kala-100 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                            >
                                                <ShoppingCart size={14} />
                                                {isOutOfStock ? "ناموجود" : "افزودن به سبد"}
                                            </button>
                                        )}

                                        {/* Remove from Wishlist */}
                                        <button
                                            onClick={() => handleRemove(product._id)}
                                            disabled={removingIds.has(product._id)}
                                            className="w-9 h-full bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                                        >
                                            {removingIds.has(product._id) ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Controls - Only on Desktop */}
                    {totalPages > 1 && (
                        <div className="hidden md:flex items-center justify-center gap-2 pb-8 px-4">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>

                            <div className="flex items-center gap-2">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`min-w-[2.5rem] h-10 rounded-lg font-bold text-sm transition-colors ${currentPage === page
                                            ? 'bg-kala-600 text-white'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        {page.toLocaleString('fa-IR')}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
