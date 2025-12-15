"use client";
import { useState, useEffect } from "react";
import { ArrowRight, MessageSquare, Star, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { reviewService, Review } from "@/services/reviewService";

const ITEMS_PER_PAGE = 15; // 3 rows × 5 columns for desktop

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        loadReviews();
    }, [currentPage]);

    const loadReviews = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await reviewService.getUserReviews(currentPage, ITEMS_PER_PAGE);
            setReviews(data.data);
            setTotalPages(data.pagination.pages);
            setTotal(data.pagination.total);
        } catch (err: any) {
            console.error("[REVIEWS PAGE] Error loading reviews:", err);
            setError(err.message || "خطا در بارگذاری نظرات");
        } finally {
            setLoading(false);
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={14}
                        className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
                    />
                ))}
            </div>
        );
    };

    const getProductImage = (review: Review) => {
        if (typeof review.product === 'object' && review.product.images && review.product.images.length > 0) {
            return review.product.images[0].url;
        }
        return "/images/placeholder-product.png";
    };

    const getProductName = (review: Review) => {
        if (typeof review.product === 'object') {
            return review.product.name;
        }
        return "محصول";
    };

    const getProductSlug = (review: Review) => {
        if (typeof review.product === 'object') {
            return review.product.slug || review.product._id;
        }
        return "";
    };

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
                <div className="md:hidden bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                    <Link href="/profile" className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
                        <ArrowRight size={20} />
                    </Link>
                    <h1 className="font-bold text-lg text-gray-800">نقد و نظرات من</h1>
                </div>
                <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-4">
                    <h1 className="text-2xl font-black text-gray-800">نقد و نظرات</h1>
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
                    <h1 className="font-bold text-lg text-gray-800">نقد و نظرات من</h1>
                </div>
                <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-4">
                    <h1 className="text-2xl font-black text-gray-800">نقد و نظرات</h1>
                </div>
                <div className="text-center py-16 px-4">
                    <p className="text-red-500 text-sm mb-4">{error}</p>
                    <button onClick={loadReviews} className="px-6 py-2 bg-vita-500 text-white rounded-lg text-sm hover:bg-vita-600 transition">
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
                <h1 className="font-bold text-lg text-gray-800">نقد و نظرات من</h1>
                {total > 0 && (
                    <span className="mr-auto text-xs text-gray-400">
                        {total.toLocaleString('fa-IR')} نظر
                    </span>
                )}
            </div>

            {/* Desktop Breadcrumb - Only visible on desktop */}
            <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black text-gray-800">نقد و نظرات</h1>
                    {total > 0 && (
                        <span className="text-sm text-gray-500">
                            {total.toLocaleString('fa-IR')} نظر
                        </span>
                    )}
                </div>
            </div>

            {/* Reviews List */}
            {reviews.length === 0 ? (
                <div className="text-center py-24 px-4">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <MessageSquare size={32} className="text-gray-300" />
                    </div>
                    <p className="text-gray-400 text-sm mb-2">هنوز نظری ثبت نکرده‌اید</p>
                    <p className="text-gray-300 text-xs mb-6">نظرات شما پس از خرید و بررسی محصولات در اینجا نمایش داده می‌شود</p>
                    <Link href="/" className="inline-block px-6 py-2.5 bg-vita-500 text-white text-sm font-bold rounded-lg hover:bg-vita-600 transition-colors">
                        مشاهده محصولات
                    </Link>
                </div>
            ) : (
                <>
                    {/* Reviews Grid */}
                    <div className="p-4 md:max-w-6xl md:mx-auto md:px-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                        {reviews.map((review) => (
                            <div key={review._id} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-50 hover:shadow-md transition-shadow flex flex-col">
                                {/* Product Image */}
                                <Link href={`/product/${getProductSlug(review)}`} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3">
                                    <Image
                                        src={getProductImage(review)}
                                        fill
                                        className="object-cover hover:scale-110 transition-transform duration-500"
                                        alt={getProductName(review)}
                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                </Link>

                                {/* Product Name */}
                                <Link href={`/product/${getProductSlug(review)}`} className="text-xs font-bold text-gray-800 leading-5 line-clamp-1 hover:text-vita-600 transition-colors mb-2">
                                    {getProductName(review)}
                                </Link>

                                {/* Rating */}
                                <div className="flex items-center gap-2 mb-2">
                                    {renderStars(review.rating)}
                                    <span className="text-xs text-gray-500">
                                        {review.rating.toLocaleString('fa-IR')}
                                    </span>
                                </div>

                                {/* Comment Preview */}
                                <p className="text-[11px] text-gray-600 line-clamp-3 leading-5 mb-3">
                                    {review.comment}
                                </p>

                                {/* Status Badge */}
                                <div className="mt-auto">
                                    {review.isApproved ? (
                                        <span className="inline-block px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-md">
                                            تایید شده
                                        </span>
                                    ) : (
                                        <span className="inline-block px-2 py-1 bg-yellow-50 text-yellow-600 text-[10px] font-bold rounded-md">
                                            در انتظار تایید
                                        </span>
                                    )}
                                </div>

                                {/* Admin Reply */}
                                {review.adminReply && (
                                    <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                        <p className="text-[10px] font-bold text-blue-700 mb-1">پاسخ فروشگاه:</p>
                                        <p className="text-[10px] text-blue-600 line-clamp-2">
                                            {review.adminReply.message}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
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
                                            ? 'bg-vita-600 text-white'
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
