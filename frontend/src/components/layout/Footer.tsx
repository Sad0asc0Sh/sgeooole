"use client";

import { useEffect, useState, useCallback, memo } from "react";
import Link from "next/link";
import {
    Send, Instagram, Video, Phone, MapPin, Clock, Mail,
    Loader2, CheckCircle, AlertCircle, ChevronUp,
    Truck, Headphones, Shield, CreditCard
} from "lucide-react";
import { settingsService } from "@/services/settingsService";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

// Static — defined outside component so it's never re-created on render
const _ENAMAD_HTML = `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' style='display:flex;align-items:center;justify-content:center;width:100%;height:100%;'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' alt='اینماد' style='cursor:pointer;width:60px;height:60px;object-fit:contain;' code='VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6'></a>`;

const _TRUST_ITEMS = [
    { icon: "truck", bg: "bg-orange-400", title: "ارسال سریع", desc: "تحویل ۲۴ ساعته" },
    { icon: "headphones", bg: "bg-blue-500", title: "پشتیبانی ۲۴/۷", desc: "همیشه در کنارتان" },
    { icon: "shield", bg: "bg-emerald-500", title: "ضمانت اصالت", desc: "۱۰۰٪ اورجینال" },
    { icon: "credit", bg: "bg-purple-500", title: "پرداخت امن", desc: "درگاه معتبر" },
] as const;

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

