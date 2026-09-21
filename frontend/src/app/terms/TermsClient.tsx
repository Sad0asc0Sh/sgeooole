"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Shield,
    Home,
    Loader2
} from "lucide-react";
import { pageService, PageData } from "@/services/pageService";
import { renderContent } from "@/lib/renderContent";

export default function TermsPage() {
    const [page, setPage] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await pageService.getPageBySlug("terms");
                if (data) {
                    setPage(data);
                } else {
                    setError(true);
                }
            } catch (err) {
                console.error("Error fetching terms:", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="animate-spin text-kala-500 mx-auto" />
                    <p className="mt-4 text-gray-500 font-medium">در حال بارگذاری...</p>
                </div>
            </div>
        );
    }

    if (error || !page) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <Shield size={40} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-black text-gray-800 mb-2">صفحه یافت نشد</h1>
                <p className="text-gray-500 mb-8 max-w-md">
                    متأسفانه محتوای این صفحه یافت نشد. لطفاً از ادمین پنل بررسی کنید که صفحه‌ای با اسلاگ "terms" ایجاد و منتشر شده باشد.
                </p>
                <Link href="/" className="px-8 py-3 bg-kala-500 text-white rounded-xl font-bold hover:bg-kala-600 transition-all shadow-lg shadow-kala-200">
                    بازگشت به خانه
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f1f5f9] pb-16" dir="rtl">
            {/* Hero Section */}
            <div className="cms-hero">
                <div className="container mx-auto px-4 relative z-10">
                    <h1 className="text-3xl md:text-5xl font-black mb-4 drop-shadow-lg">
                        {page.meta?.title || page.title}
                    </h1>
                    <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto font-light leading-relaxed">
                        {page.meta?.description || "هر چیزی که نیاز است درباره قوانین و مقررات ایکیجی کالا بدانید، به صورت شفاف برای شما آماده کرده‌ایم."}
                    </p>
                </div>
                {/* Decorative background circle */}
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
            </div>

            <div className="max-w-[900px] mx-auto px-4 -mt-16 relative z-20">
                <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-300/50 border border-slate-100 overflow-hidden">
                    {/* Rendered Content */}
                    <div className="p-10 md:p-14">
                        <div
                            className="cms-content min-h-[400px]"
                            dangerouslySetInnerHTML={{ __html: renderContent(page.content) }}
                        />
                    </div>
                </div>

                {/* Footer Link */}
                <div className="mt-12 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-600 rounded-2xl font-bold shadow-xl shadow-slate-200/50 hover:text-blue-600 transition-all border border-slate-100 group"
                    >
                        <Home className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                        <span>بازگشت به فروشگاه</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
