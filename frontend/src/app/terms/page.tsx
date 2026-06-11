import Link from "next/link";
import { notFound } from "next/navigation";
import {
    FileText,
    ChevronLeft,
    Shield,
    Clock,
    Home
} from "lucide-react";

interface PageData {
    _id: string;
    title: string;
    slug: string;
    content: string;
    status: "published" | "hidden";
    meta?: {
        title?: string;
        description?: string;
    };
    createdAt: string;
    updatedAt: string;
}

const API_URL =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000/api";

async function fetchTermsPage(): Promise<PageData | null> {
    try {
        const res = await fetch(`${API_URL}/pages/slug/terms`, {
            next: { revalidate: 3600 },
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data || null;
    } catch {
        return null;
    }
}

export default async function TermsPage() {
    const page = await fetchTermsPage();

    if (!page) {
        notFound();
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
                        className="prose prose-lg max-w-none p-8 md:p-12
                            prose-headings:text-gray-800 prose-headings:font-bold
                            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-4
                            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-kala-700
                            prose-p:text-gray-600 prose-p:leading-8
                            prose-ul:space-y-3 prose-li:text-gray-600
                            prose-strong:text-gray-800 prose-strong:font-bold
                            prose-a:text-kala-500 prose-a:no-underline hover:prose-a:underline"
                        dangerouslySetInnerHTML={{ __html: page.content }}
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
