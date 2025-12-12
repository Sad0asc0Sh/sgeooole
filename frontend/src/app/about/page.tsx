"use client";

import { Building2, Shield, Award, Users, Wrench, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";

// Animation variants
const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
};

const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15
        }
    }
};

const cardVariant: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.5, ease: "easeOut" as const }
    }
};

// Brand data
const brands = [
    {
        name: "Dahua",
        description: "نمایندگی انحصاری محصولات با گارانتی معتبر ماد طلایی (Maad Talayi)",
        icon: "🎥"
    },
    {
        name: "Sailgis",
        description: "نمایندگی رسمی سیستم‌های نظارتی",
        icon: "📡"
    },
    {
        name: "Suzuki",
        description: "نمایندگی رسمی محصولات",
        icon: "🔧"
    },
    {
        name: "Vekra & Mover",
        description: "نماینده برتر جک‌های پارکینگی",
        icon: "🚗"
    },
    {
        name: "HSB",
        description: "نماینده انحصاری ریموت‌های کنترل تردد",
        icon: "🔑"
    }
];

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-gray-600 hover:text-vita-600 transition-colors"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-medium">بازگشت</span>
                        </Link>
                        <h1 className="text-lg font-bold text-gray-900">درباره ما</h1>
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            <motion.section
                className="relative overflow-hidden bg-gradient-to-br from-[#142755] via-[#1e3a7a] to-[#2a4d9f] py-16 px-4"
                initial="hidden"
                animate="visible"
                variants={fadeInUp}
            >
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-vita-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>

                <div className="container mx-auto relative z-10">
                    <motion.div
                        className="text-center max-w-3xl mx-auto"
                        variants={fadeInUp}
                    >
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm mb-6 shadow-lg">
                            <Building2 className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                            شرکت Welfvita
                        </h1>
                        <p className="text-lg text-blue-100 leading-relaxed">
                            پیشرو در ارائه سیستم‌های حفاظتی و امنیتی در استان خراسان
                        </p>
                    </motion.div>
                </div>
            </motion.section>

            {/* Main Content */}
            <motion.div
                className="container mx-auto px-4 py-10 space-y-10"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
            >
                {/* Introduction Card */}
                <motion.section
                    className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden"
                    variants={cardVariant}
                >
                    <div className="bg-gradient-to-l from-vita-50 to-blue-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-vita-500 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">معرفی شرکت</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-gray-700 leading-8 text-justify">
                            با افتخار، شرکت <span className="font-bold text-vita-600">Welfvita</span> (گروه مهندسی کیان سابق) به عنوان یکی از پیشگامان در زمینه ارائه و نصب سیستم‌های دوربین مداربسته و حفاظتی-امنیتی، از سال <span className="font-bold">۱۳۹۶</span> فعالیت خود را در شهر مشهد آغاز نموده است. در طول این سال‌ها، با تکیه بر تخصص، تعهد و ارائه محصولات با کیفیت، موفق به جلب رضایت و اعتماد گسترده مشتریان عزیز شده‌ایم.
                        </p>
                        <p className="text-gray-700 leading-8 text-justify">
                            این مجموعه با گسترش فعالیت‌های خود، هم اکنون دارای <span className="font-bold text-vita-600">سه شعبه فعال</span> در سراسر کلان‌شهر مشهد می‌باشد تا دسترسی و ارائه خدمات به شما عزیزان با سهولت و سرعت بیشتری انجام پذیرد. رمز موفقیت ما در بازار رقابتی امروز، ارائه قیمت‌های بی‌واسطه و منصفانه در کنار حفظ بالاترین سطح کیفی محصولات و خدمات بوده است.
                        </p>
                    </div>
                </motion.section>

                {/* Brands Section */}
                <motion.section
                    className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden"
                    variants={cardVariant}
                >
                    <div className="bg-gradient-to-l from-amber-50 to-yellow-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                                <Award className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">افتخارات و نمایندگی‌ها</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-gray-700 leading-8 mb-6">
                            ما با افتخار اعلام می‌داریم که به عنوان نماینده رسمی برندهای معتبر بین‌المللی در استان <span className="font-bold text-amber-600">خراسان بزرگ</span> فعالیت می‌کنیم:
                        </p>
                        <div className="grid gap-4">
                            {brands.map((brand, index) => (
                                <motion.div
                                    key={brand.name}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-l from-gray-50 to-white border border-gray-100 hover:border-vita-200 hover:shadow-md transition-all duration-300"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 * index }}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-vita-500 to-blue-600 flex items-center justify-center text-2xl shadow-lg">
                                        {brand.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 mb-1">{brand.name}</h3>
                                        <p className="text-sm text-gray-600">{brand.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.section>

                {/* Technical Team Section */}
                <motion.section
                    className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden"
                    variants={cardVariant}
                >
                    <div className="bg-gradient-to-l from-emerald-50 to-green-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                                <Wrench className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">تیم تخصصی تعمیرات</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-gray-700 leading-8 text-justify">
                            علاوه بر فروش و نصب، این شرکت دارای یکی از <span className="font-bold text-emerald-600">مجرب‌ترین و ماهرترین تیم‌های فنی</span> در حوزه تعمیرات تخصصی انواع سیستم‌های حفاظتی و امنیتی می‌باشد. این تیم متخصص، آماده ارائه خدمات پشتیبانی و رفع هرگونه مشکل در <span className="font-bold">کوتاه‌ترین زمان ممکن</span> است.
                        </p>
                    </div>
                </motion.section>

                {/* Mission Statement */}
                <motion.section
                    className="relative overflow-hidden bg-gradient-to-br from-[#142755] via-[#1e3a7a] to-[#2a4d9f] rounded-3xl shadow-xl p-8"
                    variants={cardVariant}
                >
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-60 h-60 bg-vita-500/10 rounded-full blur-3xl"></div>

                    <div className="relative z-10 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-6">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-lg text-white leading-8 max-w-2xl mx-auto">
                            ما در <span className="font-bold text-vita-300">Welfvita</span>، امنیت و آرامش شما را اولویت اصلی خود می‌دانیم و همواره در تلاشیم تا با ارائه راهکارهای نوین و خدماتی متمایز، بهترین تجربه را برای شما به ارمغان آوریم.
                        </p>
                    </div>
                </motion.section>

                {/* Stats Section */}
                <motion.section
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    variants={staggerContainer}
                >
                    {[
                        { number: "۱۳۹۶", label: "سال شروع فعالیت" },
                        { number: "۳", label: "شعبه فعال" },
                        { number: "۵+", label: "نمایندگی رسمی" },
                        { number: "۱۰۰۰+", label: "مشتری راضی" }
                    ].map((stat, index) => (
                        <motion.div
                            key={index}
                            className="bg-white rounded-2xl p-6 text-center shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-vita-200 transition-all duration-300"
                            variants={cardVariant}
                        >
                            <div className="text-2xl font-bold bg-gradient-to-l from-vita-600 to-blue-600 bg-clip-text text-transparent mb-2">
                                {stat.number}
                            </div>
                            <div className="text-sm text-gray-600">{stat.label}</div>
                        </motion.div>
                    ))}
                </motion.section>

                {/* Contact CTA */}
                <motion.section
                    className="bg-gradient-to-l from-vita-50 to-blue-50 rounded-3xl p-8 text-center border border-vita-100"
                    variants={cardVariant}
                >
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                        آماده همکاری با شما هستیم
                    </h3>
                    <p className="text-gray-600 mb-6">
                        برای مشاوره رایگان و کسب اطلاعات بیشتر با ما تماس بگیرید
                    </p>
                    <Link
                        href="/contact"
                        className="inline-flex items-center gap-2 bg-gradient-to-l from-vita-600 to-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-vita-500/30 transition-all duration-300"
                    >
                        تماس با ما
                        <ChevronLeft size={18} />
                    </Link>
                </motion.section>
            </motion.div>

            {/* Bottom spacing for mobile nav */}
            <div className="h-20"></div>
        </div>
    );
}
