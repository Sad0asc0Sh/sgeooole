"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Package, MapPin, CreditCard, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { orderService, Order } from "@/services/orderService";

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.id as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await orderService.getById(orderId);

                if (response.success && response.data) {
                    setOrder(response.data);
                } else {
                    setError(response.message || "خطا در دریافت اطلاعات سفارش");
                }
            } catch (err: any) {
                console.error("[ORDER] Error fetching order:", err);
                setError(err.message || "خطا در دریافت اطلاعات سفارش");
            } finally {
                setLoading(false);
            }
        };

        if (orderId) {
            fetchOrder();
        }
    }, [orderId]);

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-amber-600" size={48} />
                <p className="text-sm text-gray-500">در حال دریافت اطلاعات سفارش...</p>
            </div>
        );
    }

    // Error State
    if (error || !order) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4">
                <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-red-500" size={40} />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">خطا در نمایش سفارش</h2>
                    <p className="text-gray-500 text-sm">{error || "سفارش مورد نظر یافت نشد"}</p>
                </div>
                <Link href="/" className="px-6 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors">
                    بازگشت به فروشگاه
                </Link>
            </div>
        );
    }

    // Order Status Badge
    const getStatusColor = (status: string) => {
        switch (status) {
            case "Pending":
                return "bg-yellow-100 text-yellow-700";
            case "Processing":
                return "bg-blue-100 text-blue-700";
            case "Shipped":
                return "bg-purple-100 text-purple-700";
            case "Delivered":
                return "bg-green-100 text-green-700";
            case "Cancelled":
                return "bg-red-100 text-red-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "Pending":
                return "در انتظار پرداخت";
            case "Processing":
                return "در حال پردازش";
            case "Shipped":
                return "ارسال شده";
            case "Delivered":
                return "تحویل داده شده";
            case "Cancelled":
                return "لغو شده";
            default:
                return status;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            {/* Header */}
            <header className="bg-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <h1 className="font-bold text-lg text-gray-900">جزئیات سفارش</h1>
                <Link href="/" className="p-2 bg-gray-100 rounded-full">
                    <ChevronLeft size={20} />
                </Link>
            </header>

            <div className="p-4 space-y-4">
                {/* Success Banner */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <CheckCircle size={28} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">سفارش با موفقیت ثبت شد!</h2>
                            <p className="text-sm text-white/90">کد سفارش: {order.orderCode || order._id.slice(-8)}</p>
                        </div>
                    </div>
                    <p className="text-sm text-white/90">
                        سفارش شما با موفقیت ثبت شد و در حال پردازش است. از خرید شما متشکریم!
                    </p>
                </div>

                {/* Order Status */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package size={20} className="text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">وضعیت سفارش</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.orderStatus)}`}>
                            {getStatusText(order.orderStatus)}
                        </span>
                    </div>
                </div>

                {/* Payment Info */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <CreditCard size={20} className="text-amber-600" />
                        <h3 className="font-bold text-gray-900">اطلاعات پرداخت</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">روش پرداخت</span>
                            <span className="font-medium text-gray-900">
                                {order.paymentMethod === "online" ? "پرداخت اینترنتی" : "پرداخت در محل"}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">وضعیت پرداخت</span>
                            <span className={`font-medium ${order.isPaid ? "text-green-600" : "text-yellow-600"}`}>
                                {order.isPaid ? "پرداخت شده" : "پرداخت نشده"}
                            </span>
                        </div>
                        {order.isPaid && order.paidAt && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">تاریخ پرداخت</span>
                                <span className="text-gray-900">
                                    {new Date(order.paidAt).toLocaleDateString("fa-IR")}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <MapPin size={20} className="text-amber-600" />
                        <h3 className="font-bold text-gray-900">آدرس تحویل گیرنده</h3>
                    </div>
                    <div className="space-y-1 text-sm">
                        <p className="font-medium text-gray-900">{order.shippingAddress.fullName}</p>
                        <p className="text-gray-600">{order.shippingAddress.phone}</p>
                        <p className="text-gray-600">
                            {order.shippingAddress.province && `${order.shippingAddress.province}، `}
                            {order.shippingAddress.city}
                        </p>
                        <p className="text-gray-600">{order.shippingAddress.address}</p>
                        <p className="text-gray-600">کد پستی: {order.shippingAddress.postalCode}</p>
                    </div>
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3">محصولات ({order.orderItems.length})</h3>
                    <div className="space-y-3">
                        {order.orderItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-0">
                                <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                    <p className="text-xs text-gray-500">تعداد: {item.quantity}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-bold text-gray-900">
                                        {(item.price * item.quantity).toLocaleString("fa-IR")}
                                    </p>
                                    <p className="text-xs text-gray-500">تومان</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Price Summary */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3">خلاصه قیمت</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>قیمت کالاها</span>
                            <span>{order.itemsPrice.toLocaleString("fa-IR")} تومان</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>هزینه ارسال</span>
                            <span>{order.shippingPrice.toLocaleString("fa-IR")} تومان</span>
                        </div>
                        {order.taxPrice > 0 && (
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>مالیات</span>
                                <span>{order.taxPrice.toLocaleString("fa-IR")} تومان</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                            <span>مبلغ کل</span>
                            <span className="text-amber-600">{order.totalPrice.toLocaleString("fa-IR")} تومان</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                    <Link
                        href="/"
                        className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl text-center hover:bg-gray-200 transition-colors"
                    >
                        بازگشت به فروشگاه
                    </Link>
                </div>
            </div>
        </div>
    );
}
