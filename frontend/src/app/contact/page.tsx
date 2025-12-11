"use client";

import { MapPin, Phone, Building2, ChevronLeft, Clock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

// Animation variants
const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
} as const;

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15
        }
    }
} as const;

const cardVariant = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.5, ease: "easeOut" }
    }
} as const;

// Branch data
const branches = [
    {
        id: 1,
        name: "شعبه ۱",
        address: "بلوار پیروزی نبش پیروزی ۷۸ (کنار املاک) پلاک 78",
        phones: ["05135021720"],
        color: "from-vita-500 to-blue-600",
        bgColor: "from-vita-50 to-blue-50",
        borderColor: "border-vita-200"
    },
    {
        id: 2,
        name: "شعبه ۲",
        address: "میدان صاحب الزمان پاساژ سبحان طبقه +۱ واحد ۱۶",
        phones: ["05137136355", "05137136356"],
        color: "from-emerald-500 to-teal-600",
        bgColor: "from-emerald-50 to-teal-50",
        borderColor: "border-emerald-200"
    },
    {
        id: 3,
        name: "شعبه ۳",
        address: "خین عرب طرح چی6 - پ63",
        phones: ["09154191788"],
        color: "from-amber-500 to-orange-600",
        bgColor: "from-amber-50 to-orange-50",
        borderColor: "border-amber-200"
    }
];

export default function ContactPage() {
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
                        <h1 className="text-lg font-bold text-gray-900">تماس با ما</h1>
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
                            گروه مهندسی کیان
                        </h1>
                        <p className="text-lg text-blue-100 leading-relaxed">
                            فروش و پخش انواع سیستم‌های حفاظتی امنیتی
                        </p>
                        <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                            <MapPin className="w-5 h-5 text-vita-300" />
                            <span className="text-white font-medium">مشهد</span>
                        </div>
                    </motion.div>
                </div>
            </motion.section>

            {/* Main Content */}
            <motion.div
                className="container mx-auto px-4 py-10 space-y-6"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
            >
                {/* Branches Grid */}
                {branches.map((branch, index) => (
                    <motion.div
                        key={branch.id}
                        className={`bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300`}
                        variants={cardVariant}
                    >
                        {/* Branch Header */}
                        <div className={`bg-gradient-to-l ${branch.bgColor} px-6 py-4 border-b ${branch.borderColor}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${branch.color} flex items-center justify-center shadow-lg`}>
                                    <span className="text-white font-bold text-lg">{branch.id}</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{branch.name}</h2>
                                    <p className="text-sm text-gray-500">گروه مهندسی کیان</p>
                                </div>
                            </div>
                        </div>

                        {/* Branch Content */}
                        <div className="p-6 space-y-5">
                            {/* Address */}
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${branch.color} flex items-center justify-center flex-shrink-0`}>
                                    <MapPin className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 mb-1">آدرس</p>
                                    <p className="text-gray-800 font-medium leading-7">{branch.address}</p>
                                </div>
                            </div>

                            {/* Phones */}
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${branch.color} flex items-center justify-center flex-shrink-0`}>
                                    <Phone className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 mb-2">شماره تماس</p>
                                    <div className="flex flex-wrap gap-3">
                                        {branch.phones.map((phone, phoneIndex) => (
                                            <a
                                                key={phoneIndex}
                                                href={`tel:${phone}`}
                                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l ${branch.bgColor} border ${branch.borderColor} hover:shadow-md transition-all duration-300`}
                                            >
                                                <Phone className="w-4 h-4 text-gray-600" />
                                                <span className="font-mono font-bold text-gray-800 tracking-wide" dir="ltr">
                                                    {phone}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}

                {/* Working Hours Card */}
                <motion.div
                    className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden"
                    variants={cardVariant}
                >
                    <div className="bg-gradient-to-l from-purple-50 to-indigo-50 px-6 py-4 border-b border-purple-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">ساعات کاری</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-sm text-gray-500 mb-1">شنبه تا چهارشنبه</p>
                                <p className="font-bold text-gray-800">۹ صبح - ۹ شب</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-sm text-gray-500 mb-1">پنج‌شنبه</p>
                                <p className="font-bold text-gray-800">۹ صبح - ۶ عصر</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Quick Contact CTA */}
                <motion.section
                    className="relative overflow-hidden bg-gradient-to-br from-[#142755] via-[#1e3a7a] to-[#2a4d9f] rounded-3xl shadow-xl p-8"
                    variants={cardVariant}
                >
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-60 h-60 bg-vita-500/10 rounded-full blur-3xl"></div>

                    <div className="relative z-10 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-6">
                            <MessageCircle className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">
                            نیاز به مشاوره دارید؟
                        </h3>
                        <p className="text-blue-100 mb-6 max-w-md mx-auto">
                            کارشناسان ما آماده پاسخگویی به سوالات شما هستند
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <a
                                href="tel:05135021720"
                                className="inline-flex items-center justify-center gap-2 bg-white text-[#142755] px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all duration-300"
                            >
                                <Phone size={18} />
                                <span dir="ltr">051-35021720</span>
                            </a>
                            <a
                                href="https://wa.me/989154191788"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-600 hover:shadow-lg transition-all duration-300"
                            >
                                <MessageCircle size={18} />
                                واتساپ
                            </a>
                        </div>
                    </div>
                </motion.section>

                {/* Back to About */}
                <motion.div
                    className="text-center"
                    variants={cardVariant}
                >
                    <Link
                        href="/about"
                        className="inline-flex items-center gap-2 text-vita-600 hover:text-vita-700 font-medium transition-colors"
                    >
                        <span>درباره ما بیشتر بدانید</span>
                        <ChevronLeft size={18} />
                    </Link>
                </motion.div>
            </motion.div>

            {/* Bottom spacing for mobile nav */}
            <div className="h-20"></div>
        </div>
    );
}
