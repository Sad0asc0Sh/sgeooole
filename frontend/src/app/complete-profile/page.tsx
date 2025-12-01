"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Shield, CheckCircle } from "lucide-react";
import { authService } from "@/services/authService";

export default function CompleteProfilePage() {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        password: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Check if user is authenticated
    useEffect(() => {
        const token = authService.getToken();
        if (!token) {
            router.push("/login");
        }
    }, [router]);

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError(null);
    };

    const validateForm = (): boolean => {
        if (!formData.firstName.trim()) {
            setError("نام الزامی است");
            return false;
        }

        if (!formData.lastName.trim()) {
            setError("نام خانوادگی الزامی است");
            return false;
        }

        if (!formData.password) {
            setError("رمز عبور الزامی است");
            return false;
        }

        if (formData.password.length < 6) {
            setError("رمز عبور باید حداقل 6 کاراکتر باشد");
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("رمز عبور و تکرار آن یکسان نیستند");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            setLoading(true);
            setError(null);

            await authService.completeProfile({
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                password: formData.password,
            });

            // Redirect to profile page
            router.push("/profile");
        } catch (err: any) {
            console.error("Profile completion error:", err);
            setError(err.message || "خطا در ذخیره اطلاعات. لطفا دوباره تلاش کنید.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-vita-50 to-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Header with Icon */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-vita-100 rounded-full mb-4">
                        <Shield className="text-vita-600" size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-welf-900 mb-2">
                        تکمیل حساب کاربری
                    </h1>
                    <p className="text-sm text-gray-500">
                        لطفا اطلاعات زیر را برای تکمیل ثبت‌نام وارد کنید
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center animate-in fade-in">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            {/* First Name Field */}
                            <div>
                                <label className="block text-sm font-bold text-welf-900 mb-2">
                                    نام
                                    <span className="text-red-500 mr-1">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="علی"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pr-10 focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                        value={formData.firstName}
                                        onChange={(e) => handleChange("firstName", e.target.value)}
                                        required
                                    />
                                    <User className="absolute right-3 top-4 text-gray-400" size={18} />
                                </div>
                            </div>

                            {/* Last Name Field */}
                            <div>
                                <label className="block text-sm font-bold text-welf-900 mb-2">
                                    نام خانوادگی
                                    <span className="text-red-500 mr-1">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="احمدی"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pr-10 focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                        value={formData.lastName}
                                        onChange={(e) => handleChange("lastName", e.target.value)}
                                        required
                                    />
                                    <User className="absolute right-3 top-4 text-gray-400" size={18} />
                                </div>
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-bold text-welf-900 mb-2">
                                رمز عبور
                                <span className="text-red-500 mr-1">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="حداقل 6 کاراکتر"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pr-12 focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    value={formData.password}
                                    onChange={(e) => handleChange("password", e.target.value)}
                                    minLength={6}
                                    required
                                />
                                <Lock className="absolute right-4 top-4 text-gray-400" size={20} />
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label className="block text-sm font-bold text-welf-900 mb-2">
                                تکرار رمز عبور
                                <span className="text-red-500 mr-1">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="تکرار رمز عبور"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pr-12 focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                                    required
                                />
                                <Lock className="absolute right-4 top-4 text-gray-400" size={20} />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !formData.firstName || !formData.lastName || !formData.password || !formData.confirmPassword}
                            className="w-full bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-vita-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                "در حال ذخیره..."
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    ثبت و ورود
                                </>
                            )}
                        </button>
                    </form>

                    {/* Info Box */}
                    <div className="bg-vita-50 border border-vita-200 rounded-xl p-4 mt-6">
                        <div className="flex gap-3">
                            <Shield className="text-vita-600 flex-shrink-0 mt-0.5" size={18} />
                            <div className="text-xs text-gray-600 leading-relaxed">
                                <p className="font-bold text-vita-700 mb-1">چرا رمز عبور؟</p>
                                <p>
                                    با تنظیم رمز عبور، می‌توانید علاوه بر ورود با پیامک یا گوگل،
                                    مستقیماً با شماره موبایل(ایمیل) و رمز عبور نیز وارد شوید.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
