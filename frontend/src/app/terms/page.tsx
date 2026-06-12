"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    FileText,
    ChevronLeft,
    Shield,
    Clock,
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

            {/* Main Content Container */}
            <div className="max-w-[850px] mx-auto px-4 -mt-16 relative z-20">
                <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    {/* Header Info */}
                    <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 px-8 py-6 flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-slate-800">قوانین و ضوابط رسمی</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                            <Clock className="w-4 h-4 text-blue-500" />
                            آخرین بروزرسانی: {new Date(page.updatedAt).toLocaleDateString("fa-IR")}
                        </div>
                    </div>

                    {/* Rendered Content */}
                    <div className="p-8 md:p-12">
                        <div
                            className="cms-content"
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
