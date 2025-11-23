"use client";
import { useState } from "react";
import { ChevronLeft, Heart, Share2, Star, ShieldCheck, Store, Info } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import Link from "next/link";

// Mock Data
const PRODUCT = {
    id: 1,
    title: "دوربین مداربسته تحت شبکه شیائومی مدل C300",
    enTitle: "Xiaomi Smart Camera C300",
    price: 1850000,
    oldPrice: 2100000,
    rating: 4.5,
    reviewCount: 128,
    images: ["/images/p1.jpg", "/images/p1-2.jpg", "/images/p1-3.jpg"], // Use placeholders if needed
    colors: [{ id: 1, hex: "#ffffff", name: "سفید" }, { id: 2, hex: "#000000", name: "مشکی" }],
    description: "دوربین مداربسته C300 شیائومی با کیفیت تصویر 2K و قابلیت دید در شب رنگی، انتخابی عالی برای امنیت منزل شماست...",
    specs: [
        { label: "نوع اتصال", value: "بی‌سیم (Wi-Fi)" },
        { label: "قابلیت چرخش", value: "360 درجه" },
        { label: "دید در شب", value: "دارد - رنگی" },
    ]
};

export default function ProductDetailPage() {
    const [selectedColor, setSelectedColor] = useState(PRODUCT.colors[0]);

    return (
        <div className="min-h-screen bg-white pb-24">

            {/* 1. Header (Transparent/Floating) */}
            <div className="fixed top-0 left-0 w-full z-20 flex justify-between items-center p-4">
                <Link href="/" className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:bg-white">
                    <ChevronLeft />
                </Link>
                <div className="flex gap-3">
                    <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-red-500">
                        <Heart size={20} />
                    </button>
                    <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm">
                        <Share2 size={20} />
                    </button>
                </div>
            </div>

            {/* 2. Gallery Slider */}
            <div className="relative bg-gray-50 h-[380px] w-full">
                <Swiper modules={[Pagination]} pagination={{ clickable: true }} className="h-full">
                    {[1, 2, 3].map((img) => (
                        <SwiperSlide key={img} className="flex items-center justify-center">
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                {/* Replace with <Image> later */}
                                <div className="w-64 h-64 bg-gray-200 rounded-xl animate-pulse" />
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {/* 3. Info Section */}
            <div className="px-4 py-6 -mt-6 relative bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10">

                {/* Title & Rating */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold text-gray-900 leading-snug">{PRODUCT.title}</h1>
                        <span className="text-xs text-gray-400 font-mono mt-1">{PRODUCT.enTitle}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 mb-6">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-bold text-gray-800">{PRODUCT.rating}</span>
                    <span className="text-xs text-gray-400">({PRODUCT.reviewCount} دیدگاه)</span>
                </div>

                <hr className="border-gray-100 mb-6" />

                {/* Selectors (Color) */}
                <div className="mb-6">
                    <span className="text-sm font-bold text-gray-800 block mb-3">رنگ: {selectedColor.name}</span>
                    <div className="flex gap-3">
                        {PRODUCT.colors.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedColor(c)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${selectedColor.id === c.id ? 'border-vita-500' : 'border-gray-200'}`}
                            >
                                <span className="w-6 h-6 rounded-full border border-gray-100" style={{ backgroundColor: c.hex }} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Features (Guarantee, Seller) */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <ShieldCheck size={18} className="text-gray-400" />
                        <span>گارانتی ۱۸ ماهه شرکتی</span>
                    </div>
                    <div className="h-px bg-gray-200 w-full" />
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Store size={18} className="text-vita-500" />
                        <span>موجود در انبار ویلف‌ویتا (ارسال فوری)</span>
                    </div>
                </div>

                {/* Tabs (Description / Specs) */}
                <div className="mb-4">
                    <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <Info size={18} className="text-vita-600" /> مشخصات فنی
                    </h3>
                    <div className="space-y-2">
                        {PRODUCT.specs.map((spec, i) => (
                            <div key={i} className="flex justify-between py-2 border-b border-gray-50 text-xs">
                                <span className="text-gray-500">{spec.label}</span>
                                <span className="text-gray-800 font-medium">{spec.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* 4. Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-50 flex items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col">
                    {PRODUCT.oldPrice && (
                        <span className="text-[10px] text-gray-400 line-through decoration-red-400 decoration-1 text-left pl-1">
                            {PRODUCT.oldPrice.toLocaleString("fa-IR")}
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        <span className="text-xl font-black text-black">{PRODUCT.price.toLocaleString("fa-IR")}</span>
                        <span className="text-xs text-gray-500">تومان</span>
                    </div>
                </div>
                <button className="flex-1 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-3.5 rounded-xl shadow-md shadow-vita-200 active:scale-95 transition-transform">
                    افزودن به سبد خرید
                </button>
            </div>

        </div>
    );
}
