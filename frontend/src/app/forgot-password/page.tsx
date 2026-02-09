"use client";
import { useState } from "react";
import { authService } from "@/services/authService";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      await authService.forgotPassword(email);
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "خطا در ارسال ایمیل");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
          <Mail size={32} />
        </div>
        <h2 className="text-xl font-bold text-ekg-900 mb-2">ایمیل ارسال شد</h2>
        <p className="text-sm text-gray-500 text-center mb-8 max-w-sm">
          لطفاً صندوق ورودی ایمیل خود را برای لینک بازیابی رمز عبور بررسی کنید.
        </p>
        <Link href="/login" className="text-kala-600 font-bold text-sm hover:text-kala-700 transition">
          بازگشت به صفحه ورود
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="inline-flex items-center text-gray-400 mb-8 text-sm hover:text-gray-600 transition"
        >
          <ArrowLeft size={16} className="mr-1" />
          بازگشت
        </Link>

        <h1 className="text-2xl font-black text-ekg-900 mb-2">بازیابی رمز عبور</h1>
        <p className="text-sm text-gray-500 mb-8">
          ایمیل خود را وارد کنید تا لینک تغییر رمز عبور برای شما ارسال شود.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">ایمیل</label>
            <input
              type="email"
              required
              className="w-full border border-gray-200 rounded-xl p-4 text-left dir-ltr focus:border-kala-500 outline-none transition-all"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
            />
          </div>

          {status === "error" && (
            <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-ekg-900 text-white py-4 rounded-xl font-bold hover:bg-ekg-800 transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "در حال ارسال..." : "ارسال لینک بازیابی"}
          </button>
        </form>
      </div>
    </div>
  );
}