function Footer() {
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

        return () => {
            window.removeEventListener("settings:updated", handleSettingsUpdated);
        };
    }, []);

    const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

    const handleScrollEvent = useCallback(() => setShowBackToTop(window.scrollY > 300), []);

    useEffect(() => {
        window.addEventListener("scroll", handleScrollEvent, { passive: true });
        return () => window.removeEventListener("scroll", handleScrollEvent);
    }, [handleScrollEvent]);

    const handleNewsletterSubmit = useCallback(async (e: React.FormEvent) => {
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
    }, [email]);

    /* ─────────────────────────────────────────────────────── */
    return (
        <>
            <footer className="mt-8 mb-16 lg:mb-0" dir="rtl">

                {/* ─── Trust Strip ─── */}
                <div className="bg-white border-t border-gray-100">
                    <div className="max-w-5xl mx-auto px-4 py-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[
                                { icon: <Truck size={18} className="text-white" />, bg: "bg-orange-400", title: "ارسال سریع", desc: "تحویل ۲۴ ساعته" },
                                { icon: <Headphones size={18} className="text-white" />, bg: "bg-blue-500", title: "پشتیبانی ۲۴/۷", desc: "همیشه در کنارتان" },
                                { icon: <Shield size={18} className="text-white" />, bg: "bg-emerald-500", title: "ضمانت اصالت", desc: "۱۰۰٪ اورجینال" },
                                { icon: <CreditCard size={18} className="text-white" />, bg: "bg-purple-500", title: "پرداخت امن", desc: "درگاه معتبر" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                    <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-xs">{item.title}</p>
                                        <p className="text-gray-400 text-[11px]">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ─── Main Dark Section ─── */}
                <div className="bg-[#0f2044] rounded-t-3xl overflow-hidden">
                    <div className="max-w-5xl mx-auto px-4 pt-10 pb-6">

                        {/* ─── 4-col grid ─── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-white/10">

                            {/* Col 1: Brand & Contact */}
                            <div className="flex flex-col items-center text-center lg:items-start lg:text-right">

                                <h3 className="font-extrabold text-white text-lg tracking-wide mb-1">
                                    {storeInfo.storeName || "EKG KALA"}
                                </h3>
                                <p className="text-amber-400 text-[11px] mb-5">
                                   هدف‌ما بالا بردن سطح امنیت شماست
                                </p>

                                <div className="w-full space-y-3 max-w-xs lg:max-w-none">

                                    {storeInfo.storePhone && (
                                        <a href={`tel:${storeInfo.storePhone.replace(/\s/g, '')}`}
                                            className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                                <Phone size={14} className="text-amber-400" />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-500 text-[10px]">تماس با ما</p>
                                                <p className="text-white text-sm font-bold" dir="ltr">{storeInfo.storePhone}</p>
                                            </div>
                                        </a>
                                    )}

                                    {storeInfo.storeEmail && (
                                        <a href={`mailto:${storeInfo.storeEmail}`}
                                            className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                <Mail size={14} className="text-emerald-400" />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-500 text-[10px]">ایمیل</p>
                                                <p className="text-white text-sm font-bold" dir="ltr">{storeInfo.storeEmail}</p>
                                            </div>
                                        </a>
                                    )}

                                    {storeInfo.storeAddress && (
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <MapPin size={14} className="text-blue-400" />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-500 text-[10px] mb-0.5">آدرس</p>
                                                <p className="text-gray-300 text-xs leading-relaxed">{storeInfo.storeAddress}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                            <Clock size={14} className="text-purple-400" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-gray-500 text-[10px]">ساعت کاری</p>
                                            <p className="text-gray-300 text-sm">روزهای کاری ۹ تا ۲۱</p>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Col 2: Quick Links */}
                            <div className="flex flex-col items-center text-center lg:items-start lg:text-right">
                                <div className="flex items-center gap-2 mb-5">
                                    <span className="w-1 h-4 rounded-full bg-amber-400 inline-block" />
                                    <h4 className="font-bold text-white text-sm">دسترسی سریع</h4>
                                </div>
                                <ul className="space-y-3">
                                    {[
                                        { href: "/products", label: "محصولات" },
                                        { href: "/categories", label: "دسته‌بندی‌ها" },
                                        { href: "/blog", label: "بلاگ" },
                                        { href: "/about", label: "درباره ما" },
                                        { href: "/contact", label: "تماس با ما" },
                                    ].map((link) => (
                                        <li key={link.href}>
                                            <Link href={link.href} className="text-gray-400 text-sm">
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Col 3: Customer Service */}
                            <div className="flex flex-col items-center text-center lg:items-start lg:text-right">
                                <div className="flex items-center gap-2 mb-5">
                                    <span className="w-1 h-4 rounded-full bg-blue-400 inline-block" />
                                    <h4 className="font-bold text-white text-sm">خدمات مشتریان</h4>
                                </div>
                                <ul className="space-y-3">
                                    {[
                                        { href: orderTrackingHref, label: "پیگیری سفارش" },
                                        { href: "/terms", label: "قوانین و مقررات" },
                                        { href: "/faq", label: "سوالات متداول" },
                                        { href: isAuthenticated ? "/profile" : "/login", label: "حساب کاربری" },
                                        { href: "/cart", label: "سبد خرید" },
                                    ].map((link) => (
                                        <li key={link.href}>
                                            <Link href={link.href}
                                                className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Col 4: Newsletter + Social + Trust */}
                            <div className="flex flex-col items-center text-center lg:items-start lg:text-right">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="w-1 h-4 rounded-full bg-emerald-400 inline-block" />
                                    <h4 className="font-bold text-white text-sm">خبرنامه</h4>
                                </div>
                                <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                                    از جدیدترین تخفیفات باخبر شوید
                                </p>

                                {newsletterStatus === "success" ? (
                                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 w-full max-w-xs lg:max-w-none">
                                        <CheckCircle size={16} />
                                        <span className="text-xs">{newsletterMessage}</span>
                                    </div>
                                ) : (
                                    <form onSubmit={handleNewsletterSubmit} className="w-full max-w-xs lg:max-w-none space-y-2">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                if (newsletterStatus === "error") setNewsletterStatus("idle");
                                            }}
                                            placeholder="ایمیل خود را وارد کنید"
                                            className={`w-full rounded-xl border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none transition-colors ${newsletterStatus === "error"
                                                ? "border-red-500"
                                                : "border-white/10 focus:border-amber-500"
                                                }`}
                                            dir="ltr"
                                            disabled={isSubmitting}
                                        />
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !email.trim()}
                                            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                        >
                                            {isSubmitting
                                                ? <Loader2 size={15} className="animate-spin" />
                                                : <><Mail size={15} /><span>عضویت در خبرنامه</span></>
                                            }
                                        </button>
                                        {newsletterStatus === "error" && (
                                            <div className="flex items-center justify-center gap-1.5 text-red-400 text-xs">
                                                <AlertCircle size={13} />
                                                <span>{newsletterMessage}</span>
                                            </div>
                                        )}
                                    </form>
                                )}

                                {/* Social */}
                                <div className="mt-5">
                                    <p className="text-gray-500 text-[11px] mb-3">ما را دنبال کنید</p>
                                    <div className="flex gap-2 justify-center lg:justify-start">
                                        {storeInfo.socialLinks?.telegram && (
                                            <a href={storeInfo.socialLinks.telegram} target="_blank" rel="noopener noreferrer"
                                                className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 hover:bg-sky-500/30 transition-colors"
                                                title="تلگرام">
                                                <Send size={15} />
                                            </a>
                                        )}
                                        {storeInfo.socialLinks?.instagram && (
                                            <a href={storeInfo.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                                                className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 hover:bg-pink-500/30 transition-colors"
                                                title="اینستاگرام">
                                                <Instagram size={15} />
                                            </a>
                                        )}
                                        {storeInfo.socialLinks?.aparat && (
                                            <a href={storeInfo.socialLinks.aparat} target="_blank" rel="noopener noreferrer"
                                                className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors"
                                                title="آپارات">
                                                <Video size={15} />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* E-namad */}
                                <div className="mt-5 flex justify-center lg:justify-start">
                                    <div
                                        className="rounded-xl bg-white p-1 overflow-hidden"
                                        style={{ width: 72, height: 72 }}
                                        dangerouslySetInnerHTML={{
                                            __html: `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' style='display:flex;align-items:center;justify-content:center;width:100%;height:100%;'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=693453&Code=VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6' alt='اینماد' style='cursor:pointer;width:60px;height:60px;object-fit:contain;' code='VuZGjZtO8BiFnf2XEAVxrE7Y2cr4mDZ6'></a>`
                                        }}
                                    />
                                </div>
                            </div>

                        </div>{/* end grid */}

                        {/* ─── Bottom bar ─── */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-5 text-center">
                            <p className="text-gray-500 text-xs">
                                © ۱۴۰۴ — تمامی حقوق متعلق به{" "}
                                <span className="text-amber-400 font-semibold">EKG KALA</span>{" "}
                                می‌باشد.
                            </p>
                            <p className="text-gray-600 text-xs">
                                طراحی: <span className="text-gray-400">sadraSh</span>
                            </p>
                        </div>

                    </div>
                </div>
            </footer>

            {/* Back to top */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-[calc(var(--bottom-nav-total-height)_+_1rem)] left-4 lg:bottom-8 lg:left-8 z-50 w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center"
                    aria-label="بازگشت به بالا"
                >
                    <ChevronUp size={20} />
                </button>
            )}
        </>
    );
}

export default memo(Footer);
