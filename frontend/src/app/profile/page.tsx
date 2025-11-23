"use client";
import Link from "next/link";
import {
    Edit2, Wallet, ChevronLeft, Box, CheckCircle2, XCircle, RefreshCcw,
    UserCheck, Heart, MessageSquare, MapPin, Bell, Clock, LogOut
} from "lucide-react";

export default function ProfilePage() {
    // Mock User Data
    const user = {
        name: "کاربر ویلف‌ویتا",
        phone: "09123456789",
        walletBalance: 5400000,
        orders: { processing: 2, delivered: 12, returned: 0, canceled: 1 }
    };

    // CLEANED MENU ITEMS (No Subscription/Settings)
    const menuItems = [
        { icon: UserCheck, label: "احراز هویت", status: "تایید شده", statusColor: "text-green-600" },
        { icon: Heart, label: "لیست‌های من" },
        { icon: MessageSquare, label: "نقد و نظرات" },
        { icon: MapPin, label: "آدرس‌ها" },
        { icon: Bell, label: "پیغام‌ها", badge: 2 },
        { icon: Clock, label: "بازدیدهای اخیر" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-24">

            {/* 1. Header (Name & Edit) */}
            <div className="bg-white p-5 pb-8 pt-8">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-bold text-welf-900">{user.name}</h1>
                        <span className="text-sm text-gray-400 font-mono">{user.phone}</span>
                    </div>
                    <button className="text-vita-600 p-1 bg-vita-50 rounded-full">
                        <Edit2 size={18} />
                    </button>
                </div>
            </div>

            {/* 2. Wallet Card (Floating Overlay) */}
            <div className="px-4 -mt-4 mb-4">
                <div className="bg-welf-900 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-xl" />

                    <div className="flex flex-col gap-1 z-10">
                        <span className="text-xs text-gray-300 flex items-center gap-1">
                            <Wallet size={14} /> موجودی کیف پول
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold">{user.walletBalance.toLocaleString("fa-IR")}</span>
                            <span className="text-xs opacity-80">تومان</span>
                        </div>
                    </div>

                    <button className="z-10 bg-vita-500 hover:bg-vita-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors shadow-md shadow-vita-500/20 active:scale-95">
                        افزایش موجودی
                    </button>
                </div>
            </div>

            {/* 3. Order Status Row */}
            <div className="bg-white mx-4 rounded-2xl p-4 shadow-sm mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-sm text-gray-800">سفارش‌های من</h2>
                    <Link href="/profile/orders" className="text-[10px] text-gray-400 flex items-center gap-0.5 hover:text-vita-600 transition">
                        مشاهده همه <ChevronLeft size={12} />
                    </Link>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <OrderStatusItem icon={Box} label="جاری" count={user.orders.processing} active />
                    <OrderStatusItem icon={CheckCircle2} label="تحویل شده" count={user.orders.delivered} />
                    <OrderStatusItem icon={RefreshCcw} label="مرجوعی" count={user.orders.returned} />
                    <OrderStatusItem icon={XCircle} label="لغو شده" count={user.orders.canceled} />
                </div>
            </div>

            {/* 4. Vertical Menu List */}
            <div className="bg-white mx-4 rounded-2xl shadow-sm overflow-hidden mb-8">
                {menuItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-none hover:bg-gray-50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                            <item.icon size={20} className="text-gray-500" />
                            <span className="text-sm text-gray-700 font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {item.status && (
                                <span className={`text-[10px] ${item.statusColor || 'text-gray-400'}`}>{item.status}</span>
                            )}
                            {item.badge && (
                                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">{item.badge}</span>
                            )}
                            <ChevronLeft size={16} className="text-gray-300" />
                        </div>
                    </div>
                ))}

                {/* Logout Button */}
                <Link href="/login" className="flex items-center justify-between p-4 hover:bg-red-50 cursor-pointer transition-colors group mt-2 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <LogOut size={20} className="text-red-500" />
                        <span className="text-sm text-red-500 font-bold">خروج از حساب کاربری</span>
                    </div>
                </Link>
            </div>

            {/* Version Footer */}
            <div className="text-center mt-4 mb-24 text-[10px] text-gray-300 font-mono">
                WelfVita App v1.0.0
            </div>

        </div>
    );
}

// Helper Component for Order Status
function OrderStatusItem({ icon: Icon, label, count, active = false }: any) {
    return (
        <div className="flex flex-col items-center gap-2 cursor-pointer group select-none">
            <div className="relative">
                <Icon size={24} className={`group-hover:text-vita-600 transition-colors ${active ? 'text-vita-500' : 'text-gray-400'}`} strokeWidth={1.5} />
                {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-gray-100 text-gray-600 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                        {count}
                    </span>
                )}
            </div>
            <span className="text-[10px] text-gray-500 font-medium group-hover:text-gray-800 transition-colors">{label}</span>
        </div>
    );
}
