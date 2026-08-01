"use client";

import { useCallback, useState, useEffect } from "react";
import { reviewService, Review } from "@/services/reviewService";
import {
    Check, X, MessageSquare, Star, Trash2, Search, Filter, Loader2,
    AlertCircle, Reply, Eye, User, ShoppingBag,
    ChevronLeft, ChevronRight, Mail, Phone
} from "lucide-react";
import ResilientImage from "@/components/ui/ResilientImage";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getBlurDataURL } from "@/lib/blurPlaceholder";

// Stats Component
const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
            <p className="text-gray-500 text-sm mb-1">{title}</p>
            <h3 className="text-2xl font-black text-gray-800">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={24} />
        </div>
    </div>
);

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Detail Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replying, setReplying] = useState(false);

    const fetchReviews = useCallback(async () => {
        try {
            setLoading(true);
            let approvedParam: boolean | undefined = undefined;
            if (filter === "approved") approvedParam = true;
            if (filter === "pending") approvedParam = false;

            const res = await reviewService.getAllReviews(page, 20, approvedParam);
            setReviews(res.data);
            setTotalPages(res.pagination.totalPages);
            setTotalItems(res.pagination.totalItems || 0);
        } catch (err) {
            console.error("Error fetching reviews", err);
        } finally {
            setLoading(false);
        }
    }, [page, filter]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleStatusUpdate = async (id: string, isApproved: boolean) => {
        try {
            setActionLoading(id);
            await reviewService.updateStatus(id, isApproved);
            setReviews(prev => prev.map(r => r._id === id ? { ...r, isApproved } : r));
            // Update selected review if open
            if (selectedReview && selectedReview._id === id) {
                setSelectedReview(prev => prev ? { ...prev, isApproved } : null);
            }
            // Optional: Remove from list if filtering by status
            if (filter === "pending" && isApproved) {
                setReviews(prev => prev.filter(r => r._id !== id));
                if (selectedReview?._id === id) setDetailModalOpen(false);
            }
        } catch (err) {
            console.error("Error updating status", err);
            alert("خطا در تغییر وضعیت");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("آیا از حذف این نظر اطمینان دارید؟")) return;
        try {
            setActionLoading(id);
            await reviewService.deleteReview(id);
            setReviews(prev => prev.filter(r => r._id !== id));
            if (selectedReview?._id === id) setDetailModalOpen(false);
        } catch (err) {
            console.error("Error deleting review", err);
            alert("خطا در حذف نظر");
        } finally {
            setActionLoading(null);
        }
    };

    const openDetailModal = (review: Review) => {
        setSelectedReview(review);
        setReplyText(review.adminReply?.message || "");
        setDetailModalOpen(true);
    };

    const handleReplySubmit = async () => {
        if (!selectedReview || !replyText.trim()) return;
        try {
            setReplying(true);
            await reviewService.replyToReview(selectedReview._id, replyText);

            const updatedReview = {
                ...selectedReview,
                adminReply: { message: replyText, repliedAt: new Date().toISOString() }
            };

            // Update local state
            setReviews(prev => prev.map(r => r._id === selectedReview._id ? updatedReview : r));
            setSelectedReview(updatedReview);

            alert("پاسخ با موفقیت ثبت شد");
        } catch (err) {
            console.error("Error replying", err);
            alert("خطا در ثبت پاسخ");
        } finally {
            setReplying(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="کل نظرات"
                    value={totalItems}
                    icon={MessageSquare}
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="در انتظار تأیید"
                    value={filter === 'pending' ? totalItems : '-'}
                    icon={AlertCircle}
                    color="bg-amber-50 text-amber-600"
                />
                <StatCard
                    title="میانگین امتیاز"
                    value="4.8"
                    icon={Star}
                    color="bg-yellow-50 text-yellow-600"
                />
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => { setFilter("pending"); setPage(1); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${filter === "pending"
                            ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        <AlertCircle size={16} />
                        در انتظار بررسی
                    </button>
                    <button
                        onClick={() => { setFilter("approved"); setPage(1); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${filter === "approved"
                            ? "bg-green-500 text-white shadow-lg shadow-green-200"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        <Check size={16} />
                        تأیید شده
                    </button>
                    <button
                        onClick={() => { setFilter("all"); setPage(1); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${filter === "all"
                            ? "bg-gray-800 text-white shadow-lg shadow-gray-200"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        <Filter size={16} />
                        همه نظرات
                    </button>
                </div>

                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder="جستجو در نظرات..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-kala-500 transition-all"
                    />
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
            </div>

            {/* Reviews Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-kala-500 mb-4" size={40} />
                        <p className="text-gray-500 font-medium">در حال بارگذاری نظرات...</p>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                            <MessageSquare size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">نظری یافت نشد</h3>
                        <p className="text-gray-500">هیچ دیدگاهی با فیلترهای فعلی وجود ندارد.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">محصول</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">کاربر</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">امتیاز</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase w-1/3">دیدگاه</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">وضعیت</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">تاریخ</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">عملیات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {reviews.map((review) => (
                                    <tr key={review._id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg relative overflow-hidden flex-shrink-0 border border-gray-200">
                                                    {(review.product as any)?.images?.[0] ? (
                                                        <ResilientImage
                                                            src={(review.product as any).images[0]}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                            sizes="40px"
                                                            loading="lazy"
                                                            quality={50}
                                                            placeholder="blur"
                                                            blurDataURL={getBlurDataURL()}
                                                        />
                                                    ) : (
                                                        <ShoppingBag className="m-auto text-gray-300" size={16} />
                                                    )}
                                                </div>
                                                <span className="font-bold text-gray-800 text-sm line-clamp-1 max-w-[150px]" title={(review.product as any)?.name}>
                                                    {(review.product as any)?.name || "محصول حذف شده"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold">
                                                    {review.user?.name?.charAt(0) || "U"}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-800 text-sm">{review.user?.name || "کاربر ناشناس"}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-gray-800">{review.rating}</span>
                                                <Star size={14} className="fill-amber-400 text-amber-400" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 line-clamp-2" title={review.comment}>
                                                {review.comment}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {review.isApproved ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                    تأیید شده
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                    در انتظار
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(review.createdAt).toLocaleDateString('fa-IR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openDetailModal(review)}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="مشاهده جزئیات"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                {!review.isApproved ? (
                                                    <button
                                                        onClick={() => handleStatusUpdate(review._id, true)}
                                                        disabled={actionLoading === review._id}
                                                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                                        title="تأیید"
                                                    >
                                                        {actionLoading === review._id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStatusUpdate(review._id, false)}
                                                        disabled={actionLoading === review._id}
                                                        className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                                                        title="رد کردن"
                                                    >
                                                        {actionLoading === review._id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(review._id)}
                                                    disabled={actionLoading === review._id}
                                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="حذف"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 p-4 border-t border-gray-100">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <span className="px-4 py-2 text-sm font-bold text-gray-600 flex items-center">
                            صفحه {page} از {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {detailModalOpen && selectedReview && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-bold text-xl text-gray-800">جزئیات نظر</h3>
                                    <p className="text-sm text-gray-500 mt-1">شناسه: {selectedReview._id}</p>
                                </div>
                                <button onClick={() => setDetailModalOpen(false)} className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors border border-gray-200">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Left Column: Review Content & Reply */}
                                    <div className="lg:col-span-2 space-y-6">
                                        {/* Review Content */}
                                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                                                        <span className="font-black text-amber-600 text-lg">{selectedReview.rating}</span>
                                                        <Star size={16} className="fill-amber-400 text-amber-400" />
                                                    </div>
                                                    <span className="text-sm text-gray-400 px-2 border-r border-gray-200 mr-2">
                                                        {new Date(selectedReview.createdAt).toLocaleString('fa-IR')}
                                                    </span>
                                                </div>
                                                {selectedReview.isApproved ? (
                                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1">
                                                        <Check size={14} /> تأیید شده
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                                                        <AlertCircle size={14} /> در انتظار بررسی
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-700 leading-relaxed text-base">
                                                {selectedReview.comment}
                                            </p>
                                        </div>

                                        {/* Reply Section */}
                                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                <Reply size={18} className="text-kala-500" />
                                                پاسخ ادمین
                                            </h4>
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                rows={5}
                                                className="w-full p-4 rounded-xl border border-gray-200 focus:border-kala-500 focus:ring-2 focus:ring-kala-100 outline-none resize-none text-sm bg-white"
                                                placeholder="پاسخ خود را اینجا بنویسید..."
                                            />
                                            <div className="flex justify-end mt-4">
                                                <button
                                                    onClick={handleReplySubmit}
                                                    disabled={replying || !replyText.trim()}
                                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-kala-500 hover:bg-kala-600 transition-colors shadow-lg shadow-kala-200 disabled:opacity-70 flex items-center gap-2"
                                                >
                                                    {replying ? <Loader2 className="animate-spin" size={18} /> : <Reply size={18} />}
                                                    ثبت پاسخ
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: User & Product Info */}
                                    <div className="space-y-6">
                                        {/* User Card */}
                                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">اطلاعات کاربر</h4>
                                            <div className="flex flex-col items-center text-center">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-2xl mb-3 border-4 border-white shadow-sm">
                                                    {selectedReview.user?.name?.charAt(0) || <User size={32} />}
                                                </div>
                                                <h5 className="font-bold text-gray-800 text-lg">{selectedReview.user?.name || "کاربر ناشناس"}</h5>
                                                {/* Placeholder for email/phone if available in future */}
                                                <div className="flex items-center gap-2 mt-4 w-full">
                                                    <button className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1">
                                                        <Mail size={14} /> ایمیل
                                                    </button>
                                                    <button className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1">
                                                        <Phone size={14} /> تماس
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Product Card */}
                                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">محصول مرتبط</h4>
                                            <div className="relative aspect-video w-full bg-gray-100 rounded-xl overflow-hidden mb-3 border border-gray-200">
                                                {(selectedReview.product as any)?.images?.[0] ? (
                                                    <ResilientImage
                                                        src={(selectedReview.product as any).images[0]}
                                                        alt="Product"
                                                        fill
                                                        className="object-cover"
                                                        sizes="(max-width: 1024px) 100vw, 320px"
                                                        loading="lazy"
                                                        quality={65}
                                                        placeholder="blur"
                                                        blurDataURL={getBlurDataURL()}
                                                    />
                                                ) : (
                                                    <ShoppingBag className="m-auto text-gray-300" size={32} />
                                                )}
                                            </div>
                                            <h5 className="font-bold text-gray-800 text-sm line-clamp-2 mb-3">
                                                {(selectedReview.product as any)?.name || "محصول حذف شده"}
                                            </h5>
                                            <Link
                                                href={`/product/${(selectedReview.product as any)?.slug || (selectedReview.product as any)?._id}`}
                                                target="_blank"
                                                className="block w-full py-2.5 bg-kala-50 text-kala-600 rounded-xl text-sm font-bold text-center hover:bg-kala-100 transition-colors"
                                            >
                                                مشاهده محصول
                                            </Link>
                                        </div>

                                        {/* Actions */}
                                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">عملیات</h4>
                                            <div className="space-y-2">
                                                {!selectedReview.isApproved ? (
                                                    <button
                                                        onClick={() => handleStatusUpdate(selectedReview._id, true)}
                                                        disabled={actionLoading === selectedReview._id}
                                                        className="w-full py-3 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                                                    >
                                                        {actionLoading === selectedReview._id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                                        تأیید دیدگاه
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStatusUpdate(selectedReview._id, false)}
                                                        disabled={actionLoading === selectedReview._id}
                                                        className="w-full py-3 bg-amber-50 text-amber-600 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        {actionLoading === selectedReview._id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                                                        رد کردن دیدگاه
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(selectedReview._id)}
                                                    disabled={actionLoading === selectedReview._id}
                                                    className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 size={18} />
                                                    حذف دیدگاه
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
