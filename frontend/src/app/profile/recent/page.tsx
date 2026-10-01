"use client";
import { ArrowRight, Clock, Trash2, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useHistoryStore } from "@/store/historyStore";
import { useEffect, useState } from "react";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { getServerNow } from "@/lib/serverClock";

const ITEMS_PER_PAGE = 15; // 3 rows × 5 columns for desktop

export default function RecentPage() {
    const { viewedProducts, clearHistory } = useHistoryStore();
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState(() => getServerNow());
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(getServerNow()), 1000);
        return () => clearInterval(id);
    }, []);

    // Reset to page 1 when products change
    useEffect(() => {
        setCurrentPage(1);
    }, [viewedProducts.length]);

    if (!mounted) return null;

    // Pagination calculations
    const totalPages = Math.ceil(viewedProducts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentProducts = viewedProducts.slice(startIndex, endIndex);

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
            {/* Mobile Header - Only visible on mobile */}
            <div className="md:hidden bg-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Link
                        href="/profile"
                        className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        <ArrowRight size={20} />
                    </Link>
                    <h1 className="font-bold text-lg text-gray-800">بازدیدهای اخیر</h1>
                </div>
                {viewedProducts.length > 0 && (
                    <button
                        onClick={clearHistory}
                        className="text-red-500 text-xs font-bold flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                    >
                        <Trash2 size={14} />
                        پاک کردن همه
                    </button>
                )}
            </div>

            {/* Desktop Breadcrumb - Only visible on desktop */}
            <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black text-gray-800">بازدید</h1>
                    {viewedProducts.length > 0 && (
                        <button
                            onClick={clearHistory}
                            className="text-red-500 text-sm font-bold flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                            پاک کردن همه
                        </button>
                    )}
                </div>
            </div>

            {viewedProducts.length === 0 ? (
                <div className="text-center py-24 px-4">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                        <Clock size={40} className="text-gray-300" />
                    </div>
                    <h3 className="text-gray-800 font-bold mb-2">لیست بازدیدها خالی است</h3>
                    <p className="text-gray-400 text-sm mb-6">شما هنوز از هیچ محصولی بازدید نکرده‌اید</p>
                    <Link href="/products" className="inline-flex items-center gap-2 bg-kala-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-kala-200 hover:bg-kala-700 transition-colors">
                        <ShoppingBag size={18} />
                        مشاهده محصولات
                    </Link>
                </div>
            ) : (
                <>
                    {/* Products Grid */}
                    <div className="p-4 md:max-w-6xl md:mx-auto md:px-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                        {currentProducts.map((product) => {
                            // Single source: the shared resolver (history snapshots may be stale).
                            const promotion = resolveProductPromotion(
                                {
                                    price: product.finalPrice || product.price,
                                    oldPrice: product.price,
                                    discount: product.discount,
                                    isFlashDeal: (product as any).isFlashDeal,
                                    flashDealEndTime: (product as any).flashDealEndTime,
                                    isSpecialOffer: (product as any).isSpecialOffer,
                                    specialOfferEndTime: (product as any).specialOfferEndTime,
                                },
                                now,
                            );
                            const hasSpecialOfferCountdown = promotion.isSpecialOfferActive;
                            const displayPrice = promotion.displayPrice;

                            return (
                                <Link href={`/product/${product.slug || product._id}`} key={product._id} className="block group">
                                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 h-full flex flex-col hover:shadow-md transition-shadow">
                                        <div className="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden relative">
                                            <img
                                                src={product.image?.startsWith('http') ? product.image : `http://localhost:5000/${product.image}`}
                                                alt={product.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            {product.discount && product.discount > 0 && (!((product as any).isSpecialOffer) || hasSpecialOfferCountdown) && (
                                                <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                                                    {product.discount}%
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-xs font-bold text-gray-800 line-clamp-2 mb-auto leading-5 min-h-[2.5rem]">
                                            {product.title}
                                        </h3>
                                        <div className="mt-3 flex items-end justify-between">
                                            <div className="flex flex-col">
                                                {product.discount && product.discount > 0 && (!((product as any).isSpecialOffer) || hasSpecialOfferCountdown) && (
                                                    <span className="text-[10px] text-gray-400 line-through decoration-red-400">
                                                        {product.price?.toLocaleString('fa-IR')}
                                                    </span>
                                                )}
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-sm font-black text-gray-800">
                                                        {displayPrice?.toLocaleString('fa-IR')}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">تومان</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
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
