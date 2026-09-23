"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Box, Clock, CheckCircle2, XCircle, Truck, AlertCircle, Search, CreditCard, Loader2, X } from "lucide-react";
import { authService } from "@/services/authService";

interface Order {
    _id: string;
    orderCode?: string;
    orderStatus: string;
    totalPrice: number;
    createdAt: string;
    orderItems: any[];
    shippingAddress: any;
}

type TabType = 'pending' | 'current' | 'delivered' | 'cancelled';

export default function OrdersPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        }>
            <OrdersContent />
        </Suspense>
    );
}

function OrdersContent() {
    const _router = useRouter();
    const searchParams = useSearchParams();
    const statusParam = searchParams.get('status');
    const validTabs: TabType[] = useMemo(() => ['pending', 'current', 'delivered', 'cancelled'], []);
    const getTabFromStatusParam = useCallback((value: string | null): TabType => {
        if (!value) return 'current';
        return validTabs.includes(value as TabType) ? (value as TabType) : 'current';
    }, [validTabs]);

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromStatusParam(statusParam));
    const [searchQuery, setSearchQuery] = useState("");
    const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

    useEffect(() => {
        setActiveTab(getTabFromStatusParam(statusParam));
    }, [statusParam, getTabFromStatusParam]);

    useEffect(() => {
        loadOrders();
        const handleFocus = () => {
            loadOrders();
        };
        window.addEventListener("focus", handleFocus);
        return () => {
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const response = await authService.getMyOrders();
            if (response.success) {
                setOrders(response.data);
            }
        } catch (err: any) {
            console.error("Orders load error:", err);
            setError(err.message || "خطا در دریافت سفارشات");
        } finally {
            setLoading(false);
        }
    }

    const handleRetryPayment = async (orderId: string) => {
        try {
            setRetryingOrderId(orderId);
            const { default: api } = await import("@/lib/api");
            const response = await api.post(`/orders/${orderId}/pay`);

            if (response.data.success && response.data.data.paymentUrl) {
                window.location.href = response.data.data.paymentUrl;
            } else {
                alert("خطا در ایجاد درخواست پرداخت");
            }
        } catch (err: any) {
            console.error("Retry payment error:", err);
            alert(err?.response?.data?.message || "خطا در اتصال به درگاه پرداخت");
        } finally {
            setRetryingOrderId(null);
        }
    }

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'Pending':
                return { label: 'در انتظار پرداخت', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock };
            case 'Processing':
                return { label: 'درحال پردازش', color: 'text-blue-600', bg: 'bg-blue-50', icon: Box };
            case 'Shipped':
                return { label: 'تحویل به پست', color: 'text-purple-600', bg: 'bg-purple-50', icon: Truck };
            case 'Delivered':
                return { label: 'تحویل شده', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 };
            case 'Cancelled':
                return { label: 'لغو شده', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle };
            default:
                return { label: status, color: 'text-gray-600', bg: 'bg-gray-50', icon: AlertCircle };
        }
    }

    const filteredOrders = useMemo(() => {
        let filtered = orders;
        if (activeTab === 'pending') {
            filtered = filtered.filter(o => o.orderStatus === 'Pending');
        } else if (activeTab === 'current') {
            filtered = filtered.filter(o => ['Processing', 'Shipped'].includes(o.orderStatus));
        } else if (activeTab === 'delivered') {
            filtered = filtered.filter(o => o.orderStatus === 'Delivered');
        } else if (activeTab === 'cancelled') {
            filtered = filtered.filter(o => o.orderStatus === 'Cancelled');
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(o =>
                o._id.toLowerCase().includes(query) ||
                (o.orderCode && o.orderCode.toLowerCase().includes(query)) ||
                o.orderItems.some(item => item.name.toLowerCase().includes(query))
            );
        }
        return filtered;
    }, [orders, activeTab, searchQuery]);

    const counts = useMemo(() => {
        return {
            pending: orders.filter(o => o.orderStatus === 'Pending').length,
            current: orders.filter(o => ['Processing', 'Shipped'].includes(o.orderStatus)).length,
            delivered: orders.filter(o => o.orderStatus === 'Delivered').length,
            cancelled: orders.filter(o => o.orderStatus === 'Cancelled').length,
        };
    }, [orders]);

    const tabs = [
        { id: 'pending', label: 'در انتظار پرداخت', count: counts.pending },
        { id: 'current', label: 'جاری', count: counts.current },
        { id: 'delivered', label: 'تحویل شده', count: counts.delivered },
        { id: 'cancelled', label: 'لغو شده', count: counts.cancelled },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
                <div className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-8 animate-pulse">
                    {/* Header skeleton */}
                    <div className="bg-white lg:rounded-2xl lg:border lg:border-gray-100 p-4 lg:p-6">
                        <div className="h-6 w-40 bg-gray-200 rounded-lg mb-1" />
                        <div className="hidden lg:block h-3 w-28 bg-gray-100 rounded mt-2 mb-4" />
                        <div className="h-11 bg-gray-100 rounded-xl mt-4 lg:mt-5 lg:max-w-md" />
                        <div className="flex gap-2 mt-4 overflow-hidden">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-10 w-28 shrink-0 bg-gray-100 rounded-xl" />
                            ))}
                        </div>
                    </div>
                    {/* Cards skeleton */}
                    <div className="p-4 lg:p-0 lg:mt-6 grid gap-4 lg:gap-5 md:grid-cols-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                                        <div>
                                            <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                                            <div className="h-3 w-16 bg-gray-100 rounded" />
                                        </div>
                                    </div>
                                    <div className="h-4 w-20 bg-gray-200 rounded" />
                                </div>
                                <div className="flex gap-2 mb-4">
                                    {[1, 2, 3, 4].map(j => (
                                        <div key={j} className="w-14 h-14 lg:w-16 lg:h-16 bg-gray-100 rounded-xl" />
                                    ))}
                                </div>
                                <div className="h-10 bg-gray-100 rounded-xl" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
            <div className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-8">
            {/* ── Header: sticky app-bar on mobile, page card on desktop ── */}
            <div className="bg-white sticky top-0 z-20 shadow-sm md:static lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-sm lg:p-6 lg:pb-4">
                {/* Breadcrumb (desktop only) */}
                <nav className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                    <Link href="/profile" className="hover:text-kala-600 transition-colors">حساب کاربری</Link>
                    <ChevronRight size={14} className="rotate-180 shrink-0" />
                    <span className="text-gray-700 font-bold">سفارش‌های من</span>
                </nav>

                <div className="p-4 lg:p-0 flex items-center gap-3">
                    <Link href="/profile" className="lg:hidden p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronRight size={24} />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-lg lg:text-xl lg:font-black text-gray-800">سفارش‌های من</h1>
                        <p className="hidden lg:block text-xs text-gray-400 mt-1">
                            {orders.length > 0
                                ? `${orders.length.toLocaleString("fa-IR")} سفارش ثبت شده`
                                : "تاریخچه سفارش‌های شما"}
                        </p>
                    </div>
                    <span className="lg:hidden shrink-0 text-[11px] text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-bold">
                        {filteredOrders.length.toLocaleString("fa-IR")} مورد
                    </span>
                </div>

                <div className="px-4 pb-3 lg:p-0 lg:mt-5">
                    <div className="relative lg:max-w-md">
                        <input
                            type="text"
                            placeholder="جستجو در سفارش‌ها (کد سفارش، نام محصول...)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 border-none rounded-xl py-3 pr-10 pl-10 text-sm focus:ring-2 focus:ring-kala-500 transition-all"
                        />
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                aria-label="پاک کردن جستجو"
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 bg-gray-200/70 hover:bg-gray-200 rounded-full p-1 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs: underline rail on mobile, segmented control on desktop */}
                <div className="flex items-stretch lg:items-center gap-1 overflow-x-auto px-4 lg:px-0 pb-0 scrollbar-hide border-b border-gray-100 lg:border-b-0 lg:bg-gray-100/80 lg:rounded-2xl lg:p-1.5 lg:mt-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center justify-center gap-2 px-4 lg:px-5 py-4 lg:py-2.5 border-b-2 lg:border-0 transition-all whitespace-nowrap text-sm lg:text-[13px] lg:rounded-xl lg:flex-1 xl:flex-none ${activeTab === tab.id
                                ? "border-kala-600 text-kala-600 font-bold lg:bg-white lg:shadow-sm lg:text-kala-700"
                                : "border-transparent text-gray-500 font-medium hover:text-gray-700 lg:hover:bg-white/60"
                                }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${activeTab === tab.id ? "bg-kala-100 text-kala-700" : "bg-gray-100 text-gray-500"}`}>
                                {tab.count.toLocaleString("fa-IR")}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Orders grid: 1 col mobile, 2 col tablet/desktop ── */}
            <div className="p-4 lg:p-0 lg:mt-6">
                <div className="grid gap-4 lg:gap-5 md:grid-cols-2 items-start">
                {filteredOrders.length === 0 ? (
                    <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 lg:py-24 px-6 text-center">
                        <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <Box size={32} />
                        </div>
                        <p className="text-gray-600 font-bold mb-1.5">سفارشی در این بخش یافت نشد</p>
                        {searchQuery ? (
                            <p className="text-xs text-gray-400 mb-4">نتیجه‌ای برای جستجوی شما پیدا نشد</p>
                        ) : (
                            <p className="text-xs text-gray-400 mb-4">سفارش‌های شما در این بخش نمایش داده می‌شوند</p>
                        )}
                        {searchQuery ? (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-5 py-2.5 rounded-xl transition-colors"
                            >
                                پاک کردن جستجو
                            </button>
                        ) : (
                            <Link
                                href="/"
                                className="text-xs bg-kala-600 hover:bg-kala-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
                            >
                                مشاهده محصولات
                            </Link>
                        )}
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const status = getStatusInfo(order.orderStatus);
                        const StatusIcon = status.icon;

                        return (
                            <div key={order._id} className="bg-white rounded-2xl p-5 lg:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all min-w-0">
                                <div className="flex justify-between items-start gap-3 mb-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full ${status.bg} ${status.color} flex items-center justify-center shrink-0`}>
                                            <StatusIcon size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`block text-xs lg:text-[13px] font-bold ${status.color} mb-1`}>{status.label}</span>
                                            <span className="text-[10px] lg:text-[11px] text-gray-400 block">{new Date(order.createdAt).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <span className="block text-sm lg:text-base font-black text-gray-800 tabular-nums">
                                            {order.totalPrice.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-gray-400">تومان</span>
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-mono mt-1 block" dir="ltr">{order.orderCode || `#${order._id.slice(-6).toUpperCase()}`}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 lg:gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                                        {order.orderItems.map((item, idx) => (
                                            <div key={idx} title={item.name} className="shrink-0 w-14 h-14 lg:w-16 lg:h-16 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center relative overflow-hidden">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                                ) : (
                                                    <Box size={20} className="text-gray-300" />
                                                )}
                                                <span className="absolute bottom-0 right-0 bg-gray-900/80 text-white text-[8px] w-5 h-5 flex items-center justify-center rounded-tl-lg backdrop-blur-sm tabular-nums">
                                                    {item.quantity}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end pt-3 lg:pt-4 border-t border-gray-50 gap-2">
                                        {order.orderStatus === 'Pending' && (
                                            <button
                                                onClick={() => handleRetryPayment(order._id)}
                                                disabled={retryingOrderId === order._id}
                                                className="flex-1 sm:flex-none text-xs bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300 px-4 sm:px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm shadow-amber-100"
                                            >
                                                {retryingOrderId === order._id ? (
                                                    <Loader2 className="animate-spin" size={14} />
                                                ) : <CreditCard size={14} />}
                                                پرداخت مجدد
                                            </button>
                                        )}
                                        <Link
                                            href={`/profile/orders/${order._id}`}
                                            className={`${order.orderStatus === 'Pending' ? 'flex-1 sm:flex-none' : 'w-full sm:w-auto'} text-xs bg-kala-50 text-kala-600 hover:bg-kala-100 px-4 sm:px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1 transition-colors`}
                                        >
                                            مشاهده جزئیات <ChevronRight size={14} className="rotate-180" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                </div>
            </div>
            </div>
        </div>
    );
}
