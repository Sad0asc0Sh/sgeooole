"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Instagram, Video, Phone, MapPin, Clock, Mail, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { settingsService } from "@/services/settingsService";
import api from "@/lib/api";

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

    // Newsletter state
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
    const [newsletterMessage, setNewsletterMessage] = useState("");

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await settingsService.getPublicSettings();
                console.log("[Footer] Settings response:", response);

                // API returns { success: true, settings: {...} }
                // settingsService returns response.data, so we get { success, settings }
                const settings = (response as any).settings || (response as any).data?.settings;

                if (settings) {
                    console.log("[Footer] Store info found:", settings.storePhone, settings.storeAddress);
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

    return (
        <footer className="w-full !h-auto !min-h-0 !overflow-visible bg-[#142755] pt-10 pb-24 border-t border-transparent rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] mt-4 touch-auto">
            <div className="mobile-container grid gap-8 !h-auto !overflow-visible">

                {/* Store Contact Info - Premium Section */}
                <div className="bg-gradient-to-l from-white/10 to-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm">
                    <div className="flex flex-col gap-4">
                        {/* Phone Number */}
                        {storeInfo.storePhone && (
                            <a
                                href={`tel:${storeInfo.storePhone.replace(/\s/g, '')}`}
                                className="flex items-center gap-3 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vita-400 to-vita-600 flex items-center justify-center shadow-lg shadow-vita-500/30 group-hover:scale-110 transition-transform">
                                    <Phone size={18} className="text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-medium">تماس با ما</span>
                                    <span className="text-white font-bold text-lg tracking-wide ltr" dir="ltr">
                                        {storeInfo.storePhone}
                                    </span>
                                </div>
                            </a>
                        )}

                        {/* Store Address */}
                        {storeInfo.storeAddress && (
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                                    <MapPin size={18} className="text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-medium">آدرس فروشگاه</span>
                                    <p className="text-gray-200 text-sm leading-relaxed">
                                        {storeInfo.storeAddress}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Working Hours - Optional Static */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                <Clock size={18} className="text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 font-medium">ساعت پاسخگویی</span>
                                <span className="text-gray-200 text-sm">
                                    شنبه تا چهارشنبه ۹ صبح تا ۲۱
                                    پنجشنبه ها از ۹ صبح تا ۱۴
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Access */}
                <div className="space-y-4">
                    <h3 className="font-bold text-white">دسترسی سریع</h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li><Link href="/products">محصولات</Link></li>
                        <li><Link href="/smart-assembly">اسمبل هوشمند</Link></li>
                        <li><Link href="/about">درباره ما</Link></li>
                        <li><Link href="/contact">تماس با ما</Link></li>
                    </ul>
                </div>

                {/* Customer Service */}
                <div className="space-y-4">
                    <h3 className="font-bold text-white">خدمات مشتریان</h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li><Link href="/tracking">پیگیری سفارش</Link></li>
                        <li><Link href="/terms">قوانین و مقررات</Link></li>
                        <li><Link href="/faq">سوالات متداول</Link></li>
                        <li><Link href="/returns">رویه بازگرداندن کالا</Link></li>
                    </ul>
                </div>

                {/* Newsletter */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Mail size={20} className="text-vita-400" />
                        <h3 className="font-bold text-white">عضویت در خبرنامه</h3>
                    </div>
                    <p className="text-sm text-gray-400">
                        از آخرین تخفیف‌ها و محصولات جدید باخبر شوید
                    </p>

                    {newsletterStatus === "success" ? (
                        <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400">
                            <CheckCircle size={20} />
                            <span className="text-sm">{newsletterMessage}</span>
                        </div>
                    ) : (
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!email.trim()) return;

                                // Simple email validation
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
                            }}
                            className="space-y-2"
                        >
                            <div className="flex gap-2">
                                <div className="relative flex-1">
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
                                                : "border-white/10 focus:border-vita-500"
                                            }`}
                                        dir="ltr"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !email.trim()}
                                    className="rounded-xl bg-gradient-to-r from-vita-500 to-vita-600 px-6 py-3 text-white font-medium hover:from-vita-600 hover:to-vita-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-vita-500/25"
                                >
                                    {isSubmitting ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Mail size={18} />
                                            <span>عضویت</span>
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
                </div>

                {/* Socials & Trust Badge */}
                <div className="flex flex-col gap-6">
                    <div className="flex gap-4">
                        {storeInfo.socialLinks?.telegram && (
                            <a
                                href={storeInfo.socialLinks.telegram}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-[#0088cc]"
                                title="تلگرام"
                            >
                                <Send size={20} />
                            </a>
                        )}
                        {storeInfo.socialLinks?.instagram && (
                            <a
                                href={storeInfo.socialLinks.instagram}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-[#E4405F]"
                                title="اینستاگرام"
                            >
                                <Instagram size={20} />
                            </a>
                        )}
                        {storeInfo.socialLinks?.aparat && (
                            <a
                                href={storeInfo.socialLinks.aparat}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-[#ED145B]"
                                title="آپارات"
                            >
                                <Video size={20} />
                            </a>
                        )}
                        {/* Show placeholder icons if no social links are set */}
                        {!storeInfo.socialLinks?.telegram && !storeInfo.socialLinks?.instagram && !storeInfo.socialLinks?.aparat && (
                            <>
                                <span className="rounded-full bg-white/50 p-2 text-gray-400">
                                    <Send size={20} />
                                </span>
                                <span className="rounded-full bg-white/50 p-2 text-gray-400">
                                    <Instagram size={20} />
                                </span>
                                <span className="rounded-full bg-white/50 p-2 text-gray-400">
                                    <Video size={20} />
                                </span>
                            </>
                        )}
                    </div>

                    {/* Trust Badge Placeholder */}
                    <div className="h-24 w-24 rounded-lg bg-white border border-welf-200 flex items-center justify-center text-xs text-gray-400">
                        نماد اعتماد
                    </div>
                </div>

                <div className="text-center text-xs text-gray-400 mt-4">
                    ۱۴۰۴-۱۳۹۶ تمامی حقوق برای ویلف‌ویتا محفوظ است.
                </div>
            </div>
        </footer>
    );
}
