import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-4">
      <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center">
        <AlertTriangle className="text-red-500" size={42} />
      </div>
      <h1 className="text-xl font-bold text-gray-800">محصولی پیدا نشد</h1>
      <p className="text-gray-500 text-center text-sm">
        ممکن است محصول حذف شده باشد یا آدرس نادرست باشد.
      </p>
      <div className="flex gap-3">
        <Link
          href="/products"
          className="px-5 py-3 bg-gray-100 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
        >
          مشاهده محصولات
        </Link>
        <Link
          href="/"
          className="px-5 py-3 bg-vita-500 text-white rounded-xl text-sm font-bold hover:bg-vita-600 transition-colors"
        >
          بازگشت به صفحه اصلی
        </Link>
      </div>
    </div>
  );
}
