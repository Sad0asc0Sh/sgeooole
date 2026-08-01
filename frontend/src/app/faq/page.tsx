"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pageService, PageData } from "@/services/pageService";
import {
    HelpCircle,
    ChevronDown,
    Search,
    Loader2,
    Home
} from "lucide-react";
import { renderContent } from "@/lib/renderContent";

// سوالات متداول پیش‌فرض اگر محتوا تنظیم نشده باشد
const defaultFAQs = [
    {
        question: "چگونه سفارش خود را پیگیری کنم؟",
        answer: "شما برای خرید و ثبت سفارش با گوگل یا شماره تلفن بسیار راحت ثبت نام خواهید کرد و در پنل خودتان امکان پیگیری سفارش خود را دارید و همینطور در فوتر سایت مستقیم به صفحه سفارشات جاری منتقل خواهید شد و دسترسی سریع تر به این بخش خواهید داشت"
    },
    {
        question: "روش‌های پرداخت چیست؟",
        answer: "ما از درگاه‌های پرداخت امن زرین‌پال و سداد پشتیبانی می‌کنیم. همچنین امکان پرداخت در محل برای برخی مناطق فراهم است."
    },
    {
        question: "هزینه ارسال چقدر است؟",
        answer: "هزینه ارسال بر اساس وزن سفارش و مقصد محاسبه می‌شود."
    },
    {
        question: "مدت زمان تحویل سفارش چقدر است؟",
        answer: "معمولاً سفارش‌ها در مشهد مقدس همان روز کاری به دست شما می‌رسد. برای شهرستان‌ها ممکن است این زمان ۵ تا ۷ روز کاری باشد."
    },
    {
        question: "آیا امکان مرجوع کالا وجود دارد؟",
        answer: "خیر فعلا امکان پذیر نیست"
    }
];

function _FAQItem({ question, answer, isOpen, onClick }: {
    question: string;
    answer: string;
    isOpen: boolean;
    onClick: () => void;
}) {
    return (
        <div className={`border rounded-2xl transition-all duration-300 overflow-hidden ${isOpen
            ? "border-kala-300 bg-kala-50/50 shadow-lg shadow-kala-100/50"
            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
            }`}>
            <button
                onClick={onClick}
                className="w-full flex items-center justify-between p-5 md:p-6 text-right"
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isOpen
                        ? "bg-kala-500 text-white"
                        : "bg-gray-100 text-gray-500"
                        }`}>
                        <HelpCircle size={20} />
                    </div>
                    <span className={`font-bold text-base md:text-lg transition-colors ${isOpen ? "text-kala-700" : "text-gray-800"
                        }`}>
                        {question}
                    </span>
                </div>
                <ChevronDown
                    size={22}
                    className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-kala-500" : ""
                        }`}
                />
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="px-5 md:px-6 pb-5 md:pb-6 pr-[72px] md:pr-[88px] text-right" dir="rtl">
                    <div
                        className="text-gray-600"
                        dangerouslySetInnerHTML={{ __html: renderContent(answer) }}
                    />
                </div>
            </div>
        </div>
    );
}

export default function FAQPage() {
    const [_page, setPage] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState<string | null>(null);
    const [openFAQ, setOpenFAQ] = useState<number | null>(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [faqs, setFaqs] = useState(defaultFAQs);

    useEffect(() => {
        const fetchPage = async () => {
            try {
                const data = await pageService.getPageBySlug("faq");
                setPage(data);

                // اگر محتوا JSON شامل سوالات باشد، آنها را parse می‌کنیم
                if (data?.content) {
                    try {
                        const parsedFaqs = JSON.parse(data.content);
                        if (Array.isArray(parsedFaqs) && parsedFaqs.length > 0) {
                            setFaqs(parsedFaqs);
                        }
                    } catch {
                        // اگر JSON نبود، محتوا را به صورت HTML نمایش می‌دهیم
                    }
                }
            } catch {
                setError("خطا در دریافت محتوا");
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, []);

    // فیلتر سوالات بر اساس جستجو
    const filteredFaqs = faqs.filter(faq =>
        faq.question.includes(searchQuery) || faq.answer.includes(searchQuery)
    );

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

    return (
        <div className="min-h-screen bg-[#f1f5f9] pb-16" dir="rtl">
            {/* Hero Section */}
            <div className="cms-hero">
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className="text-3xl md:text-5xl font-black mb-4 drop-shadow-lg">
                        قوانین و سوالات متداول
                    </h1>
                    <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto font-light leading-relaxed">
                        هر چیزی که نیاز است درباره خرید، ارسال، پرداخت و ضمانت کالا در ایکیجی کالا بدانید، به صورت یکجا و شفاف برای شما آماده کرده‌ایم.
                    </p>
                </div>
                {/* Decorative background circle */}
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
            </div>

            {/* Main Content Container */}
            <div className="max-w-[850px] mx-auto px-4 -mt-16 relative z-20">
                {/* Search Box */}
                <div className="mb-12 relative shadow-2xl shadow-slate-200/50">
                    <input
                        type="text"
                        placeholder="جستجو در سوالات..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-8 py-5 pr-16 rounded-[24px] bg-white border border-slate-100 
                            text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-lg"
                    />
                    <Search size={24} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                {/* Categories & FAQs */}
                <div className="space-y-16 mb-12">
                    {/* Category Title: Purchase Process */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 border border-slate-50">
                            <HelpCircle className="w-6 h-6 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800">فرآیند خرید، قیمت و موجودی کالا</h2>
                    </div>

                    <div className="space-y-4">
                        {filteredFaqs.length > 0 ? (
                            filteredFaqs.map((faq, index) => (
                                <div
                                    key={index}
                                    className={`bg-white border rounded-[22px] transition-all duration-300 overflow-hidden ${openFAQ === index
                                            ? "border-blue-500 shadow-2xl shadow-blue-500/10 group"
                                            : "border-slate-200 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50"
                                        }`}
                                >
                                    <button
                                        onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                                        className={`w-full flex items-center justify-between p-6 text-right transition-colors ${openFAQ === index ? "bg-blue-50/50" : ""
                                            }`}
                                    >
                                        <span className={`font-bold text-lg md:text-xl transition-colors ${openFAQ === index ? "text-blue-700" : "text-slate-700"
                                            }`}>
                                            {faq.question}
                                        </span>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${openFAQ === index ? "bg-blue-600 rotate-180" : "bg-slate-50 text-slate-400"
                                            }`}>
                                            <ChevronDown
                                                size={18}
                                                className={openFAQ === index ? "text-white" : ""}
                                            />
                                        </div>
                                    </button>
                                    <div
                                        className={`overflow-hidden transition-all duration-500 ease-in-out ${openFAQ === index ? "max-h-[1000px] opacity-100 border-t border-dashed border-slate-200" : "max-h-0 opacity-0"
                                            }`}
                                    >
                                        <div className="p-8 pb-10 bg-[#fafafa]">
                                            <div
                                                className="cms-content text-slate-600 leading-[2.2] text-justify"
                                                dangerouslySetInnerHTML={{ __html: renderContent(faq.answer) }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50">
                                <Search size={64} className="text-slate-200 mx-auto mb-6" />
                                <p className="text-slate-500 text-xl font-bold">نتیجه‌ای یافت نشد</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-12 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-3 px-10 py-5 bg-white text-slate-500 rounded-[28px] font-bold shadow-xl shadow-slate-200/50 hover:text-blue-600 transition-all border border-slate-100 group"
                    >
                        <Home className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                        <span>بازگشت به فروشگاه</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
