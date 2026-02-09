"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Edit2, Wallet, ChevronLeft, Box, CheckCircle2, XCircle, CreditCard,
    UserCheck, Heart, MessageSquare, MapPin, Bell, Clock, LogOut, Camera, Lock, Mail, User as UserIcon, Headphones
} from "lucide-react";
import { authService, User } from "@/services/authService";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// ============================================
// Skeleton Components for Fast Initial Render
// ============================================
const ProfileSkeleton = () => (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-12 animate-pulse">
        {/* Desktop Layout Container */}
        <div className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-8">
            <div className="lg:flex lg:gap-8">

                {/* Desktop Sidebar Skeleton */}
                <aside className="hidden lg:block lg:w-80 lg:flex-shrink-0">
                    <div className="space-y-6">
                        {/* User Card Skeleton */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="bg-gradient-to-br from-gray-200 to-gray-300 p-6">
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full bg-gray-300 mb-4" />
                                    <div className="h-6 w-32 bg-gray-300 rounded mb-2" />
                                    <div className="h-4 w-24 bg-gray-300 rounded" />
                                </div>
                            </div>
                            <div className="p-4 flex gap-2">
                                <div className="flex-1 h-10 bg-gray-200 rounded-xl" />
                                <div className="flex-1 h-10 bg-gray-200 rounded-xl" />
                            </div>
                        </div>

                        {/* Wallet Skeleton */}
                        <div className="bg-gray-300 p-6 rounded-2xl h-40" />

                        {/* Stats Skeleton */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                            <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex justify-between py-2 border-b border-gray-50">
                                        <div className="h-3 w-20 bg-gray-200 rounded" />
                                        <div className="h-4 w-8 bg-gray-200 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="lg:flex-1 lg:min-w-0">
                    {/* Mobile Header Skeleton */}
                    <div className="lg:hidden bg-white p-6 pb-8 pt-8 rounded-b-[2.5rem] shadow-sm">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 rounded-full bg-gray-200" />
                            <div className="flex-1">
                                <div className="h-6 w-32 bg-gray-200 rounded mb-2" />
                                <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                                <div className="flex gap-2">
                                    <div className="h-6 w-20 bg-gray-200 rounded-full" />
                                    <div className="h-6 w-24 bg-gray-200 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Wallet Skeleton */}
                    <div className="lg:hidden px-4 -mt-6 mb-6 relative z-20">
                        <div className="bg-gray-300 p-5 rounded-2xl h-24" />
                    </div>

                    {/* Orders Skeleton */}
                    <div className="bg-white mx-4 lg:mx-0 rounded-2xl p-5 lg:p-6 shadow-sm mb-6">
                        <div className="h-5 w-24 bg-gray-200 rounded mb-5" />
                        <div className="grid grid-cols-4 gap-2 lg:gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex flex-col items-center gap-2 lg:gap-3">
                                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-gray-200" />
                                    <div className="h-3 w-12 bg-gray-200 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Menu Skeleton */}
                    <div className="bg-white mx-4 lg:mx-0 rounded-2xl shadow-sm overflow-hidden mb-8">
                        {/* Desktop Grid */}
                        <div className="hidden lg:grid lg:grid-cols-2 lg:p-4 lg:gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="flex items-center gap-3.5 p-4 border border-gray-100 rounded-xl">
                                    <div className="w-10 h-10 rounded-xl bg-gray-200" />
                                    <div className="h-4 w-24 bg-gray-200 rounded" />
                                </div>
                            ))}
                        </div>
                        {/* Mobile List */}
                        <div className="lg:hidden">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="flex items-center justify-between p-4 border-b border-gray-50">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                                        <div className="h-4 w-24 bg-gray-200 rounded" />
                                    </div>
                                    <div className="w-4 h-4 bg-gray-200 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>
);

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
        pending: 0,
        processing: 0,
        delivered: 0,
        cancelled: 0,
        total: 0,
    });

    const [unreadCount, setUnreadCount] = useState(0);

    // ============================================
    // OPTIMIZED: Load all data in parallel
    // ============================================
    useEffect(() => {
        let isMounted = true;

        const loadUserData = async () => {
            // Quick check - don't wait for async
            if (!authService.isAuthenticated()) {
                router.push("/login");
                return;
            }

            try {
                // 🚀 OPTIMIZATION: Use getMyOrderStats for FAST order counting
                // This uses aggregation on backend instead of fetching all orders
                const [profileData, orderStatsRes, notificationsRes] = await Promise.all([
                    authService.getProfile(),
                    authService.getMyOrderStats().catch(() => ({ success: false, data: { pending: 0, processing: 0, delivered: 0, cancelled: 0, total: 0 } })),
                    import("@/lib/api").then(m => m.default.get('/notifications')).catch(() => ({ data: { success: false, data: [] } }))
                ]);

                if (!isMounted) return;

                // Process profile
                setUser(profileData);
                setEditName(profileData.name || "");
                setEditEmail(profileData.email || "");

                // Process order stats (already aggregated from backend)
                if (orderStatsRes.success && orderStatsRes.data) {
                    setOrderStats(orderStatsRes.data);
                } else if (profileData.orderStats) {
                    const stats = profileData.orderStats as any;
                    setOrderStats({
                        pending: stats.pending || 0,
                        processing: stats.processing || 0,
                        delivered: stats.delivered || 0,
                        cancelled: stats.cancelled || 0,
                        total: stats.total || 0,
                    });
                }

                // Process notifications
                if (notificationsRes?.data?.success) {
                    const unread = notificationsRes.data.data.filter((n: any) => !n.isRead).length;
                    setUnreadCount(unread);
                }

                setLoading(false);
            } catch (err: any) {
                console.error("Profile load error:", err);
                if (isMounted) {
                    // Check if it's a network error vs auth error
                    const isNetworkError = err.message?.includes('Network') ||
                        err.message?.includes('ECONNREFUSED') ||
                        err.code === 'ERR_NETWORK';
                    const isAuthError = err.response?.status === 401;

                    if (isAuthError) {
                        // Token is invalid/expired - redirect to login
                        authService.logout();
                        return;
                    }

                    // For network errors, show error with retry option
                    setError(isNetworkError
                        ? "اتصال به سرور برقرار نیست. لطفاً اتصال اینترنت خود را بررسی کنید."
                        : (err.message || "خطا در دریافت اطلاعات کاربر"));
                    setLoading(false);
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

    const handleLogout = useCallback(() => {
        authService.logout();
    }, []);

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

    const handleOtpChange = useCallback((index: number, value: string) => {
        if (isNaN(Number(value))) return;
        setBindOtp(prev => {
            const newOtp = [...prev];
            newOtp[index] = value;
            return newOtp;
        });
        if (value && index < 3) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    }, []);

    const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !bindOtp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    }, [bindOtp]);

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

    const handleEmailOtpChange = useCallback((index: number, value: string) => {
        if (isNaN(Number(value))) return;
        setEmailOtp(prev => {
            const newOtp = [...prev];
            newOtp[index] = value;
            return newOtp;
        });
        if (value && index < 3) {
            const nextInput = document.getElementById(`email-otp-${index + 1}`);
            nextInput?.focus();
        }
    }, []);

    const handleEmailOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !emailOtp[index] && index > 0) {
            const prevInput = document.getElementById(`email-otp-${index - 1}`);
            prevInput?.focus();
        }
    }, [emailOtp]);

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

    // Memoize menu items to prevent re-renders
    const menuItems = useMemo(() => [
        {
            icon: UserCheck,
            label: "اطلاعات‌حساب‌کاربری",
            status: isVerified ? "تایید شده" : "تکمیل نشده",
            statusColor: isVerified ? "text-green-600" : "text-red-500",
            href: "/profile/verification"
        },
        { icon: Heart, label: "علاقه‌مندی‌ها", href: "/profile/lists" },
        { icon: MessageSquare, label: "نقد و نظرات", href: "/profile/reviews" },
        { icon: Headphones, label: "پشتیبانی", href: "/profile/tickets" },
        { icon: MapPin, label: "آدرس‌ها", href: "/profile/addresses" },
        { icon: Bell, label: "پیغام‌ها", badge: unreadCount > 0 ? unreadCount : undefined, href: "/profile/messages" },
        { icon: Clock, label: "بازدیدهای اخیر", href: "/profile/recent" },
    ], [isVerified, unreadCount]);

    // 🚀 OPTIMIZATION: Show skeleton immediately while loading
    if (loading) {
        return <ProfileSkeleton />;
    }

    if (error || !user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <p className="text-red-500 text-sm mb-4">{error || "خطا در بارگذاری اطلاعات"}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-kala-500 text-white rounded-lg text-sm">تلاش مجدد</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
            {/* Desktop Layout Container */}
            <div className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-8">
                <div className="lg:flex lg:gap-8">

                    {/* ============================================ */}
                    {/* DESKTOP SIDEBAR - Sticky on large screens */}
                    {/* ============================================ */}
                    <aside className="hidden lg:block lg:w-80 lg:flex-shrink-0">
                        <div className="lg:sticky lg:top-24 space-y-6">
                            {/* User Card - Desktop */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                {/* Profile Header with Gradient */}
                                <div className="bg-gradient-to-br from-kala-500 via-kala-600 to-ekg-800 p-6 relative overflow-hidden">
                                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                                    <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-xl" />

                                    <div className="relative z-10 flex flex-col items-center text-center">
                                        <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm p-1 mb-4 shadow-lg">
                                            <div className="w-full h-full rounded-full bg-white overflow-hidden">
                                                {user.avatar ? (
                                                    <img
                                                        src={user.avatar.startsWith("http") ? user.avatar : `http://localhost:5000/${user.avatar}`}
                                                        alt={user.name}
                                                        className="w-full h-full object-cover"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400">
                                                        <UserIcon size={40} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <h1 className="text-xl font-black text-white mb-1">{user.name || "کاربر مهمان"}</h1>
                                        <p className="text-sm text-white/70 font-mono tracking-wider">{user.mobile}</p>
                                    </div>
                                </div>

                                {/* Action Buttons - Desktop */}
                                <div className="p-4 flex gap-2">
                                    <button
                                        onClick={() => setEditSheetOpen(true)}
                                        className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl transition-colors font-bold flex items-center justify-center gap-1.5"
                                    >
                                        <Edit2 size={14} />
                                        ویرایش پروفایل
                                    </button>
                                    <button
                                        onClick={() => setPasswordSheetOpen(true)}
                                        className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl transition-colors font-bold flex items-center justify-center gap-1.5"
                                    >
                                        <Lock size={14} />
                                        تغییر رمز عبور
                                    </button>
                                </div>
                            </div>

                            {/* Wallet Card - Desktop */}
                            <div className="bg-gradient-to-br from-ekg-900 via-gray-800 to-gray-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                                <div className="absolute -right-8 -top-8 w-40 h-40 bg-kala-500/20 rounded-full blur-3xl" />
                                <div className="absolute -left-6 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                            <Wallet size={20} className="text-kala-400" />
                                        </div>
                                        <span className="text-sm text-gray-300 font-medium">موجودی کیف پول</span>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-5">
                                        <span className="text-3xl font-black tracking-tight">{(user.wallet || 0).toLocaleString("fa-IR")}</span>
                                        <span className="text-sm text-gray-400">تومان</span>
                                    </div>
                                    <button className="w-full bg-kala-500 hover:bg-kala-600 text-white text-sm font-bold py-3 px-5 rounded-xl transition-all shadow-lg shadow-kala-500/25 active:scale-95">
                                        افزایش موجودی
                                    </button>
                                </div>
                            </div>

                            {/* User Stats Summary - Desktop Only */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <h3 className="font-bold text-sm text-gray-800 mb-4">خلاصه فعالیت</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                        <span className="text-xs text-gray-500">تعداد سفارش‌ها</span>
                                        <span className="text-sm font-bold text-gray-800">{orderStats.total.toLocaleString("fa-IR")}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                        <span className="text-xs text-gray-500">تحویل شده</span>
                                        <span className="text-sm font-bold text-green-600">{orderStats.delivered.toLocaleString("fa-IR")}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-xs text-gray-500">در حال پردازش</span>
                                        <span className="text-sm font-bold text-blue-600">{orderStats.processing.toLocaleString("fa-IR")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* ============================================ */}
                    {/* MAIN CONTENT */}
                    {/* ============================================ */}
                    <main className="lg:flex-1 lg:min-w-0">
                        {/* ============================================ */}
                        {/* MOBILE ONLY: Header Section */}
                        {/* ============================================ */}
                        <div className="lg:hidden bg-white p-6 pb-8 pt-8 rounded-b-[2.5rem] shadow-sm relative z-10">
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

                        {/* ============================================ */}
                        {/* MOBILE ONLY: Wallet Card */}
                        {/* ============================================ */}
                        <div className="lg:hidden px-4 -mt-6 mb-6 relative z-20">
                            <div className="bg-gradient-to-r from-ekg-900 to-gray-800 text-white p-5 rounded-2xl shadow-xl shadow-gray-200 flex items-center justify-between relative overflow-hidden">
                                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

                                <div className="flex flex-col gap-1.5 z-10">
                                    <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium">
                                        <Wallet size={14} className="text-kala-400" /> موجودی کیف پول
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

                        {/* ============================================ */}
                        {/* Order Status - Both Mobile & Desktop */}
                        {/* ============================================ */}
                        <div className="bg-white mx-4 lg:mx-0 rounded-2xl p-5 lg:p-6 shadow-sm mb-6 border border-gray-100">
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="font-bold text-sm lg:text-base text-gray-800 flex items-center gap-2">
                                    <Box size={16} className="text-kala-600 lg:w-5 lg:h-5" />
                                    سفارش‌های من
                                </h2>
                                <Link href="/profile/orders" className="text-[10px] lg:text-xs text-gray-400 flex items-center gap-0.5 hover:text-kala-600 transition font-medium">
                                    مشاهده همه <ChevronLeft size={12} className="lg:w-4 lg:h-4" />
                                </Link>
                            </div>
                            <div className="grid grid-cols-4 gap-2 lg:gap-4">
                                <OrderStatusItem icon={CreditCard} label="در انتظار پرداخت" count={orderStats.pending} active={orderStats.pending > 0} href="/profile/orders?status=pending" />
                                <OrderStatusItem icon={Box} label="جاری" count={orderStats.processing} active={orderStats.processing > 0} href="/profile/orders?status=current" />
                                <OrderStatusItem icon={CheckCircle2} label="تحویل شده" count={orderStats.delivered} href="/profile/orders?status=delivered" />
                                <OrderStatusItem icon={XCircle} label="لغو شده" count={orderStats.cancelled} href="/profile/orders?status=cancelled" />
                            </div>
                        </div>

                        {/* ============================================ */}
                        {/* Menu Items - Both Mobile & Desktop */}
                        {/* ============================================ */}
                        <div className="bg-white mx-4 lg:mx-0 rounded-2xl shadow-sm overflow-hidden mb-8 border border-gray-100">
                            {/* Desktop: Grid layout for menu items */}
                            <div className="hidden lg:grid lg:grid-cols-2 lg:p-4 lg:gap-3">
                                {menuItems.map((item, idx) => (
                                    <Link key={idx} href={item.href} className="block">
                                        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-kala-200 hover:bg-kala-50/50 cursor-pointer transition-all group">
                                            <div className="flex items-center gap-3.5">
                                                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center group-hover:bg-kala-100 group-hover:text-kala-600 transition-colors">
                                                    <item.icon size={20} />
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-700 font-bold group-hover:text-gray-900 transition-colors block">{item.label}</span>
                                                    {item.status && (
                                                        <span className={`text-[10px] font-medium ${item.statusColor || 'text-gray-400'}`}>{item.status}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.badge && (
                                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">{item.badge}</span>
                                                )}
                                                <ChevronLeft size={18} className="text-gray-300 group-hover:text-kala-500 transition-colors" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Mobile: List layout for menu items */}
                            <div className="lg:hidden">
                                {menuItems.map((item, idx) => (
                                    <Link key={idx} href={item.href} className="block">
                                        <div className="flex items-center justify-between p-4 border-b border-gray-50 last:border-none hover:bg-gray-50 cursor-pointer transition-colors group">
                                            <div className="flex items-center gap-3.5">
                                                <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center group-hover:bg-kala-50 group-hover:text-kala-600 transition-colors">
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
                                                <ChevronLeft size={16} className="text-gray-300 group-hover:text-kala-500 transition-colors" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Logout Button - Both */}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-between p-4 hover:bg-red-50 cursor-pointer transition-colors group mt-2 border-t border-gray-100"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full lg:rounded-xl bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                        <LogOut size={16} className="lg:w-5 lg:h-5" />
                                    </div>
                                    <span className="text-sm text-red-500 font-bold">خروج از حساب کاربری</span>
                                </div>
                            </button>
                        </div>

                        <div className="text-center mt-4 mb-24 lg:mb-8 text-[10px] lg:text-xs text-gray-300 font-mono">
                            EkgKala App v1.0.0
                        </div>
                    </main>
                </div>
            </div>

            {/* Edit Profile Sheet */}
            <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">ویرایش سریع اطلاعات کاربری</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">نام و نام خانوادگی</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none transition-all ${user?.googleId ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                        className="bg-kala-500 text-white text-xs font-bold px-4 rounded-xl shadow-sm hover:bg-kala-600 transition-colors"
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
                                    className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none transition-all ${user?.googleId ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4 active:scale-95 transition-all"
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
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none transition-all text-left"
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
                                    className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bindLoading ? "در حال ارسال..." : "ارسال کد تایید"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">کد تایید به شماره {bindMobile} ارسال شد.</p>
                                    <button onClick={() => setBindOtpSent(false)} className="text-xs text-kala-500 font-bold mt-1">ویرایش شماره</button>
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
                                            className="w-12 h-12 border-2 border-gray-200 rounded-xl text-center text-xl font-bold focus:border-kala-500 focus:ring-4 focus:ring-kala-100 outline-none transition-all"
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={handleVerifyBindOtp}
                                    disabled={bindLoading || bindOtp.some(d => !d)}
                                    className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {emailLoading ? "در حال ارسال..." : "ارسال کد تایید"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">کد تایید به ایمیل {editEmail} ارسال شد.</p>
                                    <button onClick={() => setEmailOtpSent(false)} className="text-xs text-kala-500 font-bold mt-1">ویرایش ایمیل</button>
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
                                            className="w-12 h-12 border-2 border-gray-200 rounded-xl text-center text-xl font-bold focus:border-kala-500 focus:ring-4 focus:ring-kala-100 outline-none transition-all"
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={handleVerifyEmailOtp}
                                    disabled={emailLoading || emailOtp.some(d => !d)}
                                    className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none transition-all"
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
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none transition-all"
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
                            className="w-full bg-ekg-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-gray-200 mt-4 active:scale-95 transition-all"
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
        <div className="flex flex-col items-center gap-2 lg:gap-3 cursor-pointer group select-none">
            <div className="relative">
                <div className={`w-12 h-12 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${active ? 'bg-kala-50 text-kala-600 shadow-sm shadow-kala-100' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
                    <Icon size={20} strokeWidth={2} className="lg:w-6 lg:h-6" />
                </div>
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] lg:text-xs font-bold w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                        {count}
                    </span>
                )}
            </div>
            <span className={`text-[10px] lg:text-xs font-bold transition-colors text-center max-w-[55px] lg:max-w-[80px] leading-tight ${active ? 'text-gray-800' : 'text-gray-500 group-hover:text-gray-700'}`}>{label}</span>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }
    return content;
}
