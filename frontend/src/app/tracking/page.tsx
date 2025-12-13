"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";

interface OrderTrackingResult {
    _id: string;
    orderCode: string;
    orderStatus: string;
    createdAt: string;
    totalPrice: number;
    trackingCode?: string;
}

export default function TrackingPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [orderCode, setOrderCode] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<OrderTrackingResult | null>(null);

    // If user is authenticated, redirect to orders page
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/profile/orders");
        }
    }, [isAuthenticated, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!orderCode.trim()) {
            setError("لطفاً کد سفارش را وارد کنید");
            return;
        }

        if (!phone.trim()) {
            setError("لطفاً شماره موبایل را وارد کنید");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await api.get(`/orders/track/${encodeURIComponent(orderCode)}`, {
                params: { phone: phone.trim() }
            });

            if (response.data.success) {
                setResult(response.data.data);
            } else {
                setError(response.data.message || "سفارشی با این مشخصات یافت نشد");
            }
        } catch (err: any) {
            console.error("Tracking error:", err);
            setError(err.response?.data?.message || "خطا در پیگیری سفارش. لطفاً مجدداً تلاش کنید.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'Pending':
                return { label: 'در انتظار پرداخت', color: 'text-yellow-600', bg: 'bg-yellow-50' };
            case 'Processing':
                return { label: 'درحال پردازش', color: 'text-blue-600', bg: 'bg-blue-50' };
            case 'Shipped':
                return { label: 'تحویل به پست', color: 'text-purple-600', bg: 'bg-purple-50' };
            case 'Delivered':
                return { label: 'تحویل شده', color: 'text-green-600', bg: 'bg-green-50' };
            case 'Cancelled':
                return { label: 'لغو شده', color: 'text-red-600', bg: 'bg-red-50' };
            default:
                return { label: status, color: 'text-gray-600', bg: 'bg-gray-50' };
        }
    };

    // Show loading while checking auth
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-vita-500" />
            </div>
        );
    }

    // If authenticated, show nothing (will redirect)
    if (isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
                <Link href="/" className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <ChevronRight size={24} />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">پیگیری سفارش</h1>
            </div>

            <div className="p-4 space-y-6">
                {/* Info Card */}
                <div className="bg-gradient-to-br from-vita-50 to-blue-50 rounded-2xl p-5 border border-vita-100">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-vita-600 shrink-0">
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-800 mb-1">پیگیری سفارش بدون ورود</h2>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                با وارد کردن کد سفارش و شماره موبایلی که هنگام ثبت سفارش وارد کرده‌اید، وضعیت سفارش خود را پیگیری کنید.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">کد سفارش</label>
                        <input
                            type="text"
                            value={orderCode}
                            onChange={(e) => {
                                setOrderCode(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder="مثال: WV-123456"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-vita-500 focus:border-vita-500 transition-all"
                            dir="ltr"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">شماره موبایل</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder="09123456789"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-vita-500 focus:border-vita-500 transition-all"
                            dir="ltr"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-3 px-6 rounded-xl hover:from-vita-600 hover:to-vita-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>در حال جستجو...</span>
                            </>
                        ) : (
                            <>
                                <Search size={18} />
                                <span>پیگیری سفارش</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Result */}
                {result && (
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Package size={18} className="text-vita-600" />
                            اطلاعات سفارش
                        </h3>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">کد سفارش</span>
                                <span className="text-sm font-bold font-mono text-gray-800">{result.orderCode}</span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">وضعیت</span>
                                <span className={`text-sm font-bold px-3 py-1 rounded-full ${getStatusInfo(result.orderStatus).bg} ${getStatusInfo(result.orderStatus).color}`}>
                                    {getStatusInfo(result.orderStatus).label}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">تاریخ ثبت</span>
                                <span className="text-sm text-gray-800">{new Date(result.createdAt).toLocaleDateString('fa-IR')}</span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">مبلغ کل</span>
                                <span className="text-sm font-bold text-gray-800">{result.totalPrice.toLocaleString('fa-IR')} تومان</span>
                            </div>

                            {result.trackingCode && (
                                <div className="bg-blue-50 rounded-xl p-4 mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-blue-700 font-bold">کد رهگیری پستی</span>
                                    </div>
                                    <p className="font-mono font-bold text-blue-800 text-center py-2 bg-white rounded-lg">
                                        {result.trackingCode}
                                    </p>
                                    <a
                                        href="https://tracking.post.ir/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-all text-sm font-bold"
                                    >
                                        <span>پیگیری در سایت پست</span>
                                        <ChevronRight size={16} className="rotate-180" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Login Prompt */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
                    <p className="text-sm text-gray-600 mb-3">
                        برای مشاهده تمام سفارشات خود، وارد حساب کاربری شوید
                    </p>
                    <Link
                        href="/login?redirect=/profile/orders"
                        className="inline-flex items-center gap-2 text-vita-600 font-bold text-sm hover:text-vita-700 transition-colors"
                    >
                        <span>ورود به حساب کاربری</span>
                        <ChevronRight size={16} className="rotate-180" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
