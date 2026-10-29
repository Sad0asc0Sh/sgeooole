"use client";
import { CheckCircle2 } from "lucide-react";

export default function ValueProposition() {
    const benefits = [
        "قدمت، اعتبار و خوش‌نامی از سال ۱۳۹۶",
        "تنوع گسترده کالاهای تکنولوژی و دیجیتال بدون محدودیت",
        "تأمین مستقیم از شبکه تأمین‌کنندگان معتبر با قیمت رقابتی",
        "تضمین اصالت کالا، کنترل سلامت و گارانتی معتبر",
        "پشتیبانی واقعی، ارسال سراسری و ۳ پایگاه فعال در مشهد",
    ];

    return (
        <div className="py-8 md:py-12 lg:py-16 px-4 bg-ekg-900 text-white relative overflow-hidden">
            {/* Subtle radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(180,83,9,0.12),transparent_60%)]" />
            <div className="max-w-7xl mx-auto relative">
                <div className="mb-6 md:mb-10 text-center">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 md:mb-3">
                        چرا ای‌کا‌جی کالا را انتخاب کنید؟
                    </h3>
                    <p className="text-ekg-400 text-sm md:text-base">
                        همراه مطمئن خرید آنلاین شما؛ شکل‌گرفته بر پایه امنیت، اصالت و آرامش خاطر
                    </p>
                </div>

                {/* Mobile: Single column, Desktop: 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-5">
                    {benefits.map((benefit, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 md:gap-4 p-3 md:p-4 lg:p-5 rounded-xl bg-ekg-800/60 border border-ekg-700/60 hover:border-kala-600/50 hover:bg-ekg-800/80 transition-all duration-300 hover:shadow-lg hover:shadow-kala-900/10"
                        >
                            <CheckCircle2
                                className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 flex-shrink-0 text-kala-500"
                            />
                            <span
                                className="text-sm md:text-base lg:text-lg text-ekg-200 leading-relaxed"
                            >
                                {benefit}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
