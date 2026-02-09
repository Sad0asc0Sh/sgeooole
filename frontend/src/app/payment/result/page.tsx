"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      const authority = searchParams.get("Authority");
      const status = searchParams.get("Status");

      if (!authority) {
        setError("کد تراکنش یافت نشد");
        setVerifying(false);
        return;
      }

      // Check if user cancelled
      if (status === "NOK" || status === "Cancel") {
        setError("پرداخت توسط کاربر لغو شد");
        setVerifying(false);
        return;
      }

      // Verify payment with backend
      const res = await api.post("/orders/verify-payment", {
        Authority: authority,
        Status: status,
      });

      if (res.data.success) {
        setResult(res.data.data);
      } else {
        setError(res.data.message || "تایید پرداخت ناموفق بود");
      }
    } catch (err: any) {
      console.error("Payment verification error:", err);
      setError(
        err?.response?.data?.message ||
        "خطا در تایید پرداخت. لطفاً با پشتیبانی تماس بگیرید"
      );
    } finally {
      setVerifying(false);
    }
  };

  // Loading State
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-kala-50 to-purple-50">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <Loader2 className="w-16 h-16 text-kala-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">
            در حال تایید پرداخت...
          </h2>
          <p className="text-gray-500">
            لطفاً صبر کنید، در حال بررسی وضعیت پرداخت شما هستیم
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">
            پرداخت ناموفق
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>

          <div className="space-y-3">
            <Link
              href="/profile/orders"
              className="block w-full px-6 py-3 bg-kala-600 text-white rounded-xl font-bold hover:bg-kala-700 transition-colors"
            >
              مشاهده سفارش‌ها
            </Link>
            <Link
              href="/"
              className="block w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              بازگشت به صفحه اصلی
            </Link>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <p className="text-sm text-yellow-800">
              💡 اگر مبلغ از حساب شما کسر شده، طی 72 ساعت به حساب شما بازگردانده می‌شود.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-bounce-once">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>

        {/* Success Title */}
        <h2 className="text-2xl font-black text-gray-800 mb-3">
          پرداخت موفق! 🎉
        </h2>
        <p className="text-gray-600 mb-6">
          پرداخت شما با موفقیت انجام شد و سفارش شما ثبت گردید
        </p>

        {/* Payment Details */}
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-3 text-right">
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="text-gray-500 text-sm">شماره پیگیری:</span>
            <span className="font-bold text-gray-800 font-mono" dir="ltr">
              {result?.refId}
            </span>
          </div>

          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="text-gray-500 text-sm">شماره سفارش:</span>
            <span className="font-bold text-gray-800">
              #{result?.orderId?.toString().substring(0, 8)}
            </span>
          </div>

          {result?.cardPan && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">شماره کارت:</span>
              <span className="font-mono text-gray-800" dir="ltr">
                {result.cardPan}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href={`/profile/orders/${result?.orderId}`}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-kala-600 text-white rounded-xl font-bold hover:bg-kala-700 transition-colors shadow-sm"
          >
            مشاهده جزئیات سفارش
            <ArrowRight size={20} />
          </Link>

          <Link
            href="/profile/orders"
            className="block w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
          >
            لیست سفارش‌ها
          </Link>

          <Link
            href="/"
            className="block w-full px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
          >
            بازگشت به صفحه اصلی
          </Link>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800">
            📧 ایمیل تاییدیه سفارش به آدرس ایمیل شما ارسال شد
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-16 h-16 text-kala-600 animate-spin" />
      </div>
    }>
      <PaymentResultContent />
    </Suspense>
  );
}
