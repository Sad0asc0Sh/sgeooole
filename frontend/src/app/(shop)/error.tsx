"use client";

import { useEffect } from "react";

export default function ShopError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Shop route error:", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center gap-4">
      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl font-black">
        !
      </div>
      <h1 className="text-2xl font-bold text-gray-800">خطا در بخش فروشگاه</h1>
      <p className="text-gray-500 max-w-md">در نمایش این بخش مشکلی پیش آمد. لطفاً دوباره تلاش کنید.</p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-kala-600 text-white font-semibold hover:bg-kala-700 transition"
        >
          تلاش مجدد
        </button>
        <a
          href="/"
          className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition"
        >
          صفحه اصلی
        </a>
      </div>
    </div>
  );
}
