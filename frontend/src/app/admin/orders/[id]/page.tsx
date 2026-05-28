"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ChevronRight, Box, Clock, CheckCircle2, XCircle, Truck, AlertCircle,
    User, MapPin, CreditCard, Save, Package, ExternalLink, Hash, Info
} from "lucide-react";
import { orderService, Order } from "@/services/orderService";

// تایپ برای اطلاعات پیک که از تنظیمات سایت دریافت می‌شود
interface CourierTemplate {
    _id?: string;
    name: string;
    trackingUrlTemplate: string;
    isActive: boolean;
}

export default function AdminOrderDetailsPage() {
    const params = useParams();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [couriers, setCouriers] = useState<CourierTemplate[]>([]);

    // فرم وضعیت سفارش
    const [status, setStatus] = useState("");
    const [trackingCode, setTrackingCode] = useState("");
    const [selectedCourier, setSelectedCourier] = useState<CourierTemplate | null>(null);
    const [adminNotes, setAdminNotes] = useState("");

    // لینک پیش‌نمایش که با درج کد رهگیری ساخته می‌شود
    const previewTrackingUrl = selectedCourier && trackingCode
        ? selectedCourier.trackingUrlTemplate.replace("{{code}}", trackingCode)
        : "";

    useEffect(() => {
        loadOrder();
        loadCouriers();
    }, []);

    const loadOrder = async () => {
        try {
            setLoading(true);
            const response = await orderService.getById(params.id as string);
            if (response.success && response.data) {
                setOrder(response.data);
                setStatus(response.data.orderStatus);
                setTrackingCode(response.data.trackingCode || "");
                setAdminNotes(response.data.adminNotes || "");
            }
        } catch (err) {
            console.error("Error loading order:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadCouriers = async () => {
        try {
            const res = await fetch("/api/settings/public");
            const data = await res.json();
            const activeCouriers: CourierTemplate[] = (data?.data?.shippingSettings?.couriers || [])
                .filter((c: CourierTemplate) => c.isActive);
            setCouriers(activeCouriers);
        } catch (err) {
            console.error("Error loading couriers:", err);
        }
    };

    const handleCourierChange = (courierName: string) => {
        const courier = couriers.find(c => c.name === courierName) || null;
        setSelectedCourier(courier);
    };

    const handleUpdateStatus = async () => {
        if (!order) return;
        try {
            setUpdating(true);

            // ساخت لینک رهگیری نهایی
            const finalTrackingUrl = previewTrackingUrl || order.preparedTrackingUrl || "";

            await orderService.updateStatus(order._id, {
                status,
                trackingCode: trackingCode || undefined,
                courierName: selectedCourier?.name || order.courierName || undefined,
                preparedTrackingUrl: finalTrackingUrl || undefined,
                adminNotes: adminNotes || undefined,
            });

            alert("✅ وضعیت سفارش با موفقیت به‌روزرسانی شد");
            loadOrder();
        } catch (err: any) {
            alert(err.message || "خطا در به‌روزرسانی وضعیت");
        } finally {
            setUpdating(false);
        }
    };

    const getStatusInfo = (s: string) => {
        switch (s) {
            case 'Pending': return { label: 'در انتظار پرداخت', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Clock };
            case 'Processing': return { label: 'درحال پردازش', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Box };
            case 'Shipped': return { label: 'تحویل به پست', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: Truck };
            case 'Delivered': return { label: 'تحویل شده', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCircle2 };
            case 'Cancelled': return { label: 'لغو شده', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle };
            default: return { label: s, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: AlertCircle };
        }
    };

    if (loading) return (
        <div className="p-16 text-center">
            <div className="w-10 h-10 border-4 border-kala-200 border-t-kala-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">در حال بارگذاری اطلاعات سفارش...</p>
        </div>
    );

    if (!order) return (
        <div className="p-8 text-center text-red-500 font-bold">سفارش یافت نشد</div>
    );

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
                        سفارش <span className="font-mono text-kala-600">#{order.orderCode || order._id.slice(-6).toUpperCase()}</span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        ثبت در {new Date(order.createdAt).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* وضعیت فعلی */}
                <div className={`mr-auto px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 ${currentStatus.bg} ${currentStatus.color}`}>
                    <currentStatus.icon size={16} />
                    {currentStatus.label}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ستون چپ: اقلام و اطلاعات */}
                <div className="lg:col-span-2 space-y-6">

                    {/* اقلام سفارش */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Box size={20} className="text-kala-600" />
                            اقلام سفارش
                        </h2>
                        <div className="space-y-3">
                            {order.orderItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="w-14 h-14 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Box size={22} className="text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 text-sm truncate">{item.name}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">تعداد: {item.quantity} عدد</p>
                                    </div>
                                    <div className="text-left flex-shrink-0">
                                        <p className="font-bold text-gray-800 text-sm">
                                            {(item.price * item.quantity).toLocaleString('fa-IR')}
                                            <span className="text-[10px] font-normal text-gray-400 mr-1">تومان</span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-gray-500 font-bold">مبلغ کل سفارش</span>
                            <span className="text-xl font-black text-gray-800">
                                {order.totalPrice.toLocaleString('fa-IR')}
                                <span className="text-sm font-normal text-gray-400 mr-1">تومان</span>
                            </span>
                        </div>
                    </div>

                    {/* اطلاعات مشتری و آدرس */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User size={18} className="text-kala-600" />
                                مشتری
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-xs text-gray-400 block mb-0.5">نام</span>
                                    <span className="font-bold text-gray-800">{(order as any).user?.name || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-400 block mb-0.5">موبایل</span>
                                    <span className="font-mono text-gray-800">{(order as any).user?.mobile || order.shippingAddress?.phone || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-400 block mb-0.5">ایمیل</span>
                                    <span className="font-mono text-gray-600 text-xs">{(order as any).user?.email || "-"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <MapPin size={18} className="text-kala-600" />
                                آدرس تحویل
                            </h2>
                            <div className="text-sm">
                                <p className="text-gray-700 leading-relaxed mb-3">
                                    {order.shippingAddress.province && `${order.shippingAddress.province}، `}
                                    {order.shippingAddress.city}، {order.shippingAddress.address}
                                    {(order.shippingAddress as any).plaque && `، پلاک ${(order.shippingAddress as any).plaque}`}
                                    {(order.shippingAddress as any).unit && `، واحد ${(order.shippingAddress as any).unit}`}
                                </p>
                                <div className="flex gap-4">
                                    <div>
                                        <span className="text-xs text-gray-400 block mb-0.5">کد پستی</span>
                                        <span className="font-mono text-gray-800 text-sm">{order.shippingAddress.postalCode}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block mb-0.5">گیرنده</span>
                                        <span className="font-bold text-gray-800 text-sm">{order.shippingAddress.fullName}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* اطلاعات رهگیری فعلی (اگر وجود داشته باشد) */}
                    {order.trackingCode && (
                        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                            <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                                <Package size={18} />
                                اطلاعات ارسال
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                {order.courierName && (
                                    <div>
                                        <span className="text-xs text-purple-500 block mb-1">شرکت حمل‌ونقل</span>
                                        <span className="font-bold text-purple-900">{order.courierName}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-xs text-purple-500 block mb-1">کد رهگیری</span>
                                    <span className="font-mono font-bold text-purple-900">{order.trackingCode}</span>
                                </div>
                                {order.preparedTrackingUrl && (
                                    <div>
                                        <span className="text-xs text-purple-500 block mb-1">لینک رهگیری</span>
                                        <a
                                            href={order.preparedTrackingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-700 hover:text-purple-900 underline flex items-center gap-1"
                                        >
                                            <ExternalLink size={13} />
                                            مشاهده در سایت پیک
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ستون راست: مدیریت وضعیت */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-24">
                        <h2 className="font-bold text-gray-800 mb-5 flex items-center gap-2">
                            <CreditCard size={20} className="text-kala-600" />
                            مدیریت سفارش
                        </h2>

                        {/* تغییر وضعیت */}
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-gray-500 mb-2">تغییر وضعیت</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none"
                            >
                                <option value="Pending">در انتظار پرداخت</option>
                                <option value="Processing">درحال پردازش</option>
                                <option value="Shipped">تحویل به پست</option>
                                <option value="Delivered">تحویل شده</option>
                                <option value="Cancelled">لغو شده</option>
                            </select>
                        </div>

                        {/* بخش اطلاعات ارسال (فقط وقتی Shipped انتخاب شده) */}
                        {status === 'Shipped' && (
                            <div className="space-y-4 mb-5 p-4 bg-purple-50 border border-purple-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                                <h3 className="text-xs font-bold text-purple-700 flex items-center gap-1.5">
                                    <Truck size={14} />
                                    اطلاعات ارسال به پست
                                </h3>

                                {/* انتخاب شرکت پیک */}
                                {couriers.length > 0 ? (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                                            انتخاب شرکت حمل‌ونقل
                                        </label>
                                        <select
                                            value={selectedCourier?.name || order.courierName || ""}
                                            onChange={(e) => handleCourierChange(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                                        >
                                            <option value="">-- انتخاب پیک --</option>
                                            {couriers.map((c, idx) => (
                                                <option key={idx} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                        {selectedCourier && (
                                            <p className="text-[10px] text-gray-400 mt-1 font-mono truncate">
                                                الگوی لینک: {selectedCourier.trackingUrlTemplate}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                                        <Info size={13} className="mt-0.5 flex-shrink-0" />
                                        <span>
                                            هنوز شرکت پیکی تعریف نشده. از{" "}
                                            <Link href="/admin/settings" className="underline font-bold">تنظیمات ارسال</Link>
                                            {" "}شرکت‌های پیک را اضافه کنید.
                                        </span>
                                    </div>
                                )}

                                {/* کد رهگیری */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                                        <Hash size={12} />
                                        کد رهگیری
                                    </label>
                                    <input
                                        type="text"
                                        value={trackingCode}
                                        onChange={(e) => setTrackingCode(e.target.value)}
                                        placeholder="کد پیگیری مرسوله را وارد کنید"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-mono text-left"
                                        dir="ltr"
                                    />
                                </div>

                                {/* پیش‌نمایش لینک رهگیری */}
                                {previewTrackingUrl && (
                                    <div className="bg-white border border-purple-200 rounded-xl p-3">
                                        <p className="text-[10px] text-purple-500 mb-1 font-bold">لینک رهگیری که به کاربر نمایش داده می‌شود:</p>
                                        <a
                                            href={previewTrackingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-700 hover:text-purple-900 underline break-all flex items-center gap-1"
                                        >
                                            <ExternalLink size={11} />
                                            {previewTrackingUrl}
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* یادداشت ادمین */}
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-gray-500 mb-2">یادداشت داخلی ادمین</label>
                            <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="یادداشت داخلی (کاربر نمی‌بیند)"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none resize-none min-h-[70px]"
                            />
                        </div>

                        {/* دکمه ذخیره */}
                        <button
                            onClick={handleUpdateStatus}
                            disabled={updating}
                            className="w-full bg-kala-600 text-white py-3 rounded-xl font-bold hover:bg-kala-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

                        {/* اطلاعات پرداخت */}
                        <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">وضعیت پرداخت:</span>
                                <span className={`font-bold ${order.isPaid ? "text-green-600" : "text-red-500"}`}>
                                    {order.isPaid ? "✅ پرداخت شده" : "❌ پرداخت نشده"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">روش پرداخت:</span>
                                <span className="font-bold text-gray-700">
                                    {order.paymentMethod === "cod" ? "پرداخت در محل" : "پرداخت آنلاین"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
