"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Home, AlertTriangle, WifiOff, Clock } from "lucide-react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorPageProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Global error boundary:", error);
    }
  }, [error]);

  // Detect error type
  const is429Error = error.message?.includes("429");
  const isNetworkError = error.message?.toLowerCase().includes("network") ||
    error.message?.toLowerCase().includes("fetch");

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    // For 429 errors, wait a bit before retrying
    if (is429Error) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    reset();
    setIsRetrying(false);
  };

  // Get icon and colors based on error type
  const getErrorStyle = () => {
    if (is429Error) {
      return {
        icon: <Clock className="w-8 h-8" />,
        bgColor: "bg-amber-100",
        textColor: "text-amber-600",
        title: "درخواست‌های زیادی ارسال شده",
        message: "سرور موقتاً درخواست‌های شما را محدود کرده است. چند ثانیه صبر کنید و دوباره تلاش کنید.",
      };
    }
    if (isNetworkError) {
      return {
        icon: <WifiOff className="w-8 h-8" />,
        bgColor: "bg-blue-100",
        textColor: "text-blue-600",
        title: "خطا در اتصال",
        message: "لطفاً اتصال اینترنت خود را بررسی کنید.",
      };
    }
    return {
      icon: <AlertTriangle className="w-8 h-8" />,
      bgColor: "bg-red-100",
      textColor: "text-red-600",
      title: "مشکلی پیش آمده است",
      message: "در پردازش درخواست شما خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    };
  };

  const style = getErrorStyle();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4 text-center gap-4">
      <div className={`w-20 h-20 ${style.bgColor} ${style.textColor} rounded-2xl flex items-center justify-center shadow-lg`}>
        {style.icon}
      </div>

      <h1 className="text-2xl font-bold text-gray-800">{style.title}</h1>
      <p className="text-gray-500 max-w-md">{style.message}</p>

      {retryCount > 0 && (
        <p className="text-xs text-gray-400">تلاش شماره {retryCount + 1}</p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="px-6 py-3 rounded-xl bg-gradient-to-l from-vita-600 to-vita-500 text-white font-semibold 
            hover:from-vita-700 hover:to-vita-600 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-vita-600/30 flex items-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? "در حال تلاش..." : "تلاش مجدد"}</span>
        </button>
        <a
          href="/"
          className="px-6 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold 
            hover:bg-gray-100 transition-all duration-200 flex items-center gap-2"
        >
          <Home className="w-5 h-5" />
          <span>صفحه اصلی</span>
        </a>
      </div>

      {/* Tips for users */}
      {is429Error && (
        <div className="mt-4 bg-white rounded-xl p-4 shadow-sm max-w-md text-right">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 justify-end">
            💡 راهنما
          </h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• چند ثانیه صبر کنید و سپس تلاش کنید</li>
            <li>• از رفرش کردن مکرر صفحه خودداری کنید</li>
          </ul>
        </div>
      )}

      {process.env.NODE_ENV === "development" && error?.message && (
        <pre className="mt-4 text-xs bg-gray-900 text-gray-100 border border-gray-700 rounded-lg p-3 max-w-2xl text-left overflow-auto">
          {error.message}
          {error.digest ? `\nDigest: ${error.digest}` : ""}
        </pre>
      )}
    </div>
  );
}

