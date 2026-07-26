"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MapPin, Phone, User, Calendar, CreditCard, Package, CheckCircle2, Clock, Truck, ExternalLink } from "lucide-react";
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
    courierName?: string;        // نام شرکت حمل‌ونقل
    preparedTrackingUrl?: string; // لینک آماده رهگیری
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

            const handleFocus = () => {
                loadOrderDetails(params.id as string);
            };
            window.addEventListener("focus", handleFocus);
            return () => {
                window.removeEventListener("focus", handleFocus);
            };
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
                    <button onClick={() => router.back()} className="px-6 py-2 bg-kala-500 text-white rounded-lg text-sm">بازگشت</button>
                </div>
            </div>
        );
    }

    const currentStepIndex = getCurrentStepIndex(order.orderStatus);
    const isCancelled = order.orderStatus === 'Cancelled';

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 md:static">
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
                        <div className="relative pt-2 pb-1">
                            {/* Progress Bar Background */}
                            <div className="absolute top-[18px] left-[12.5%] right-[12.5%] h-1 bg-gray-100 rounded-full z-0" />
                            {/* Active Progress Bar */}
                            <div
                                className="absolute top-[18px] right-[12.5%] h-1 bg-gradient-to-l from-kala-500 to-amber-500 rounded-full z-0 transition-all duration-500"
                                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 75}%` }}
                            />

                            <div className="relative z-10 flex justify-between items-start">
                                {steps.map((step, idx) => {
                                    const isActive = idx <= currentStepIndex;
                                    const isCurrent = idx === currentStepIndex;
                                    const Icon = step.icon;

                                    return (
                                        <div key={idx} className="flex flex-col items-center text-center w-1/4">
                                            {/* Circle Icon Wrapper */}
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white ${
                                                isCurrent
                                                    ? 'bg-kala-600 border-kala-600 text-white shadow-md shadow-kala-200 ring-4 ring-kala-100'
                                                    : isActive
                                                        ? 'bg-kala-500 border-kala-500 text-white shadow-sm'
                                                        : 'border-gray-200 text-gray-300'
                                            }`}>
                                                <Icon size={16} />
                                            </div>
                                            {/* Text Label */}
                                            <span className={`mt-2.5 text-[11px] sm:text-xs font-bold leading-snug text-center px-0.5 ${
                                                isCurrent
                                                    ? 'text-kala-700 font-black'
                                                    : isActive
                                                        ? 'text-gray-800'
                                                        : 'text-gray-400'
                                            }`}>
                                                {step.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tracking Code Section - Enhanced & Responsive */}
                    {(order.trackingCode || order.courierName || ['Shipped', 'Delivered'].includes(order.orderStatus)) && (
                        <div className="mt-6 relative overflow-hidden bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-5 shadow-sm">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-40 -mr-16 -mt-16" />

                            <div className="relative space-y-4">
                                {/* Header */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 shrink-0">
                                        <Truck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-sm mb-0.5">
                                            {order.courierName ? `ارسال با ${order.courierName}` : 'اطلاعات ارسال مرسوله'}
                                        </h3>
                                        <p className="text-[11px] text-gray-500">
                                            {order.preparedTrackingUrl ? 'برای پیگیری وضعیت مرسوله، روی دکمه زیر کلیک کنید' : 'تحویل به سفیر و پیک اختصاصی در شهر مبدا'}
                                        </p>
                                    </div>
                                </div>

                                {/* Tracking Code Display */}
                                <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4">
                                    {order.trackingCode && order.trackingCode !== order.courierName && (
                                        <div className="text-center mb-3">
                                            <p className="text-[10px] text-gray-400 mb-1">کد رهگیری / مرسوله</p>
                                            <span className="font-mono font-black text-base sm:text-lg text-gray-800 tracking-wider select-all break-all leading-relaxed">
                                                {order.trackingCode}
                                            </span>
                                        </div>
                                    )}
                                    {order.preparedTrackingUrl && order.preparedTrackingUrl.trim().length > 0 ? (
                                        <a
                                            href={order.preparedTrackingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg transition-all text-sm font-bold shadow-purple-200 shadow-lg"
                                        >
                                            <ExternalLink size={15} />
                                            <span>
                                                {order.courierName ? `پیگیری در سایت ${order.courierName}` : 'پیگیری آنلاین مرسوله'}
                                            </span>
                                        </a>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 w-full bg-purple-50 text-purple-800 border border-purple-200 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-center">
                                            <span>🚀 تحویل سفیر/پیک اختصاصی (ارسال در شهر مبدا - بدون لینک آنلاین)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h2 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                        <Package size={16} className="text-kala-600" />
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
                        <MapPin size={16} className="text-kala-600" />
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
                        <CreditCard size={16} className="text-kala-600" />
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
