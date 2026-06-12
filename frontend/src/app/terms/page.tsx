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
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 md:py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <Link href="/" className="hover:text-kala-500 transition-colors flex items-center gap-1">
                        <Home size={16} />
                        خانه
                    </Link>
                    <ChevronLeft size={16} />
                    <span className="text-gray-700 font-medium">قوانین و مقررات</span>
                </nav>

                {/* Hero Header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#142755] via-[#1a3a7a] to-[#0f1e40] rounded-3xl p-8 md:p-12 mb-8 text-white">
                    {/* Decorative patterns */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-white/30 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                        <div className="absolute bottom-0 right-0 w-96 h-96 bg-kala-400/30 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
                    </div>

                    <div className="relative z-10 flex items-start gap-6">
                        <div className="hidden md:flex w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl items-center justify-center border border-white/20">
                            <Shield size={40} className="text-kala-400" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-3xl md:text-4xl font-black mb-4">
                                {page.meta?.title || page.title}
                            </h1>
                            <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">
                                {page.meta?.description || "با مطالعه این قوانین، از حقوق و مسئولیت‌های خود در استفاده از خدمات ما آگاه شوید."}
                            </p>
                            <div className="flex items-center gap-4 mt-6 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <Clock size={16} />
                                    <span>آخرین بروزرسانی: {new Date(page.updatedAt).toLocaleDateString("fa-IR")}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Card */}
                <article className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                    {/* Quick Info Bar */}
                    <div className="bg-gradient-to-l from-kala-50 to-blue-50 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                        <FileText size={20} className="text-kala-500" />
                        <span className="text-sm text-gray-600 font-medium">
                            لطفاً قبل از استفاده از خدمات ما، این قوانین را با دقت مطالعه کنید.
                        </span>
                    </div>

                    {/* Main Content */}
                    <div
                        className="p-8 md:p-12 overflow-hidden"
                        dir="rtl"
                        dangerouslySetInnerHTML={{ __html: renderContent(page.content) }}
                    />
                </article>

                {/* Back to Home */}
                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-kala-500 transition-colors group"
                    >
                        <Home size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span>بازگشت به صفحه اصلی</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
