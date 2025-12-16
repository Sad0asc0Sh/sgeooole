"use client";
import { CheckCircle2 } from "lucide-react";

export default function ValueProposition() {
    const benefits = [
        "تجربه و قدمت از سال ۱۳۹۶",
        "اصالت و گارانتی معتبر شرکتی",
        "قیمت رقابتی و حذف واسطه",
        "دپارتمان تخصصی تعمیرات سخت افزار",
        "دسترسی اسان (۳ شعبه فعال در مشهد)",
    ];

    return (
        <div className="py-8 md:py-12 lg:py-16 px-4 bg-welf-900 text-white">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 md:mb-10 text-center">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 md:mb-3">
                        چرا ویلف‌ویتا را انتخاب کنید؟
                    </h3>
                    <p className="text-welf-300 text-sm md:text-base">
                        ما فقط فروشنده نیستیم...
                    </p>
                </div>

                {/* Mobile: Single column, Desktop: 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-5">
                    {benefits.map((benefit, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 md:gap-4 p-3 md:p-4 lg:p-5 rounded-lg bg-welf-800/50 border border-welf-700 hover:border-[#D4AF37] hover:bg-welf-800/70 transition-all duration-300 hover:shadow-lg hover:shadow-[#D4AF37]/20"
                        >
                            <CheckCircle2
                                className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 flex-shrink-0"
                                style={{ color: '#D4AF37' }}
                            />
                            <span
                                className="text-sm md:text-base lg:text-lg text-welf-100 leading-relaxed"
                                style={{ color: '#F5F5F5' }}
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
