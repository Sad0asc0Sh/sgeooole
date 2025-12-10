"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Newspaper, Clock, ArrowRight, Sparkles } from "lucide-react";

export default function BlogPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-col items-center justify-center px-4 py-12">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute top-20 left-10 w-64 h-64 bg-vita-100/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
                <motion.div
                    className="absolute bottom-20 right-10 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.5, 0.3, 0.5],
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-lg w-full text-center">
                {/* Icon Container */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                        delay: 0.1,
                    }}
                    className="relative mx-auto mb-8 w-28 h-28"
                >
                    {/* Outer Ring */}
                    <motion.div
                        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-vita-400 to-vita-600 shadow-xl"
                        animate={{
                            boxShadow: [
                                "0 10px 40px -10px rgba(34, 197, 94, 0.4)",
                                "0 20px 50px -10px rgba(34, 197, 94, 0.6)",
                                "0 10px 40px -10px rgba(34, 197, 94, 0.4)",
                            ],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />

                    {/* Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Newspaper className="w-14 h-14 text-white" strokeWidth={1.5} />
                    </div>

                    {/* Sparkle Effect */}
                    <motion.div
                        className="absolute -top-2 -right-2"
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 180, 360],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                    >
                        <Sparkles className="w-6 h-6 text-amber-400" />
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4"
                >
                    بلاگ وِلف ویتا
                </motion.h1>

                {/* Coming Soon Badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full mb-6"
                >
                    <Clock className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 font-semibold">به زودی...</span>
                </motion.div>

                {/* Description */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-gray-600 text-lg leading-relaxed mb-8 px-4"
                >
                    ما در حال آماده‌سازی مقالات جذاب و مفید درباره
                    <span className="text-vita-600 font-semibold"> خانه‌هوشمند</span>،
                    <span className="text-vita-600 font-semibold"> امنیت</span> و
                    <span className="text-vita-600 font-semibold"> حفاظت </span>
                    هستیم. به زودی می‌توانید از محتوای ارزشمند ما بهره‌مند شوید.
                </motion.p>

                {/* Feature Pills */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-wrap justify-center gap-3 mb-10"
                >
                    {["مقالات سلامت", "راهنمای مکمل‌ها", "نکات تغذیه‌ای", "سبک زندگی"].map(
                        (item, index) => (
                            <motion.span
                                key={item}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.7 + index * 0.1 }}
                                whileHover={{ scale: 1.05 }}
                                className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl text-sm text-gray-600 shadow-sm"
                            >
                                {item}
                            </motion.span>
                        )
                    )}
                </motion.div>

                {/* CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                >
                    <Link
                        href="/"
                        className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:from-vita-600 hover:to-vita-700 transition-all duration-300"
                    >
                        <span>بازگشت به صفحه اصلی</span>
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                    </Link>
                </motion.div>

                {/* Progress Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-12"
                >
                    <p className="text-sm text-gray-400 mb-3">در حال توسعه...</p>
                    <div className="w-48 h-2 mx-auto bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-vita-400 to-vita-600 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: "60%" }}
                            transition={{
                                duration: 1.5,
                                delay: 1.2,
                                ease: "easeOut",
                            }}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
