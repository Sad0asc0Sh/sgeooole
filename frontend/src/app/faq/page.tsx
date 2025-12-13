"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pageService, PageData } from "@/services/pageService";
import {
    HelpCircle,
    ChevronLeft,
    ChevronDown,
    Search,
    MessageCircle,
    Clock,
    AlertCircle,
    Loader2,
    Home,
    Phone,
    Mail
} from "lucide-react";

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

function FAQItem({ question, answer, isOpen, onClick }: {
    question: string;
    answer: string;
    isOpen: boolean;
    onClick: () => void;
}) {
    return (
        <div className={`border rounded-2xl transition-all duration-300 overflow-hidden ${isOpen
            ? "border-vita-300 bg-vita-50/50 shadow-lg shadow-vita-100/50"
            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
            }`}>
            <button
                onClick={onClick}
                className="w-full flex items-center justify-between p-5 md:p-6 text-right"
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isOpen
                        ? "bg-vita-500 text-white"
                        : "bg-gray-100 text-gray-500"
                        }`}>
                        <HelpCircle size={20} />
                    </div>
                    <span className={`font-bold text-base md:text-lg transition-colors ${isOpen ? "text-vita-700" : "text-gray-800"
                        }`}>
                        {question}
                    </span>
                </div>
                <ChevronDown
                    size={22}
                    className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-vita-500" : ""
                        }`}
                />
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="px-5 md:px-6 pb-5 md:pb-6 pr-[72px] md:pr-[88px]">
                    <p className="text-gray-600 leading-8 text-base">{answer}</p>
                </div>
            </div>
        </div>
    );
}

export default function FAQPage() {
    const [page, setPage] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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
            } catch (err: any) {
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
                    <Loader2 size={48} className="animate-spin text-vita-500 mx-auto" />
                    <p className="mt-4 text-gray-500 font-medium">در حال بارگذاری...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 md:py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <Link href="/" className="hover:text-vita-500 transition-colors flex items-center gap-1">
                        <Home size={16} />
                        خانه
                    </Link>
                    <ChevronLeft size={16} />
                    <span className="text-gray-700 font-medium">سوالات متداول</span>
                </nav>

                {/* Hero Header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-vita-500 via-vita-600 to-vita-700 rounded-3xl p-8 md:p-12 mb-8 text-white">
                    {/* Decorative patterns */}
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/30 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-400/30 rounded-full -translate-x-1/2 translate-y-1/2 blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-start gap-6">
                            <div className="hidden md:flex w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl items-center justify-center border border-white/20">
                                <MessageCircle size={40} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h1 className="text-3xl md:text-4xl font-black mb-4">
                                    سوالات متداول
                                </h1>
                                <p className="text-white/80 text-lg leading-relaxed max-w-2xl">
                                    پاسخ سوالات رایج کاربران را در اینجا بیابید. اگر سوال شما در لیست نیست، با ما تماس بگیرید.
                                </p>
                            </div>
                        </div>

                        {/* Search Box */}
                        <div className="mt-8 relative max-w-xl">
                            <input
                                type="text"
                                placeholder="جستجو در سوالات..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-6 py-4 pr-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 
                                    text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all"
                            />
                            <Search size={22} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/60" />
                        </div>
                    </div>
                </div>

                {/* FAQ List */}
                <div className="space-y-4 mb-12">
                    {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((faq, index) => (
                            <FAQItem
                                key={index}
                                question={faq.question}
                                answer={faq.answer}
                                isOpen={openFAQ === index}
                                onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
                            <Search size={48} className="text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">نتیجه‌ای یافت نشد</p>
                            <p className="text-gray-400 text-sm mt-1">عبارت جستجوی دیگری امتحان کنید</p>
                        </div>
                    )}
                </div>

                {/* Contact Section */}
                <div className="bg-gradient-to-br from-[#142755] to-[#1a3a7a] rounded-3xl p-8 text-white text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20">
                        <AlertCircle size={32} className="text-vita-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">پاسخ سوال خود را پیدا نکردید؟</h3>
                    <p className="text-gray-300 mb-8 max-w-lg mx-auto">
                        تیم پشتیبانی ما آماده پاسخگویی به سوالات شماست. از طریق راه‌های زیر با ما در تماس باشید.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link
                            href="/contact"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-vita-500 text-white rounded-xl font-bold hover:bg-vita-600 transition-all shadow-lg shadow-vita-500/25"
                        >
                            <Mail size={18} />
                            تماس با ما
                        </Link>
                        <a
                            href="tel:02144556677"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/20 transition-all border border-white/20"
                        >
                            <Phone size={18} />
                            تماس تلفنی
                        </a>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-vita-500 transition-colors group"
                    >
                        <Home size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span>بازگشت به صفحه اصلی</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
