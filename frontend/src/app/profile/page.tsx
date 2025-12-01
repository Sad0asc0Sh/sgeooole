"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Edit2, Wallet, ChevronLeft, Box, CheckCircle2, XCircle, RefreshCcw,
    UserCheck, Heart, MessageSquare, MapPin, Bell, Clock, LogOut, Camera, Lock, Mail, User as UserIcon
} from "lucide-react";
import { authService, User } from "@/services/authService";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit Profile State
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editLoading, setEditLoading] = useState(false);

    // Change Password State
    const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    // Bind Mobile State
    const [bindMobileSheetOpen, setBindMobileSheetOpen] = useState(false);
    const [bindMobile, setBindMobile] = useState("");
    const [bindOtp, setBindOtp] = useState(["", "", "", ""]);
    const [bindOtpSent, setBindOtpSent] = useState(false);
    const [bindLoading, setBindLoading] = useState(false);

    // Email OTP State
    const [emailOtpSheetOpen, setEmailOtpSheetOpen] = useState(false);
    const [emailOtp, setEmailOtp] = useState(["", "", "", ""]);
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);

    const [orderStats, setOrderStats] = useState({
        processing: 0,
        delivered: 0,
        returned: 0,
        cancelled: 0,
    });

    useEffect(() => {
        let isMounted = true;
        const loadUserData = async () => {
            try {
                if (!authService.isAuthenticated()) {
                    router.push("/login");
                    return;
                }
                setLoading(true);

                // Fetch Profile
                const profileData = await authService.getProfile();

                // Fetch Orders for Stats
                let stats = { processing: 0, delivered: 0, returned: 0, cancelled: 0 };
                try {
                    const ordersResponse = await authService.getMyOrders();
                    if (ordersResponse.success && Array.isArray(ordersResponse.data)) {
                        const orders = ordersResponse.data;
                        stats = {
                            processing: orders.filter((o: any) => ['Pending', 'Processing'].includes(o.orderStatus)).length,
                            delivered: orders.filter((o: any) => o.orderStatus === 'Delivered').length,
                            returned: orders.filter((o: any) => o.orderStatus === 'Returned').length,
                            cancelled: orders.filter((o: any) => o.orderStatus === 'Cancelled').length,
                        };
                    }
                } catch (orderErr) {
                    console.error("Error fetching orders for stats:", orderErr);
                    if (profileData.orderStats) {
                        stats = profileData.orderStats;
                    }
                }

                if (isMounted) {
                    setUser(profileData);
                    setOrderStats(stats);
                    setEditName(profileData.name || "");
                    setEditEmail(profileData.email || "");
                    setLoading(false);
                }
            } catch (err: any) {
                console.error("Profile load error:", err);
                if (isMounted) {
                    setError(err.message || "خطا در دریافت اطلاعات کاربر");
                    setLoading(false);
                    if (!authService.isAuthenticated()) router.push("/login");
                }
            }
        };
        loadUserData();
        return () => { isMounted = false; };
    }, [router]);

    // Sync edit state when sheet opens
    useEffect(() => {
        if (editSheetOpen && user) {
            setEditName(user.name || "");
            setEditEmail(user.email || "");
        }
    }, [editSheetOpen, user]);

    const handleLogout = () => {
        authService.logout();
    };

    // Bind Mobile Handlers
    const handleSendBindOtp = async () => {
        if (!bindMobile || bindMobile.length !== 11 || !bindMobile.startsWith("09")) {
            alert("لطفا شماره موبایل معتبر وارد کنید");
            return;
        }
        try {
            setBindLoading(true);
            await authService.sendBindOtp(bindMobile);
            setBindOtpSent(true);
        } catch (err: any) {
            alert(err.message || "خطا در ارسال کد تایید");
        } finally {
            setBindLoading(false);
        }
    };

    const handleVerifyBindOtp = async () => {
        const code = bindOtp.join("");
        if (code.length !== 4) {
            alert("لطفا کد تایید ۴ رقمی را وارد کنید");
            return;
        }
        try {
            setBindLoading(true);
            const response = await authService.verifyBindOtp(bindMobile, code);
            if (response.success && response.data?.user) {
                setUser(response.data.user);
                setBindMobileSheetOpen(false);
                alert("شماره موبایل با موفقیت ثبت شد");
            }
        } catch (err: any) {
            alert(err.message || "کد تایید نامعتبر است");
        } finally {
            setBindLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return;
        const newOtp = [...bindOtp];
        newOtp[index] = value;
        setBindOtp(newOtp);
        if (value && index < 3) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !bindOtp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    // Email OTP Handlers
    const handleSendEmailOtp = async () => {
        if (!editEmail || !/\S+@\S+\.\S+/.test(editEmail)) {
            alert("لطفا ایمیل معتبر وارد کنید");
            return;
        }
        try {
            setEmailLoading(true);
            await authService.sendEmailOtp(editEmail);
            setEmailOtpSent(true);
        } catch (err: any) {
            alert(err.message || "خطا در ارسال کد تایید");
        } finally {
            setEmailLoading(false);
        }
    };

    const handleVerifyEmailOtp = async () => {
        const code = emailOtp.join("");
        if (code.length !== 4) {
            alert("لطفا کد تایید ۴ رقمی را وارد کنید");
            return;
        }
        try {
            setEmailLoading(true);
            const response = await authService.verifyEmailOtp(editEmail, code);
            if (response.success && response.data?.user) {
                setUser(response.data.user);
                setEmailOtpSheetOpen(false);
                alert("ایمیل با موفقیت تغییر کرد");
            }
        } catch (err: any) {
            alert(err.message || "کد تایید نامعتبر است");
        } finally {
            setEmailLoading(false);
        }
    };

    const handleEmailOtpChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return;
        const newOtp = [...emailOtp];
        newOtp[index] = value;
        setEmailOtp(newOtp);
        if (value && index < 3) {
            const nextInput = document.getElementById(`email-otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleEmailOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !emailOtp[index] && index > 0) {
            const prevInput = document.getElementById(`email-otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleUpdateProfile = async () => {
        try {
            setEditLoading(true);

            // Update Name if changed
            if (editName !== user?.name) {
                const response = await authService.updateProfile({
                    name: editName,
                });
                if (response.success) {
                    setUser(prev => prev ? { ...prev, name: editName } : null);
                }
            }

            // Check Email Change
            if (editEmail !== user?.email) {
                setEditSheetOpen(false);
                setEmailOtpSheetOpen(true);
            } else {
                setEditSheetOpen(false);
            }

        } catch (err: any) {
            alert(err.message || "خطا در ویرایش پروفایل");
        } finally {
            setEditLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (newPassword.length < 6) {
            setPasswordError("رمز عبور باید حداقل ۶ کاراکتر باشد");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("تکرار رمز عبور مطابقت ندارد");
            return;
        }

        try {
            setPasswordLoading(true);
            setPasswordError("");
            await authService.updateProfile({ password: newPassword });
            setPasswordSheetOpen(false);
            setNewPassword("");
            setConfirmPassword("");
            alert("رمز عبور با موفقیت تغییر کرد");
        } catch (err: any) {
            setPasswordError(err.message || "خطا در تغییر رمز عبور");
        } finally {
            setPasswordLoading(false);
        }
    };

    const isVerified = !!user?.nationalCode;
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const res = await import("@/lib/api").then(m => m.default.get('/notifications'));
                if (res.data.success) {
                    const unread = res.data.data.filter((n: any) => !n.isRead).length;
                    setUnreadCount(unread);
                }
            } catch (error) {
                console.error("Error fetching notification count:", error);
            }
        };

        if (authService.isAuthenticated()) {
            fetchUnreadCount();
        }
    }, []);

    const menuItems = [
        {
            icon: UserCheck,
            label: "اطلاعات‌حساب‌کاربری",
            status: isVerified ? "تایید شده" : "تکمیل نشده",
            statusColor: isVerified ? "text-green-600" : "text-red-500",
            href: "/profile/verification"
        },
        { icon: Heart, label: "علاقه‌مندی‌ها", href: "/profile/lists" },
        { icon: MessageSquare, label: "نقد و نظرات", href: "/profile/reviews" },
        { icon: MapPin, label: "آدرس‌ها", href: "/profile/addresses" },
        { icon: Bell, label: "پیغام‌ها", badge: unreadCount > 0 ? unreadCount : undefined, href: "/profile/messages" },
        { icon: Clock, label: "بازدیدهای اخیر", href: "/profile/recent" },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <p className="text-red-500 text-sm mb-4">{error || "خطا در بارگذاری اطلاعات"}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-vita-500 text-white rounded-lg text-sm">تلاش مجدد</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header Section */}
            <div className="bg-white p-6 pb-8 pt-8 rounded-b-[2.5rem] shadow-sm relative z-10">
                <div className="flex items-center gap-5">
                    <div className="relative">
                        <div
                            className="w-20 h-20 rounded-full bg-gray-100 border-4 border-white shadow-md overflow-hidden relative"
                        >
                            {user.avatar ? (
                                <img
                                    src={user.avatar.startsWith("http") ? user.avatar : `http://localhost:5000/${user.avatar}`}
                                    alt={user.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400">
                                    <UserIcon size={32} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        <h1 className="text-xl font-black text-gray-800 mb-1">{user.name || "کاربر مهمان"}</h1>
                        <p className="text-sm text-gray-400 font-mono mb-2">{user.mobile}</p>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditSheetOpen(true)}
                                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-full transition-colors font-bold"
                            >
                                ویرایش پروفایل
                            </button>

                            <button
                                onClick={() => setPasswordSheetOpen(true)}
                                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-full transition-colors font-bold"
                            >
                                تغییر رمز عبور
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Wallet Card */}
            <div className="px-4 -mt-6 mb-6 relative z-20">
                <div className="bg-gradient-to-r from-welf-900 to-gray-800 text-white p-5 rounded-2xl shadow-xl shadow-gray-200 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

                    <div className="flex flex-col gap-1.5 z-10">
                        <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium">
                            <Wallet size={14} className="text-vita-400" /> موجودی کیف پول
                        </span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black tracking-tight">{(user.wallet || 0).toLocaleString("fa-IR")}</span>
                            <span className="text-xs text-gray-400">تومان</span>
                        </div>
                    </div>

                    <button className="z-10 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all border border-white/10 active:scale-95">
                        افزایش موجودی
                    </button>
                </div>
            </div>

            {/* Order Status */}
            <div className="bg-white mx-4 rounded-2xl p-5 shadow-sm mb-6 border border-gray-100">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                        <Box size={16} className="text-vita-600" />
                        سفارش‌های من
                    </h2>
                    <Link href="/profile/orders" className="text-[10px] text-gray-400 flex items-center gap-0.5 hover:text-vita-600 transition font-medium">
                        مشاهده همه <ChevronLeft size={12} />
                    </Link>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <OrderStatusItem icon={Box} label="جاری" count={orderStats.processing} active={orderStats.processing > 0} href="/profile/orders?status=current" />
                    <OrderStatusItem icon={CheckCircle2} label="تحویل شده" count={orderStats.delivered} href="/profile/orders?status=delivered" />
                    <OrderStatusItem icon={RefreshCcw} label="مرجوعی" count={orderStats.returned} href="/profile/orders?status=returned" />
                    <OrderStatusItem icon={XCircle} label="لغو شده" count={orderStats.cancelled} href="/profile/orders?status=cancelled" />
                </div>
            </div>

            {/* Menu Items */}
            <div className="bg-white mx-4 rounded-2xl shadow-sm overflow-hidden mb-8 border border-gray-100">
                {menuItems.map((item, idx) => (
                    <Link key={idx} href={item.href} className="block">
                        <div className="flex items-center justify-between p-4 border-b border-gray-50 last:border-none hover:bg-gray-50 cursor-pointer transition-colors group">
                            <div className="flex items-center gap-3.5">
                                <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center group-hover:bg-vita-50 group-hover:text-vita-600 transition-colors">
                                    <item.icon size={16} />
                                </div>
                                <span className="text-sm text-gray-700 font-bold group-hover:text-gray-900 transition-colors">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {item.status && (
                                    <span className={`text-[10px] font-bold ${item.statusColor || 'text-gray-400'}`}>{item.status}</span>
                                )}
                                {item.badge && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">{item.badge}</span>
                                )}
                                <ChevronLeft size={16} className="text-gray-300 group-hover:text-vita-500 transition-colors" />
                            </div>
                        </div>
                    </Link>
                ))}

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between p-4 hover:bg-red-50 cursor-pointer transition-colors group mt-2 border-t border-gray-100"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                            <LogOut size={16} />
                        </div>
                        <span className="text-sm text-red-500 font-bold">خروج از حساب کاربری</span>
                    </div>
                </button>
            </div>

            <div className="text-center mt-4 mb-24 text-[10px] text-gray-300 font-mono">
                WelfVita App v1.0.0
            </div>

            {/* Edit Profile Sheet */}
            <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">ویرایش اطلاعات کاربری</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">نام و نام خانوادگی</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all ${user?.googleId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={!!user?.googleId}
                                />
                                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Mobile Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">شماره موبایل</label>
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={user?.mobile || ""}
                                        disabled
                                        readOnly
                                        className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 pl-10 text-sm text-gray-500 cursor-not-allowed outline-none"
                                        dir="ltr"
                                        placeholder="شماره موبایل ثبت نشده"
                                    />
                                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                                {!user?.mobile && (
                                    <button
                                        onClick={() => {
                                            setEditSheetOpen(false);
                                            setBindMobileSheetOpen(true);
                                        }}
                                        className="bg-vita-500 text-white text-xs font-bold px-4 rounded-xl shadow-sm hover:bg-vita-600 transition-colors"
                                    >
                                        افزودن
                                    </button>
                                )}
                            </div>
                            {user?.mobile && (
                                <p className="text-[10px] text-gray-400 mt-1">امکان تغییر شماره موبایل وجود ندارد.</p>
                            )}
                        </div>

                        {/* Email Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">ایمیل</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all ${user?.googleId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    dir="ltr"
                                    disabled={!!user?.googleId}
                                />
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                            {user?.googleId ? (
                                <p className="text-[10px] text-amber-500 mt-1">اطلاعات حساب گوگل قابل تغییر نیست.</p>
                            ) : (
                                <p className="text-[10px] text-gray-400 mt-1">تغییر ایمیل نیازمند تایید کد ارسالی است.</p>
                            )}
                        </div>

                        {!user?.googleId && (
                            <button
                                onClick={handleUpdateProfile}
                                disabled={editLoading}
                                className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all"
                            >
                                {editLoading ? "در حال ذخیره..." : "ثبت تغییرات"}
                            </button>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Bind Mobile Sheet */}
            <Sheet open={bindMobileSheetOpen} onOpenChange={setBindMobileSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">افزودن شماره موبایل</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        {!bindOtpSent ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">شماره موبایل</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={bindMobile}
                                            onChange={(e) => setBindMobile(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-left"
                                            dir="ltr"
                                            placeholder="09xxxxxxxxx"
                                            maxLength={11}
                                        />
                                        <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2">
                                        یک کد تایید برای احراز هویت به این شماره ارسال خواهد شد.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSendBindOtp}
                                    disabled={bindLoading || !bindMobile}
                                    className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bindLoading ? "در حال ارسال..." : "ارسال کد تایید"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">کد تایید به شماره {bindMobile} ارسال شد.</p>
                                    <button onClick={() => setBindOtpSent(false)} className="text-xs text-vita-500 font-bold mt-1">ویرایش شماره</button>
                                </div>
                                <div className="flex justify-center gap-3 mb-6" dir="ltr">
                                    {bindOtp.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`otp-${index}`}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                            className="w-12 h-12 border-2 border-gray-200 rounded-xl text-center text-xl font-bold focus:border-vita-500 focus:ring-4 focus:ring-vita-100 outline-none transition-all"
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={handleVerifyBindOtp}
                                    disabled={bindLoading || bindOtp.some(d => !d)}
                                    className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bindLoading ? "در حال بررسی..." : "تایید و ثبت شماره"}
                                </button>
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Email OTP Sheet */}
            <Sheet open={emailOtpSheetOpen} onOpenChange={setEmailOtpSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">تایید تغییر ایمیل</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        {!emailOtpSent ? (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">
                                        آیا از تغییر ایمیل به <span className="font-bold dir-ltr inline-block">{editEmail}</span> اطمینان دارید؟
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        یک کد تایید به این ایمیل ارسال خواهد شد.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSendEmailOtp}
                                    disabled={emailLoading}
                                    className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {emailLoading ? "در حال ارسال..." : "ارسال کد تایید"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">کد تایید به ایمیل {editEmail} ارسال شد.</p>
                                    <button onClick={() => setEmailOtpSent(false)} className="text-xs text-vita-500 font-bold mt-1">ویرایش ایمیل</button>
                                </div>
                                <div className="flex justify-center gap-3 mb-6" dir="ltr">
                                    {emailOtp.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`email-otp-${index}`}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleEmailOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleEmailOtpKeyDown(index, e)}
                                            className="w-12 h-12 border-2 border-gray-200 rounded-xl text-center text-xl font-bold focus:border-vita-500 focus:ring-4 focus:ring-vita-100 outline-none transition-all"
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={handleVerifyEmailOtp}
                                    disabled={emailLoading || emailOtp.some(d => !d)}
                                    className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {emailLoading ? "در حال بررسی..." : "تایید و ثبت ایمیل"}
                                </button>
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Change Password Sheet */}
            <Sheet open={passwordSheetOpen} onOpenChange={setPasswordSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">تغییر رمز عبور</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">رمز عبور جدید</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    dir="ltr"
                                />
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">تکرار رمز عبور جدید</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    dir="ltr"
                                />
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                        {passwordError && (
                            <p className="text-xs text-red-500 text-center">{passwordError}</p>
                        )}
                        <button
                            onClick={handleUpdatePassword}
                            disabled={passwordLoading}
                            className="w-full bg-welf-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-gray-200 mt-4 active:scale-95 transition-all"
                        >
                            {passwordLoading ? "در حال تغییر..." : "تغییر رمز عبور"}
                        </button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function OrderStatusItem({ icon: Icon, label, count, active = false, href }: any) {
    const content = (
        <div className="flex flex-col items-center gap-2 cursor-pointer group select-none">
            <div className="relative">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${active ? 'bg-vita-50 text-vita-600 shadow-sm shadow-vita-100' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
                    <Icon size={20} strokeWidth={2} />
                </div>
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                        {count}
                    </span>
                )}
            </div>
            <span className={`text-[10px] font-bold transition-colors ${active ? 'text-gray-800' : 'text-gray-500 group-hover:text-gray-700'}`}>{label}</span>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }
    return content;
}
