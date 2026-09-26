import type { Metadata } from "next";
import Link from "next/link";
import { NOT_FOUND_METADATA } from "@/lib/seo";

// Phase 1 SEO (soft-404 fix): the 404 page gets its own title instead of
// inheriting the homepage title. With the root layout's title template
// ("%s | ای کا جی کالا") this renders as «صفحه یافت نشد | ای کا جی کالا».
export const metadata: Metadata = {
  ...NOT_FOUND_METADATA,
  description: "صفحه‌ای که دنبال آن بودید پیدا نشد.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center gap-4">
      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-black">
        404
      </div>
      <h1 className="text-2xl font-bold text-gray-800">صفحه مورد نظر یافت نشد</h1>
      <p className="text-gray-500 max-w-md">
        صفحه‌ای که به دنبال آن هستید موجود نیست یا منتقل شده است.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-kala-600 text-white font-semibold hover:bg-kala-700 transition"
        >
          صفحه اصلی
        </Link>
        <Link
          href="/products"
          className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition"
        >
          مشاهده محصولات
        </Link>
      </div>
    </div>
  );
}
