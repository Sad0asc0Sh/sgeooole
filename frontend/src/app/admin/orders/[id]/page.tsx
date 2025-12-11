"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ChevronRight, Box, Clock, CheckCircle2, XCircle, Truck, AlertCircle,
    User, MapPin, Phone, Calendar, CreditCard, Save
} from "lucide-react";
import { authService } from "@/services/authService";

export default function AdminOrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    // Form State
    const [status, setStatus] = useState("");
    const [trackingCode, setTrackingCode] = useState("");

    useEffect(() => {
        loadOrder();
    }, []);

    const loadOrder = async () => {
        try {
            setLoading(true);
            const response = await authService.getOrder(params.id as string);
            if (response.success) {
                setOrder(response.data);
                setStatus(response.data.orderStatus);
                setTrackingCode(response.data.trackingCode || "");
            }
            setLoading(false);
        } catch (err) {
            console.error("Error loading order:", err);
            setLoading(false);
        }
    };

    const handleUpdateStatus = async () => {
        try {
            setUpdating(true);
            await authService.updateOrderStatus(order._id, status, trackingCode);
            alert("وضعیت سفارش با موفقیت به‌روزرسانی شد");
            loadOrder(); // Refresh
        } catch (err: any) {
            alert(err.message || "خطا در به‌روزرسانی وضعیت");
        } finally {
            setUpdating(false);
        }
    };

    const getStatusInfo = (s: string) => {
        switch (s) {
            case 'Pending': return { label: 'در انتظار پرداخت', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock };
            case 'Processing': return { label: 'درحال پردازش', color: 'text-blue-600', bg: 'bg-blue-50', icon: Box };
            case 'Shipped': return { label: 'تحویل به پست', color: 'text-purple-600', bg: 'bg-purple-50', icon: Truck };
            case 'Delivered': return { label: 'تحویل شده', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 };
            case 'Cancelled': return { label: 'لغو شده', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle };
            default: return { label: s, color: 'text-gray-600', bg: 'bg-gray-50', icon: AlertCircle };
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">در حال بارگذاری...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">سفارش یافت نشد</div>;

    const currentStatus = getStatusInfo(order.orderStatus);

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/orders" className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <ChevronRight size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        سفارش <span className="font-mono text-gray-500">#{order._id.slice(-6).toUpperCase()}</span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        ثبت شده در {new Date(order.createdAt).toLocaleDateString('fa-IR')} ساعت {new Date(order.createdAt).toLocaleTimeString('fa-IR')}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Order Items & Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Box size={20} className="text-vita-600" />
                            اقلام سفارش
                        </h2>
                        <div className="space-y-4">
                            {order.orderItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Box size={24} className="text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-800 text-sm mb-1">{item.name}</h3>
                                        <p className="text-xs text-gray-500">تعداد: {item.quantity} عدد</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-800 text-sm">
                                            {(item.price * item.quantity).toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-gray-400">تومان</span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-gray-500 font-bold">مبلغ کل سفارش</span>
                            <span className="text-xl font-black text-gray-800">
                                {order.totalPrice.toLocaleString('fa-IR')} <span className="text-sm font-normal text-gray-400">تومان</span>
                            </span>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <User size={20} className="text-vita-600" />
                            اطلاعات مشتری
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">نام و نام خانوادگی</label>
                                <p className="text-sm font-bold text-gray-800">{order.user?.name}</p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">شماره تماس</label>
                                <p className="text-sm font-bold text-gray-800 font-mono">{order.user?.mobile || order.shippingAddress?.phone}</p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">ایمیل</label>
                                <p className="text-sm font-bold text-gray-800 font-mono">{order.user?.email || "-"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <MapPin size={20} className="text-vita-600" />
                            آدرس تحویل
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4">
                            {order.shippingAddress.province}، {order.shippingAddress.city}، {order.shippingAddress.address}
                            {order.shippingAddress.plaque && `، پلاک ${order.shippingAddress.plaque}`}
                            {order.shippingAddress.unit && `، واحد ${order.shippingAddress.unit}`}
                        </p>
                        <div className="flex gap-6">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">کد پستی</label>
                                <p className="text-sm font-bold text-gray-800 font-mono">{order.shippingAddress.postalCode}</p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">گیرنده</label>
                                <p className="text-sm font-bold text-gray-800">{order.shippingAddress.fullName}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-24">
                        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <CreditCard size={20} className="text-vita-600" />
                            وضعیت سفارش
                        </h2>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 mb-2">تغییر وضعیت</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none"
                            >
                                <option value="Pending">در انتظار پرداخت</option>
                                <option value="Processing">درحال پردازش</option>
                                <option value="Shipped">تحویل به پست</option>
                                <option value="Delivered">تحویل شده</option>
                                <option value="Cancelled">لغو شده</option>
                            </select>
                        </div>

                        {status === 'Shipped' && (
                            <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                                <label className="block text-xs font-bold text-gray-500 mb-2">کد رهگیری پستی</label>
                                <input
                                    type="text"
                                    value={trackingCode}
                                    onChange={(e) => setTrackingCode(e.target.value)}
                                    placeholder="کد ۲۴ رقمی پست"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none font-mono text-left"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">این کد برای کاربر ارسال خواهد شد.</p>
                            </div>
                        )}

                        <button
                            onClick={handleUpdateStatus}
                            disabled={updating}
                            className="w-full bg-vita-600 text-white py-3 rounded-xl font-bold hover:bg-vita-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {updating ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    ذخیره تغییرات
                                </>
                            )}
                        </button>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <div className="flex justify-between items-center text-sm mb-2">
                                <span className="text-gray-500">وضعیت فعلی:</span>
                                <span className={`font-bold ${currentStatus.color}`}>{currentStatus.label}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">وضعیت پرداخت:</span>
                                <span className={`font-bold ${order.isPaid ? "text-green-600" : "text-red-500"}`}>
                                    {order.isPaid ? "پرداخت شده" : "پرداخت نشده"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
