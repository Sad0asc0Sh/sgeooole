"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Send, Instagram, Video, Phone, MapPin, Clock, Mail, Loader2, CheckCircle, AlertCircle,
    ChevronUp, Truck, Headphones, Shield, Award, Package, CreditCard
} from "lucide-react";
import { settingsService } from "@/services/settingsService";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface StoreInfo {
    storeName?: string;
    storePhone?: string;
    storeAddress?: string;
    socialLinks?: {
        telegram?: string;
        instagram?: string;
        aparat?: string;
    };
}

export default function Footer() {
    const [storeInfo, setStoreInfo] = useState<StoreInfo>({});
    const { isAuthenticated } = useAuth();
    const [showBackToTop, setShowBackToTop] = useState(false);
    const orderTrackingHref = isAuthenticated ? "/profile/orders?status=current" : "/tracking";

    // Newsletter state
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
    const [newsletterMessage, setNewsletterMessage] = useState("");

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await settingsService.getPublicSettings();
                const settings = (response as any).settings || (response as any).data?.settings;

                if (settings) {
                    setStoreInfo({
                        storeName: settings.storeName,
                        storePhone: settings.storePhone,
                        storeAddress: settings.storeAddress,
                        socialLinks: settings.socialLinks,
                    });
                }
            } catch (error) {
                console.error("Error fetching store info:", error);
            }
        };
        fetchSettings();
    }, []);

    // Back to top button visibility
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 300);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleNewsletterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            setNewsletterStatus("error");
            setNewsletterMessage("فرمت ایمیل نامعتبر است");
            return;
        }

        setIsSubmitting(true);
        setNewsletterStatus("idle");

        try {
            const response = await api.post("/newsletter/subscribe", { email, source: "footer" });
            setNewsletterStatus("success");
            setNewsletterMessage(response.data?.message || "عضویت با موفقیت انجام شد");
            setEmail("");
        } catch (error: any) {
            setNewsletterStatus("error");
            setNewsletterMessage(error.response?.data?.message || "خطا در عضویت");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <footer className="bg-gray-100 mt-8 mb-16 lg:mb-0">
                {/* Features Section - Desktop Only */}
                <div className="hidden lg:block bg-white border-y border-gray-200">
                    <div className="container mx-auto px-4 py-8">
                        <div className="grid grid-cols-4 gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-kala-400 to-kala-600 flex items-center justify-center shadow-lg">
                                    <Truck size={24} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">ارسال سریع</h4>
                                    <p className="text-xs text-gray-500">تحویل اکسپرس در کمتر از ۲۴ ساعت</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                                    <Headphones size={24} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">پشتیبانی ۲۴/۷</h4>
                                    <p className="text-xs text-gray-500">همیشه در کنار شما هستیم</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                                    <Shield size={24} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">ضمانت اصالت کالا</h4>
                                    <p className="text-xs text-gray-500">۱۰۰٪ اورجینال و گارانتی معتبر</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                                    <CreditCard size={24} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">پرداخت امن</h4>
                                    <p className="text-xs text-gray-500">درگاه پرداخت معتبر و ایمن</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Footer Content */}
                <div className="bg-[#142755] pt-10 pb-6">
                    <div className="container mx-auto px-4">
                        {/* Desktop: 4 Column Grid, Mobile: Stack */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">

                            {/* Column 1: About / Contact */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-white text-lg mb-4">
                                    {storeInfo.storeName || "ای‌کا‌جی کالا"}
                                </h3>

                                {storeInfo.storePhone && (
                                    <a
                                        href={`tel:${storeInfo.storePhone.replace(/\s/g, '')}`}
                                        className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-kala-500/20 flex items-center justify-center">
                                            <Phone size={18} className="text-kala-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-400">تماس با ما</span>
                                            <span className="text-white font-bold text-sm ltr" dir="ltr">
                                                {storeInfo.storePhone}
                                            </span>
                                        </div>
                                    </a>
                                )}

                                {storeInfo.storeAddress && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                            <MapPin size={18} className="text-blue-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-400 mb-1">آدرس</span>
                                            <p className="text-gray-300 text-sm leading-relaxed">
                                                {storeInfo.storeAddress}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <Clock size={18} className="text-amber-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400">ساعت کاری</span>
                                        <span className="text-gray-300 text-sm">
                                            روزهای کاری ۹ تا ۲۱
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Quick Links */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-white text-lg mb-4">دسترسی سریع</h3>
                                <ul className="space-y-3 text-sm text-gray-300">
                                    <li>
                                        <Link href="/products" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            محصولات
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/categories" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            دسته‌بندی‌ها
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/blog" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            بلاگ
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/about" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            درباره ما
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/contact" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            تماس با ما
                                        </Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Column 3: Customer Service */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-white text-lg mb-4">خدمات مشتریان</h3>
                                <ul className="space-y-3 text-sm text-gray-300">
                                    <li>
                                        <Link href={orderTrackingHref} className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            پیگیری سفارش
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/terms" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            قوانین و مقررات
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/faq" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            سوالات متداول
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href={isAuthenticated ? "/profile" : "/login"} className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            حساب کاربری
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/cart" className="hover:text-kala-400 transition-colors flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-kala-400"></span>
                                            سبد خرید
                                        </Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Column 4: Newsletter & Social */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Mail size={20} className="text-kala-400" />
                                    <h3 className="font-bold text-white text-lg">خبرنامه</h3>
                                </div>
                                <p className="text-sm text-gray-400 mb-4">
                                    از جدیدترین محصولات و تخفیفات ویژه باخبر شوید
                                </p>

                                {newsletterStatus === "success" ? (
                                    <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400">
                                        <CheckCircle size={20} />
                                        <span className="text-sm">{newsletterMessage}</span>
                                    </div>
                                ) : (
                                    <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    if (newsletterStatus === "error") setNewsletterStatus("idle");
                                                }}
                                                placeholder="ایمیل خود را وارد کنید"
                                                className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none transition-all ${newsletterStatus === "error"
                                                    ? "border-red-500 focus:border-red-400"
                                                    : "border-white/10 focus:border-kala-500"
                                                    }`}
                                                dir="ltr"
                                                disabled={isSubmitting}
                                            />
                                            <button
                                                type="submit"
                                                disabled={isSubmitting || !email.trim()}
                                                className="w-full rounded-xl bg-gradient-to-r from-kala-500 to-kala-600 px-6 py-3 text-white font-bold hover:from-kala-600 hover:to-kala-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-kala-500/25"
                                            >
                                                {isSubmitting ? (
                                                    <Loader2 size={18} className="animate-spin" />
                                                ) : (
                                                    <>
                                                        <Mail size={18} />
                                                        <span>عضویت در خبرنامه</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {newsletterStatus === "error" && (
                                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                                <AlertCircle size={16} />
                                                <span>{newsletterMessage}</span>
                                            </div>
                                        )}
                                    </form>
                                )}

                                {/* Social Media Links */}
                                <div className="pt-4">
                                    <h4 className="text-white text-sm font-bold mb-3">ما را دنبال کنید</h4>
                                    <div className="flex gap-3">
                                        {storeInfo.socialLinks?.telegram && (
                                            <a
                                                href={storeInfo.socialLinks.telegram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                                                title="تلگرام"
                                            >
                                                <Send size={18} />
                                            </a>
                                        )}
                                        {storeInfo.socialLinks?.instagram && (
                                            <a
                                                href={storeInfo.socialLinks.instagram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                                                title="اینستاگرام"
                                            >
                                                <Instagram size={18} />
                                            </a>
                                        )}
                                        {storeInfo.socialLinks?.aparat && (
                                            <a
                                                href={storeInfo.socialLinks.aparat}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                                                title="آپارات"
                                            >
                                                <Video size={18} />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Trust Seals - Desktop */}
                                <div className="hidden lg:flex gap-3 pt-4">
                                    <div className="w-20 h-20 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-400 hover:shadow-lg transition-shadow">
                                        eNamad
                                    </div>
                                    <div className="w-20 h-20 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-400 hover:shadow-lg transition-shadow">
                                        Samandehi
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Section - Copyright */}
                        <div className="border-t border-white/10 pt-6 mt-6">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <p className="text-sm text-gray-400 text-center md:text-right">
                                    تمامی حقوق این وب‌سایت متعلق به فروشگاه ای‌کا‌جی کالا می‌باشد
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span>طراحی و توسعه توسط sadraSh</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Back to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-20 left-4 lg:bottom-8 lg:left-8 z-50 w-12 h-12 rounded-full bg-gradient-to-r from-kala-500 to-kala-600 text-white shadow-lg shadow-kala-500/50 flex items-center justify-center hover:scale-110 transition-transform animate-bounce"
                    aria-label="بازگشت به بالا"
                >
                    <ChevronUp size={24} />
                </button>
            )}
        </>
    );
}
