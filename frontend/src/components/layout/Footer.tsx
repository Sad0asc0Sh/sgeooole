"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Instagram, Video, Phone, MapPin, Clock } from "lucide-react";
import { settingsService } from "@/services/settingsService";

interface StoreInfo {
    storeName?: string;
    storePhone?: string;
    storeAddress?: string;
}

export default function Footer() {
    const [storeInfo, setStoreInfo] = useState<StoreInfo>({});

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
                    <h3 className="font-bold text-white">خبرنامه</h3>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            placeholder="ایمیل خود را وارد کنید"
                            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-400 focus:border-vita-500 focus:outline-none"
                        />
                        <button className="rounded-lg bg-vita-500 px-4 py-2 text-white hover:bg-vita-600">
                            عضویت
                        </button>
                    </div>
                </div>

                {/* Socials & Trust Badge */}
                <div className="flex flex-col gap-6">
                    <div className="flex gap-4">
                        <a href="#" className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-vita-500">
                            <Send size={20} />
                        </a>
                        <a href="#" className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-vita-500">
                            <Instagram size={20} />
                        </a>
                        <a href="#" className="rounded-full bg-white p-2 text-[#142755] shadow-sm transition-transform hover:scale-110 hover:text-vita-500">
                            <Video size={20} />
                        </a>
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
