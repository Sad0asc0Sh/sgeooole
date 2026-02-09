"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import { Lock, CheckCircle } from "lucide-react";

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  // Unwrap params for Next.js 15+
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (password.length < 6) {
      setStatus("error");
      setErrorMessage("رمز عبور باید حداقل ۶ کاراکتر باشد");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("رمز عبور و تکرار آن یکسان نیستند");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      await authService.resetPassword(token, password);
      setStatus("success");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "لینک نامعتبر یا منقضی شده است");
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-ekg-900 mb-2">رمز عبور تغییر کرد!</h2>
        <p className="text-sm text-gray-500 text-center mb-8">
          رمز عبور شما با موفقیت تغییر کرد.
          <br />
          در حال انتقال به صفحه ورود...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 bg-kala-100 text-kala-600 rounded-full flex items-center justify-center mb-6 mx-auto">
          <Lock size={32} />
        </div>

        <h1 className="text-2xl font-black text-ekg-900 mb-2 text-center">تنظیم رمز عبور جدید</h1>
        <p className="text-sm text-gray-500 mb-8 text-center">
          لطفاً رمز عبور جدید خود را وارد کنید
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">رمز عبور جدید</label>
            <input
              type="password"
              required
              className="w-full border border-gray-200 rounded-xl p-4 focus:border-kala-500 outline-none transition-all"
              placeholder="حداقل ۶ کاراکتر"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">تکرار رمز عبور</label>
            <input
              type="password"
              required
              className="w-full border border-gray-200 rounded-xl p-4 focus:border-kala-500 outline-none transition-all"
              placeholder="تکرار رمز عبور جدید"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {status === "error" && (
            <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kala-600 text-white py-4 rounded-xl font-bold hover:bg-kala-700 transition mt-6 disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-kala-200"
          >
            {loading ? "در حال ذخیره..." : "ذخیره رمز عبور جدید"}
          </button>
        </form>
      </div>
    </div>
  );
}
