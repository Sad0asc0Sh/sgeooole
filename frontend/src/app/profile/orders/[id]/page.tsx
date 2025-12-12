"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MapPin, Phone, User, Calendar, CreditCard, Package, CheckCircle2, Circle, Clock, Truck } from "lucide-react";
import { authService } from "@/services/authService";

interface OrderDetail {
    _id: string;
    orderCode?: string; // Added orderCode
    orderStatus: string;
    totalPrice: number;
    itemsPrice: number;
    shippingPrice: number;
    taxPrice: number;
    totalDiscount?: number;
    paymentMethod: string;
    isPaid: boolean;
    paidAt?: string;
    createdAt: string;
    shippedAt?: string;
    deliveredAt?: string;
    trackingCode?: string;
    orderItems: {
        name: string;
        quantity: number;
        price: number;
        product: {
            _id: string;
            name: string;
            images: string[];
        };
    }[];
    shippingAddress: {
        fullName: string;
        address: string;
        city: string;
        postalCode: string;
        phone: string;
    };
}

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (params.id) {
            loadOrderDetails(params.id as string);
        }
    }, [params.id]);

    const loadOrderDetails = async (id: string) => {
        try {
            setLoading(true);
            // We need to add getOrderById to authService first, or use api directly
            // Since authService doesn't have it explicitly exposed for public/user yet in my previous edits (I only added getMyOrders)
            // But wait, getMyOrders returns a list. I need a single order.
            // I should check if I need to add getOrder to authService.
            // Looking at authService.ts, I haven't added getOrder yet.
            // I will implement it here using the api instance from authService if possible, or just add it to authService.
            // For now, I'll assume I'll add it to authService in the next step or use a direct call if I can import api.
            // Let's use authService.getOrder(id) and I will add it to authService.ts immediately after this.

            // Actually, I can just add it to authService.ts now.
            // But I am in write_to_file. I will write this file assuming authService.getOrder exists.
            const response = await authService.getOrder(id);
            if (response.success) {
                setOrder(response.data);
            }
            setLoading(false);
        } catch (err: any) {
            console.error("Order details load error:", err);
            setError(err.message || "خطا در دریافت جزئیات سفارش");
            setLoading(false);
        }
    };

    const steps = [
        { status: 'Pending', label: 'ثبت سفارش', icon: Calendar },
        { status: 'Processing', label: 'درحال پردازش', icon: Package },
        { status: 'Shipped', label: 'تحویل به پست', icon: Clock },
        { status: 'Delivered', label: 'تحویل شده', icon: CheckCircle2 },
    ];

    const getCurrentStepIndex = (status: string) => {
        if (status === 'Cancelled') return -1;
        const index = steps.findIndex(s => s.status === status);
        return index === -1 ? 0 : index; // Default to 0 if unknown
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <p className="text-red-500 text-sm mb-4">{error || "سفارش یافت نشد"}</p>
                    <button onClick={() => router.back()} className="px-6 py-2 bg-vita-500 text-white rounded-lg text-sm">بازگشت</button>
                </div>
            </div>
        );
    }

    const currentStepIndex = getCurrentStepIndex(order.orderStatus);
    const isCancelled = order.orderStatus === 'Cancelled';

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
                <Link href="/profile/orders" className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <ChevronRight size={24} />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">جزئیات سفارش</h1>
            </div>

            <div className="p-4 space-y-4">
                {/* Status Tracker */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-bold text-gray-700">کد سفارش: <span className="font-mono text-gray-900">{order.orderCode || order._id.slice(-6).toUpperCase()}</span></span>
                        <span className="text-xs text-gray-400 font-mono">{new Date(order.createdAt).toLocaleDateString('fa-IR')}</span>
                    </div>

                    {isCancelled ? (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center font-bold text-sm">
                            این سفارش لغو شده است
                        </div>
                    ) : (
                        <div className="relative flex justify-between items-center px-2">
                            {/* Progress Bar Background */}
                            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -z-10 mx-4" />
                            {/* Active Progress Bar */}
                            <div
                                className="absolute top-1/2 right-0 h-1 bg-vita-500 -z-10 mx-4 transition-all duration-500"
                                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                            />

                            {steps.map((step, idx) => {
                                const isActive = idx <= currentStepIndex;
                                const isCurrent = idx === currentStepIndex;
                                const Icon = step.icon;

                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 bg-white px-1">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'bg-vita-500 border-vita-500 text-white' : 'bg-white border-gray-200 text-gray-300'}`}>
                                            <Icon size={14} />
                                        </div>
                                        <span className={`text-[10px] font-bold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Tracking Code Section - Enhanced */}
                    {order.trackingCode && (
                        <div className="mt-6 relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-50 -mr-16 -mt-16"></div>

                            <div className="relative space-y-4">
                                {/* Header */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 shrink-0">
                                        <Truck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-sm mb-0.5">کد رهگیری مرسوله پستی</h3>
                                        <p className="text-[11px] text-gray-500">برای پیگیری وضعیت مرسوله، از این کد استفاده کنید</p>
                                    </div>
                                </div>

                                {/* Tracking Code Display */}
                                <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4">
                                    <div className="text-center mb-3">
                                        <span className="font-mono font-black text-base sm:text-lg text-gray-800 tracking-wider select-all break-all leading-relaxed">
                                            {order.trackingCode}
                                        </span>
                                    </div>
                                    <a
                                        href="https://tracking.post.ir/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-all text-sm font-bold shadow-blue-200 shadow-lg"
                                    >
                                        <span>پیگیری در سایت پست</span>
                                        <ChevronRight size={16} className="rotate-180" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h2 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                        <Package size={16} className="text-vita-600" />
                        اقلام سفارش
                    </h2>
                    <div className="space-y-4">
                        {order.orderItems.map((item, idx) => (
                            <div key={idx} className="flex gap-3 py-2 border-b border-gray-50 last:border-none">
                                <div className="w-16 h-16 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center shrink-0">
                                    {/* Image placeholder */}
                                    <Package size={24} className="text-gray-300" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xs font-bold text-gray-800 leading-relaxed mb-1">{item.name}</h3>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{item.quantity} عدد</span>
                                        <span className="text-xs font-black text-gray-800">
                                            {item.price.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-gray-400">تومان</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shipping Info */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h2 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                        <MapPin size={16} className="text-vita-600" />
                        اطلاعات ارسال
                    </h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                            <User size={16} className="text-gray-400 mt-0.5" />
                            <span className="text-gray-600">{order.shippingAddress.fullName}</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <Phone size={16} className="text-gray-400 mt-0.5" />
                            <span className="text-gray-600">{order.shippingAddress.phone}</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin size={16} className="text-gray-400 mt-0.5" />
                            <span className="text-gray-600 leading-relaxed">
                                {order.shippingAddress.city}، {order.shippingAddress.address}
                                <br />
                                <span className="text-xs text-gray-400">کد پستی: {order.shippingAddress.postalCode}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h2 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                        <CreditCard size={16} className="text-vita-600" />
                        جزئیات پرداخت
                    </h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500">
                            <span>مبلغ کل کالاها</span>
                            <span>{order.itemsPrice.toLocaleString('fa-IR')} تومان</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                            <span>هزینه ارسال</span>
                            <span>{order.shippingPrice === 0 ? 'رایگان' : `${order.shippingPrice.toLocaleString('fa-IR')} تومان`}</span>
                        </div>
                        {order.taxPrice > 0 && (
                            <div className="flex justify-between text-gray-500">
                                <span>مالیات</span>
                                <span>{order.taxPrice.toLocaleString('fa-IR')} تومان</span>
                            </div>
                        )}
                        {order.totalDiscount && order.totalDiscount > 0 && (
                            <div className="flex justify-between text-red-500 font-bold">
                                <span>سود شما از این خرید</span>
                                <span>{order.totalDiscount.toLocaleString('fa-IR')} تومان</span>
                            </div>
                        )}
                        <div className="border-t border-gray-100 my-2 pt-2 flex justify-between font-black text-gray-800 text-base">
                            <span>مبلغ قابل پرداخت</span>
                            <span>{order.totalPrice.toLocaleString('fa-IR')} تومان</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 mt-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500">روش پرداخت</span>
                            <span className="text-xs font-bold text-gray-700">
                                {order.paymentMethod === 'online' ? 'پرداخت آنلاین' : 'پرداخت در محل'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
