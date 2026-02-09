"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare, Info, CheckCircle, AlertCircle, User, Calendar, Send, Loader2 } from "lucide-react";
import { Product } from "@/services/productService";
import { reviewService, Review } from "@/services/reviewService";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

interface ProductTabsProps {
    product: Product;
}

export default function ProductTabs({ product }: ProductTabsProps) {
    const [activeTab, setActiveTab] = useState<"desc" | "specs" | "reviews">("desc");
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [reviewStats, setReviewStats] = useState({ total: 0, avg: 0 });

    // Form State
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const { user, isAuthenticated } = useAuth();

    useEffect(() => {
        if (activeTab === "reviews") {
            fetchReviews();
        }
    }, [activeTab, product.id]);

    const fetchReviews = async () => {
        try {
            setLoadingReviews(true);
            const res = await reviewService.getProductReviews(product.id);
            setReviews(res.data);
            setReviewStats({
                total: res.pagination.total,
                avg: product.rating || 0 // Use product rating as source of truth for avg
            });
        } catch (err) {
            console.error("Error fetching reviews", err);
        } finally {
            setLoadingReviews(false);
        }
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rating || !comment.trim()) return;

        try {
            setSubmitting(true);
            setSubmitError("");
            await reviewService.addReview(product.id, rating, comment);
            setSubmitSuccess(true);
            setComment("");
            setRating(5);
        } catch (err: any) {
            setSubmitError(err.response?.data?.message || "خطا در ثبت دیدگاه");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden my-6">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab("desc")}
                    className={`flex-1 min-w-[120px] py-4 text-sm font-bold transition-colors relative ${activeTab === "desc" ? "text-kala-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    توضیحات
                    {activeTab === "desc" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-kala-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("specs")}
                    className={`flex-1 min-w-[120px] py-4 text-sm font-bold transition-colors relative ${activeTab === "specs" ? "text-kala-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    مشخصات فنی
                    {activeTab === "specs" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-kala-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("reviews")}
                    className={`flex-1 min-w-[120px] py-4 text-sm font-bold transition-colors relative ${activeTab === "reviews" ? "text-kala-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    دیدگاه‌ها ({product.reviewCount || 0})
                    {activeTab === "reviews" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-kala-500" />
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="p-6 min-h-[300px]">
                {activeTab === "desc" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Info size={20} className="text-kala-600" /> توضیحات محصول
                        </h3>
                        {product.description ? (
                            <p className="text-gray-600 leading-8 text-justify whitespace-pre-line">
                                {product.description}
                            </p>
                        ) : (
                            <p className="text-gray-400 text-center py-8">توضیحاتی ثبت نشده است.</p>
                        )}
                    </div>
                )}

                {activeTab === "specs" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Info size={20} className="text-kala-600" /> مشخصات فنی
                        </h3>
                        {product.specs && product.specs.length > 0 ? (
                            <div className="grid gap-0 border border-gray-100 rounded-xl overflow-hidden">
                                {product.specs.map((spec, i) => (
                                    <div
                                        key={i}
                                        className={`flex flex-col sm:flex-row p-4 ${i !== product.specs!.length - 1 ? "border-b border-gray-100" : ""
                                            } ${i % 2 === 0 ? "bg-gray-50/50" : "bg-white"}`}
                                    >
                                        <span className="text-gray-500 text-sm w-full sm:w-1/3 mb-1 sm:mb-0 font-medium">
                                            {spec.label}
                                        </span>
                                        <span className="text-gray-800 text-sm w-full sm:w-2/3 font-bold">
                                            {spec.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-xl">
                                <p className="text-gray-500">مشخصات فنی ثبت نشده است.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "reviews" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid md:grid-cols-12 gap-8">
                            {/* Reviews List */}
                            <div className="md:col-span-7 space-y-6">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <MessageSquare size={20} className="text-kala-600" />
                                    نظرات کاربران
                                </h3>

                                {loadingReviews ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="animate-spin text-kala-500" size={32} />
                                    </div>
                                ) : reviews.length > 0 ? (
                                    <div className="space-y-4">
                                        {reviews.map((review) => (
                                            <div key={review._id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                                            <User size={16} />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-800 block">
                                                                {review.user?.name || "کاربر مهمان"}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                <Calendar size={10} />
                                                                {new Date(review.createdAt).toLocaleDateString('fa-IR')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-0.5">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                size={14}
                                                                className={
                                                                    star <= review.rating
                                                                        ? "fill-amber-400 text-amber-400"
                                                                        : "text-gray-300"
                                                                }
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-gray-600 text-sm leading-relaxed">
                                                    {review.comment}
                                                </p>
                                                {review.adminReply && (
                                                    <div className="mt-3 bg-white border-r-2 border-kala-500 p-3 rounded-l-lg text-sm">
                                                        <span className="text-kala-600 font-bold text-xs block mb-1">پاسخ ادمین:</span>
                                                        <p className="text-gray-600">{review.adminReply.message}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-500 font-medium">هنوز دیدگاهی برای این محصول ثبت نشده است.</p>
                                        <p className="text-gray-400 text-sm mt-1">اولین نفری باشید که نظر می‌دهد!</p>
                                    </div>
                                )}
                            </div>

                            {/* Add Review Form */}
                            <div className="md:col-span-5">
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm sticky top-24">
                                    <h3 className="font-bold text-gray-900 mb-4">ثبت دیدگاه جدید</h3>

                                    {!isAuthenticated ? (
                                        <div className="bg-gray-50 rounded-xl p-6 text-center">
                                            <p className="text-gray-600 text-sm mb-4">
                                                برای ثبت نظر، لطفاً ابتدا وارد حساب کاربری خود شوید.
                                            </p>
                                            <Link href="/login" className="inline-block px-6 py-2 bg-kala-500 text-white rounded-lg text-sm font-bold hover:bg-kala-600 transition-colors">
                                                ورود به حساب
                                            </Link>
                                        </div>
                                    ) : submitSuccess ? (
                                        <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
                                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <CheckCircle size={24} />
                                            </div>
                                            <h4 className="font-bold text-green-800 mb-2">دیدگاه شما ثبت شد</h4>
                                            <p className="text-green-600 text-sm">
                                                نظر شما با موفقیت ثبت شد و پس از تأیید مدیر نمایش داده خواهد شد.
                                            </p>
                                            <button
                                                onClick={() => setSubmitSuccess(false)}
                                                className="mt-4 text-sm text-green-700 font-bold hover:underline"
                                            >
                                                ثبت نظر دیگر
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmitReview} className="space-y-4">
                                            {submitError && (
                                                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                                                    <AlertCircle size={16} />
                                                    {submitError}
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">امتیاز شما</label>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => setRating(star)}
                                                            className="transition-transform hover:scale-110 focus:outline-none"
                                                        >
                                                            <Star
                                                                size={28}
                                                                className={`${star <= rating
                                                                    ? "fill-amber-400 text-amber-400"
                                                                    : "text-gray-200 hover:text-amber-200"
                                                                    } transition-colors`}
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                                <span className="text-xs text-gray-400 mt-1 block">
                                                    {rating === 5 ? "عالی" : rating === 4 ? "خوب" : rating === 3 ? "معمولی" : rating === 2 ? "بد" : "خیلی بد"}
                                                </span>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">متن دیدگاه</label>
                                                <textarea
                                                    value={comment}
                                                    onChange={(e) => setComment(e.target.value)}
                                                    rows={4}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-kala-500 focus:ring-2 focus:ring-kala-100 outline-none transition-all resize-none text-sm"
                                                    placeholder="نقاط قوت و ضعف محصول را بنویسید..."
                                                    required
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="w-full py-3 bg-kala-500 text-white rounded-xl font-bold hover:bg-kala-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={18} />
                                                        در حال ثبت...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={18} />
                                                        ثبت دیدگاه
                                                    </>
                                                )}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
