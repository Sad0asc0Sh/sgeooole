"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Send, Instagram, Video, Phone, MapPin, Clock, Mail, Loader2, CheckCircle, AlertCircle,
    ChevronUp, Truck, Headphones, Shield, CreditCard, ArrowLeft, Star
} from "lucide-react";
import { settingsService } from "@/services/settingsService";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface StoreInfo {
    storeName?: string;
    storeEmail?: string;
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

    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
    const [newsletterMessage, setNewsletterMessage] = useState("");

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await settingsService.getPublicSettings();
                setStoreInfo({
                    storeName: data.storeName,
                    storeEmail: data.storeEmail,
                    storePhone: data.storePhone,
                    storeAddress: data.storeAddress,
                    socialLinks: data.socialLinks,
                });
            } catch (error) {
                console.error("Error fetching store info:", error);
            }
        };
        fetchSettings();

        const handleSettingsUpdated = () => fetchSettings();
        window.addEventListener("settings:updated", handleSettingsUpdated);
        const handleFocus = () => fetchSettings();
        window.addEventListener("focus", handleFocus);

        return () => {
            window.removeEventListener("settings:updated", handleSettingsUpdated);
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

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
            <footer className="mt-8 mb-16 lg:mb-0" dir="rtl">

                {/* ═══ Trust Strip ═══ */}
                <div className="bg-white border-y border-gray-100 shadow-sm">
                    <div className="max-w-6xl mx-auto px-4 py-5">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { icon: <Truck size={22} className="text-white" />, color: "from-amber-400 to-orange-500", title: "ارسال سریع", desc: "تحویل اکسپرس ۲۴ ساعته" },
                                { icon: <Headphones size={22} className="text-white" />, color: "from-blue-400 to-blue-600", title: "پشتیبانی ۲۴/۷", desc: "همیشه در کنار شما" },
                                { icon: <Shield size={22} className="text-white" />, color: "from-emerald-400 to-green-600", title: "ضمانت اصالت", desc: "۱۰۰٪ اورجینال" },
                                { icon: <CreditCard size={22} className="text-white" />, color: "from-purple-400 to-purple-600", title: "پرداخت امن", desc: "درگاه معتبر و ایمن" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{item.title}</p>
                                        <p className="text-gray-400 text-xs">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ═══ Main Footer Body ═══ */}
                <div className="bg-[#0f2044] relative overflow-hidden rounded-t-3xl">

                    {/* Decorative gradient blobs */}
                    <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-6">

                        {/* ─── Row 1: Brand + nav columns ─── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/8">

                            {/* Brand / Contact */}
                            <div className="flex flex-col items-center md:items-start text-center md:text-right">
                                <div className="flex items-center gap-2 mb-4">
                                    <Star size={16} className="text-amber-400 fill-amber-400" />
                                    <h3 className="font-extrabold text-white text-xl tracking-wide">
                                        {storeInfo.storeName || "EKG KALA"}
                                    </h3>
                                    <Star size={16} className="text-amber-400 fill-amber-400" />
                                </div>
                                <p className="text-gray-400 text-sm leading-relaxed mb-5 max-w-xs">
                                    گروه مهندسی اکگ‌کالا، تأمین‌کننده تجهیزات پزشکی و الکترونیکی با بیش از یک دهه تجربه در صنعت.
                                </p>

                                <div className="w-full space-y-3">
                                    {storeInfo.storePhone && (
                                        <a href={`tel:${storeInfo.storePhone.replace(/\s/g, '')}`}
                                            className="flex items-center gap-3 group">
                                            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                                <Phone size={15} className="text-amber-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">تماس</span>
                                                <span className="text-white text-sm font-bold ltr" dir="ltr">{storeInfo.storePhone}</span>
                                            </div>
                                        </a>
                                    )}
                                    {storeInfo.storeEmail && (
                                        <a href={`mailto:${storeInfo.storeEmail}`}
                                            className="flex items-center gap-3 group">
                                            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                <Mail size={15} className="text-emerald-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">ایمیل</span>
                                                <span className="text-white text-sm font-bold ltr" dir="ltr">{storeInfo.storeEmail}</span>
                                            </div>
                                        </a>
                                    )}
                                    {storeInfo.storeAddress && (
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <MapPin size={15} className="text-blue-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">آدرس</span>
                                                <p className="text-gray-300 text-xs leading-relaxed">{storeInfo.storeAddress}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                                            <Clock size={15} className="text-purple-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase tracking-widest">ساعت کاری</span>
                                            <span className="text-gray-300 text-sm">روزهای کاری ۹ تا ۲۱</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className="flex flex-col items-center md:items-start text-center md:text-right">
                                <h4 className="font-bold text-white text-base mb-5 flex items-center gap-2">
                                    <span className="w-1 h-5 rounded-full bg-amber-400 inline-block" />
                                    دسترسی سریع
                                </h4>
                                <ul className="space-y-3 w-full">
                                    {[
                                        { href: "/products", label: "محصولات" },
                                        { href: "/categories", label: "دسته‌بندی‌ها" },
                                        { href: "/blog", label: "بلاگ" },
                                        { href: "/about", label: "درباره ما" },
                                        { href: "/contact", label: "تماس با ما" },
                                    ].map((link) => (
                                        <li key={link.href}>
                                            <Link href={link.href}
                                                className="flex items-center justify-center md:justify-start gap-2 text-gray-400 hover:text-amber-400 transition-colors text-sm group">
                                                <ArrowLeft size={13} className="text-amber-500/50 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Customer Service */}
                            <div className="flex flex-col items-center md:items-start text-center md:text-right">
                                <h4 className="font-bold text-white text-base mb-5 flex items-center gap-2">
                                    <span className="w-1 h-5 rounded-full bg-blue-400 inline-block" />
                                    خدمات مشتریان
                                </h4>
                                <ul className="space-y-3 w-full">
                                    {[
                                        { href: orderTrackingHref, label: "پیگیری سفارش" },
                                        { href: "/terms", label: "قوانین و مقررات" },
                                        { href: "/faq", label: "سوالات متداول" },
                                        { href: isAuthenticated ? "/profile" : "/login", label: "حساب کاربری" },
                                        { href: "/cart", label: "سبد خرید" },
                                    ].map((link) => (
                                        <li key={link.href}>
                                            <Link href={link.href}
                                                className="flex items-center justify-center md:justify-start gap-2 text-gray-400 hover:text-blue-400 transition-colors text-sm group">
                                                <ArrowLeft size={13} className="text-blue-500/50 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Newsletter + Social + Trust */}
                            <div className="flex flex-col items-center md:items-start text-center md:text-right">
                                <h4 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                                    <span className="w-1 h-5 rounded-full bg-emerald-400 inline-block" />
                                    خبرنامه
                                </h4>
                                <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                                    از جدیدترین محصولات و تخفیفات ویژه باخبر شوید
                                </p>

                                {newsletterStatus === "success" ? (
                                    <div className="flex items-center gap-2 p-3 bg-green-500/15 border border-green-500/25 rounded-xl text-green-400 w-full">
                                        <CheckCircle size={18} />
                                        <span className="text-sm">{newsletterMessage}</span>
                                    </div>
                                ) : (
                                    <form onSubmit={handleNewsletterSubmit} className="w-full space-y-2">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                if (newsletterStatus === "error") setNewsletterStatus("idle");
                                            }}
                                            placeholder="ایمیل خود را وارد کنید"
                                            className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none transition-all ${newsletterStatus === "error"
                                                ? "border-red-500 focus:border-red-400"
                                                : "border-white/10 focus:border-amber-500"
                                                }`}
                                            dir="ltr"
                                            disabled={isSubmitting}
                                        />
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !email.trim()}
                                            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-sm"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <Mail size={16} />
                                                    <span>عضویت در خبرنامه</span>
                                                </>
                                            )}
                                        </button>
                                        {newsletterStatus === "error" && (
                                            <div className="flex items-center gap-2 text-red-400 text-xs">
                                                <AlertCircle size={14} />
                                                <span>{newsletterMessage}</span>
                                            </div>
                                        )}
                                    </form>
                                )}

                                {/* Social */}
                                <div className="mt-5 w-full">
                                    <p className="text-gray-500 text-xs mb-3">ما را دنبال کنید</p>
                                    <div className="flex gap-2 justify-center md:justify-start">
                                        {storeInfo.socialLinks?.telegram && (
                                            <a href={storeInfo.socialLinks.telegram} target="_blank" rel="noopener noreferrer"
                                                className="w-9 h-9 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/25 flex items-center justify-center text-[#229ED9] hover:bg-[#229ED9]/30 transition-all hover:scale-110"
                                                title="تلگرام">
                                                <Send size={16} />
                                            </a>
                                        )}
                                        {storeInfo.socialLinks?.instagram && (
                                            <a href={storeInfo.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                                                className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/25 flex items-center justify-center text-pink-400 hover:bg-pink-500/30 transition-all hover:scale-110"
                                                title="اینستاگرام">
                                                <Instagram size={16} />
                                            </a>
                                        )}
                                        {storeInfo.socialLinks?.aparat && (
                                            <a href={storeInfo.socialLinks.aparat} target="_blank" rel="noopener noreferrer"
                                                className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-all hover:scale-110"
                                                title="آپارات">
                                                <Video size={16} />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* E-namad trust seal */}
                                <div className="mt-5 flex justify-center md:justify-start">
                                    <div
                                        className="rounded-xl bg-white p-1.5 shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
                                        style={{ width: 80, height: 80 }}
                                        dangerouslySetInnerHTML={{
                                            __html: `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' style='display:flex;align-items:center;justify-content:center;width:100%;height:100%;'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' alt='نماد اعتماد الکترونیکی اینماد' style='cursor:pointer;width:64px;height:64px;object-fit:contain;' code='VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6'></a>`
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ─── Bottom Bar ─── */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-center">
                            <p className="text-gray-500 text-xs">
                                © ۱۴۰۴ — تمامی حقوق این وب‌سایت متعلق به فروشگاه{" "}
                                <span className="text-amber-400 font-semibold">EKG KALA</span>{" "}
                                می‌باشد.
                            </p>
                            <p className="text-gray-600 text-xs">
                                طراحی و توسعه توسط{" "}
                                <span className="text-gray-400 font-medium">sadraSh</span>
                            </p>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Back to top */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-20 left-4 lg:bottom-8 lg:left-8 z-50 w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/40 flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label="بازگشت به بالا"
                >
                    <ChevronUp size={22} />
                </button>
            )}
        </>
    );
}
