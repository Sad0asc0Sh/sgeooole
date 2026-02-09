"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Home, AlertTriangle, WifiOff, Clock, ChevronLeft } from "lucide-react";

type ProductErrorProps = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function ProductError({ error, reset }: ProductErrorProps) {
    const router = useRouter();
    const [retryCount, setRetryCount] = useState(0);
    const [isRetrying, setIsRetrying] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Determine error type
    const is429Error = error.message?.includes("429") || error.name === "RateLimitError";
    const isNetworkError = error.message?.toLowerCase().includes("network") ||
        error.message?.toLowerCase().includes("fetch");

    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.error("Product page error:", error);
        }
    }, [error]);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && isRetrying) {
            // Countdown finished, do the actual retry
            performRetry();
        }
    }, [countdown, isRetrying]);

    const performRetry = useCallback(() => {
        setIsRetrying(false);
        setRetryCount(prev => prev + 1);

        // Use router.refresh() to truly refetch server components
        router.refresh();

        // Also try reset() as a fallback
        setTimeout(() => {
            reset();
        }, 100);
    }, [router, reset]);

    const handleRetry = useCallback(() => {
        if (is429Error) {
            // For 429, start countdown before retry
            const delay = Math.min(5 + retryCount * 3, 30); // 5, 8, 11, 14... max 30 seconds
            setIsRetrying(true);
            setCountdown(delay);
        } else {
            // For other errors, retry immediately
            setIsRetrying(true);
            performRetry();
        }
    }, [is429Error, retryCount, performRetry]);

    const handleHardRefresh = useCallback(() => {
        // Force a full page reload
        window.location.reload();
    }, []);

    // Get appropriate icon and message based on error type
    const getErrorContent = () => {
        if (is429Error) {
            return {
                icon: <Clock className="w-8 h-8" />,
                title: "سرور شلوغ است",
                description: "سرور در حال حاضر درخواست‌های زیادی دریافت می‌کند. لطفاً کمی صبر کنید.",
                bgColor: "bg-amber-100",
                textColor: "text-amber-600",
                borderColor: "border-amber-200",
            };
        }
        if (isNetworkError) {
            return {
                icon: <WifiOff className="w-8 h-8" />,
                title: "خطا در اتصال",
                description: "لطفاً اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.",
                bgColor: "bg-blue-100",
                textColor: "text-blue-600",
                borderColor: "border-blue-200",
            };
        }
        return {
            icon: <AlertTriangle className="w-8 h-8" />,
            title: "خطا در بارگذاری محصول",
            description: "در بارگذاری اطلاعات محصول مشکلی پیش آمده است.",
            bgColor: "bg-red-100",
            textColor: "text-red-600",
            borderColor: "border-red-200",
        };
    };

    const content = getErrorContent();

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
            >
                {/* Error Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                        className={`w-20 h-20 ${content.bgColor} ${content.textColor} rounded-2xl mx-auto flex items-center justify-center mb-6`}
                    >
                        {content.icon}
                    </motion.div>

                    {/* Title */}
                    <h1 className="text-xl font-bold text-gray-800 mb-2">{content.title}</h1>

                    {/* Description */}
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">{content.description}</p>

                    {/* Retry Info */}
                    {retryCount > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs text-gray-400 mb-4"
                        >
                            تلاش شماره {retryCount + 1}
                        </motion.div>
                    )}

                    {/* Countdown Timer */}
                    <AnimatePresence>
                        {isRetrying && countdown > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`${content.bgColor} ${content.borderColor} border rounded-xl p-4 mb-6`}
                            >
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${content.textColor}`} />
                                    </motion.div>
                                    <span className={`text-sm font-medium ${content.textColor}`}>
                                        تلاش مجدد در
                                    </span>
                                </div>
                                <div className={`text-3xl font-bold ${content.textColor}`}>
                                    {countdown} ثانیه
                                </div>
                                <button
                                    onClick={() => {
                                        setIsRetrying(false);
                                        setCountdown(0);
                                    }}
                                    className="text-xs text-gray-500 hover:text-gray-700 mt-2 underline"
                                >
                                    لغو
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        {/* Primary Retry Button */}
                        {!isRetrying && (
                            <button
                                onClick={handleRetry}
                                className={`
                  w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                  bg-gradient-to-l from-kala-600 to-kala-500 text-white font-semibold
                  hover:from-kala-700 hover:to-kala-600 transition-all duration-200
                  shadow-lg shadow-kala-600/30
                `}
                            >
                                <RefreshCw className="w-5 h-5" />
                                <span>{is429Error ? `صبر و تلاش مجدد` : "تلاش مجدد"}</span>
                            </button>
                        )}

                        {/* Hard Refresh Button */}
                        <button
                            onClick={handleHardRefresh}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                bg-gray-100 text-gray-700 font-medium
                hover:bg-gray-200 transition-all duration-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>بارگذاری مجدد صفحه</span>
                        </button>

                        {/* Navigation Links */}
                        <div className="flex gap-2 pt-2">
                            <Link
                                href="/"
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                  bg-gray-50 text-gray-600 font-medium border border-gray-200
                  hover:bg-gray-100 transition-all duration-200"
                            >
                                <Home className="w-4 h-4" />
                                <span>صفحه اصلی</span>
                            </Link>
                            <button
                                onClick={() => window.history.back()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                  bg-gray-50 text-gray-600 font-medium border border-gray-200
                  hover:bg-gray-100 transition-all duration-200"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>بازگشت</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Technical Details (Development Only) */}
                {process.env.NODE_ENV === "development" && error?.message && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-4 bg-gray-900 text-gray-100 rounded-xl p-4 text-xs font-mono text-left overflow-auto max-h-32"
                    >
                        <div className="text-gray-400 mb-1">Error Details:</div>
                        {error.message}
                        {error.digest && (
                            <>
                                <br />
                                <span className="text-gray-500">Digest: {error.digest}</span>
                            </>
                        )}
                    </motion.div>
                )}

                {/* Tips for 429 Error */}
                {is429Error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-4 bg-white rounded-xl p-4 shadow-sm"
                    >
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 text-right">💡 راهنما</h3>
                        <ul className="text-xs text-gray-500 space-y-1 text-right">
                            <li>• چند ثانیه صبر کنید تا سرور آزاد شود</li>
                            <li>• از کلیک مکرر و سریع خودداری کنید</li>
                            <li>• در صورت تکرار مشکل، بعداً مراجعه کنید</li>
                        </ul>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
