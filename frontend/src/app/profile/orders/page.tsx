"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Box, Clock, CheckCircle2, XCircle, Truck, AlertCircle, Search, CreditCard, Filter } from "lucide-react";
import { authService } from "@/services/authService";

interface Order {
    _id: string;
    orderStatus: string;
    totalPrice: number;
    createdAt: string;
    orderItems: any[];
    shippingAddress: any;
}

type TabType = 'pending' | 'current' | 'delivered' | 'cancelled';

export default function OrdersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const statusParam = searchParams.get('status');

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>((statusParam as TabType) || 'current');
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (statusParam && ['pending', 'current', 'delivered', 'cancelled'].includes(statusParam)) {
            setActiveTab(statusParam as TabType);
        }
    }, [statusParam]);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const response = await authService.getMyOrders();
            if (response.success) {
                setOrders(response.data);
            }
            setLoading(false);
        } catch (err: any) {
            console.error("Orders load error:", err);
            setError(err.message || "خطا در دریافت سفارشات");
            setLoading(false);
        }
    };

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
    };

    // Filter Logic
    const filteredOrders = useMemo(() => {
        let filtered = orders;

        // 1. Filter by Tab
        if (activeTab === 'pending') {
            filtered = filtered.filter(o => o.orderStatus === 'Pending');
        } else if (activeTab === 'current') {
            filtered = filtered.filter(o => ['Processing', 'Shipped'].includes(o.orderStatus));
        } else if (activeTab === 'delivered') {
            filtered = filtered.filter(o => o.orderStatus === 'Delivered');
        } else if (activeTab === 'cancelled') {
            filtered = filtered.filter(o => o.orderStatus === 'Cancelled');
        }

        // 2. Filter by Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(o =>
                o._id.toLowerCase().includes(query) ||
                o.orderItems.some(item => item.name.toLowerCase().includes(query))
            );
        }

        return filtered;
    }, [orders, activeTab, searchQuery]);

    // Counts for Tabs
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white sticky top-0 z-20 shadow-sm">
                <div className="p-4 flex items-center gap-3 border-b border-gray-100">
                    <Link href="/profile" className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronRight size={24} />
                    </Link>
                    <h1 className="font-bold text-lg text-gray-800">سفارش‌های من</h1>
                </div>

                {/* Search Bar */}
                <div className="p-4 pb-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="جستجو در سفارش‌ها (کد سفارش، نام محصول...)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 border-none rounded-xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-vita-500 transition-all"
                        />
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center overflow-x-auto px-4 pb-0 scrollbar-hide border-b border-gray-100">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                ? "border-vita-600 text-vita-600 font-bold"
                                : "border-transparent text-gray-500 font-medium hover:text-gray-700"
                                }`}
                        >
                            <span className="text-sm">{tab.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-vita-100 text-vita-700" : "bg-gray-100 text-gray-500"
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <Box size={32} />
                        </div>
                        <p className="text-gray-500 font-medium mb-2">سفارشی در این بخش یافت نشد</p>
                        {searchQuery && <p className="text-xs text-gray-400">نتیجه‌ای برای جستجوی شما پیدا نشد</p>}
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const status = getStatusInfo(order.orderStatus);
                        const StatusIcon = status.icon;

                        return (
                            <div key={order._id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full ${status.bg} ${status.color} flex items-center justify-center`}>
                                            <StatusIcon size={18} />
                                        </div>
                                        <div>
                                            <span className={`block text-xs font-bold ${status.color} mb-1`}>{status.label}</span>
                                            <span className="text-[10px] text-gray-400 font-mono block">{new Date(order.createdAt).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm font-black text-gray-800">
                                            {order.totalPrice.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-gray-400">تومان</span>
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-mono mt-1 block">{order._id.slice(-6).toUpperCase()}#</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {order.orderItems.map((item, idx) => (
                                            <div key={idx} className="shrink-0 w-14 h-14 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center relative overflow-hidden">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Box size={20} className="text-gray-300" />
                                                )}
                                                <span className="absolute bottom-0 right-0 bg-gray-900/80 text-white text-[8px] w-5 h-5 flex items-center justify-center rounded-tl-lg backdrop-blur-sm">
                                                    {item.quantity}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end pt-3 border-t border-gray-50">
                                        <Link
                                            href={`/profile/orders/${order._id}`}
                                            className="text-xs bg-vita-50 text-vita-600 hover:bg-vita-100 px-4 py-2 rounded-lg font-bold flex items-center gap-1 transition-colors"
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
    );
}
