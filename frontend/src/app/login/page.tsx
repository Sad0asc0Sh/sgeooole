"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone, Timer, ChevronLeft, Lock, User, Mail, CheckCircle } from "lucide-react";
import Link from "next/link";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { authService } from "@/services/authService";
import { cartService } from "@/services/cartService";

// Google Icon Component
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
);

type LoginMethod = "otp" | "password";
type RecoveryMethod = "mobile" | "email";

export default function LoginPage() {
    const [loginMethod, setLoginMethod] = useState<LoginMethod>("otp");
    const [step, setStep] = useState<"phone" | "otp" | "recovery-input" | "recovery-otp" | "recovery-password" | "recovery-email-sent">("phone");
    const [isRecovery, setIsRecovery] = useState(false);
    const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod>("mobile");

    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [timer, setTimer] = useState(120);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Password login state
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    const router = useRouter();

    // Countdown Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if ((step === "otp" || step === "recovery-otp") && timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const handlePhoneSubmit = async (isRecoveryFlow = false) => {
        // Normalize phone number to match backend pattern 09xxxxxxxxx
        const digitsOnly = phone.replace(/\D/g, "");
        let normalized = digitsOnly;

        // Handle common Iranian formats: 9891..., 9xxxxxxxxx
        if (normalized.startsWith("98") && normalized.length === 12) {
            normalized = "0" + normalized.slice(2);
        } else if (normalized.length === 10 && normalized.startsWith("9")) {
            normalized = "0" + normalized;
        }

        if (!/^09\d{9}$/.test(normalized)) {
            setError("شماره موبایل نامعتبر است. فرمت صحیح: 09xxxxxxxxx");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await authService.sendOtp(normalized);

            if (response.success) {
                // Keep normalized value for OTP step and backend consistency
                setPhone(normalized);
                setStep(isRecoveryFlow ? "recovery-otp" : "otp");
                setTimer(response.expiresIn || 120);
            } else {
                setError(response.message || "خطا در ارسال کد تایید");
            }
        } catch (err: any) {
            console.error("OTP send error:", err);
            setError(err.message || "خطا در ارسال کد تایید. لطفا دوباره تلاش کنید.");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailRecoverySubmit = async () => {
        if (!email || !email.includes("@")) {
            setError("لطفا یک ایمیل معتبر وارد کنید");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await authService.forgotPassword(email);
            setStep("recovery-email-sent");
        } catch (err: any) {
            console.error("Email recovery error:", err);
            setError(err.message || "خطا در ارسال ایمیل بازیابی");
        } finally {
            setLoading(false);
        }
    };

    // Helper function to sync local cart with server
    const syncLocalCart = async () => {
        try {
            const localCartKey = "welfvita_cart";
            const localCartData = localStorage.getItem(localCartKey);

            if (!localCartData) {
                return;
            }

            const localCart = JSON.parse(localCartData);

            const itemsToSync = localCart.map((item: any) => ({
                product: item.id || item.product,
                quantity: item.qty || item.quantity || 1,
                variantOptions: item.variantOptions,
            }));

            if (itemsToSync.length > 0) {
                await cartService.syncCart(itemsToSync);
                localStorage.removeItem(localCartKey);
            }
        } catch (error) {
            console.error("[CART SYNC] Error syncing cart:", error);
        }
    };

    const handleOtpSubmit = async () => {
        if (!/^\d{4}$/.test(otp)) {
            setError("کد تأیید باید ۴ رقم عددی باشد.");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await authService.verifyOtp(phone, otp);

            if (response.success && response.data?.token) {
                // If this is recovery flow, go to set password step
                if (step === "recovery-otp") {
                    setStep("recovery-password");
                    return;
                }

                await syncLocalCart();

                // Check if profile is complete
                if (response.isProfileComplete === false || response.data.isProfileComplete === false) {
                    router.push("/complete-profile");
                } else {
                    router.push("/profile");
                }
            } else {
                setError(response.message || "کد تایید نامعتبر است");
            }
        } catch (err: any) {
            console.error("OTP verify error:", err);
            setError(err.message || "کد تایید نامعتبر است. لطفا دوباره تلاش کنید.");
        } finally {
            setLoading(false);
        }
    };

    const handleSetNewPassword = async () => {
        if (newPassword.length < 6) {
            setError("رمز عبور باید حداقل ۶ کاراکتر باشد");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await authService.updateProfile({ password: newPassword });

            await syncLocalCart();
            router.push("/profile");
        } catch (err: any) {
            console.error("Set password error:", err);
            setError(err.message || "خطا در تغییر رمز عبور");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) {
            setError("خطا در دریافت اطلاعات از گوگل");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            console.log("[GOOGLE LOGIN] Authenticating with backend...");

            const response = await authService.loginWithGoogle(credentialResponse.credential);

            if (response.success) {
                await syncLocalCart();

                // Check if profile is complete
                if (response.isProfileComplete === false || response.data?.isProfileComplete === false) {
                    router.push("/complete-profile");
                } else {
                    router.push("/profile");
                }
            } else {
                setError(response.message || "خطا در ورود با گوگل");
            }
        } catch (err: any) {
            console.error("[GOOGLE LOGIN] Error:", err);
            setError(err.message || "خطا در ورود با گوگل. لطفا دوباره تلاش کنید.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        console.error("[GOOGLE LOGIN] Login failed");
        setError("خطا در ورود با گوگل. لطفا دوباره تلاش کنید.");
    };

    const handlePasswordSubmit = async () => {
        if (!identifier || !password) return;

        try {
            setLoading(true);
            setError(null);

            const response = await authService.loginWithPassword(identifier, password);

            if (response.success && response.data?.token) {
                await syncLocalCart();
                router.push("/profile");
            } else {
                setError(response.message || "نام کاربری یا رمز عبور اشتباه است");
            }
        } catch (err: any) {
            console.error("Password login error:", err);
            setError(err.message || "خطا در ورود. لطفا دوباره تلاش کنید.");
        } finally {
            setLoading(false);
        }
    };

    const startRecovery = () => {
        setIsRecovery(true);
        setLoginMethod("otp");
        setStep("recovery-input");
        setRecoveryMethod("mobile");
        setError(null);
        setPhone("");
        setEmail("");
        setOtp("");
    };

    const cancelRecovery = () => {
        setIsRecovery(false);
        setLoginMethod("password");
        setStep("phone"); // Reset step
        setError(null);
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
            {/* Back Button */}
            <Link href="/" className="absolute top-6 left-6 p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100 transition">
                <ChevronLeft size={24} />
            </Link>

            {/* Brand Logo */}
            <div className="mb-12 text-center">
                <h1 className="text-3xl font-black text-gray-300 tracking-tighter">
                    WELF<span className="text-vita-600">VITA</span>
                </h1>
                <p className="text-xs text-gray-400 mt-2">
                    {isRecovery ? "بازیابی رمز عبور" : "ورود | ثبت‌نام"}
                </p>
            </div>

            <div className="w-full max-w-xs space-y-6">
                {/* Login Method Tabs - Hide in Recovery Mode */}
                {!isRecovery && (
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => {
                                setLoginMethod("otp");
                                setStep("phone");
                                setError(null);
                            }}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${loginMethod === "otp"
                                ? "bg-white text-vita-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            پیامک / گوگل
                        </button>
                        <button
                            onClick={() => {
                                setLoginMethod("password");
                                setError(null);
                            }}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${loginMethod === "password"
                                ? "bg-white text-vita-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            رمز عبور
                        </button>
                    </div>
                )}

                {/* Error Message Display */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center animate-in fade-in slide-in-from-top duration-300">
                        {error}
                    </div>
                )}

                {isRecovery ? (
                    // --- RECOVERY FLOW ---
                    <div className="animate-in fade-in slide-in-from-right duration-500">
                        {step === "recovery-input" && (
                            <>
                                <div className="text-center mb-6">
                                    <p className="text-sm text-gray-600">
                                        روش بازیابی رمز عبور را انتخاب کنید:
                                    </p>
                                </div>

                                {/* Recovery Method Tabs */}
                                <div className="flex gap-2 p-1 bg-gray-50 rounded-xl mb-6">
                                    <button
                                        onClick={() => {
                                            setRecoveryMethod("mobile");
                                            setError(null);
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${recoveryMethod === "mobile"
                                            ? "bg-white text-vita-600 shadow-sm"
                                            : "text-gray-400 hover:text-gray-600"
                                            }`}
                                    >
                                        پیامک (موبایل)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRecoveryMethod("email");
                                            setError(null);
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${recoveryMethod === "email"
                                            ? "bg-white text-vita-600 shadow-sm"
                                            : "text-gray-400 hover:text-gray-600"
                                            }`}
                                    >
                                        ایمیل (لینک)
                                    </button>
                                </div>

                                {recoveryMethod === "mobile" ? (
                                    <>
                                        <label className="block text-sm font-bold text-welf-900 mb-2">شماره موبایل</label>
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                placeholder="09xxxxxxxxx"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-lg tracking-widest focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                                maxLength={11}
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handlePhoneSubmit(true)}
                                            />
                                            <Smartphone className="absolute right-4 top-4 text-gray-400" size={20} />
                                        </div>
                                        <button
                                            onClick={() => handlePhoneSubmit(true)}
                                            disabled={phone.length < 10 || loading}
                                            className="w-full mt-6 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-vita-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                        >
                                            {loading ? "در حال ارسال..." : "ارسال کد بازیابی"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <label className="block text-sm font-bold text-welf-900 mb-2">ایمیل</label>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                placeholder="example@gmail.com"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-base focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleEmailRecoverySubmit()}
                                            />
                                            <Mail className="absolute right-4 top-4 text-gray-400" size={20} />
                                        </div>
                                        <button
                                            onClick={handleEmailRecoverySubmit}
                                            disabled={!email || !email.includes("@") || loading}
                                            className="w-full mt-6 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-vita-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                        >
                                            {loading ? "در حال ارسال..." : "ارسال لینک بازیابی"}
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={cancelRecovery}
                                    className="w-full mt-4 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                                >
                                    بازگشت به ورود
                                </button>
                            </>
                        )}

                        {step === "recovery-email-sent" && (
                            <div className="text-center animate-in fade-in slide-in-from-right duration-500">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-welf-900 mb-2">ایمیل ارسال شد!</h3>
                                <p className="text-sm text-gray-500 mb-6 leading-6">
                                    لینک بازیابی رمز عبور به ایمیل <strong>{email}</strong> ارسال شد. لطفاً صندوق ورودی (و پوشه اسپم) خود را بررسی کنید.
                                </p>
                                <button
                                    onClick={cancelRecovery}
                                    className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-all"
                                >
                                    بازگشت به صفحه ورود
                                </button>
                            </div>
                        )}

                        {step === "recovery-otp" && (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <button onClick={() => setStep("recovery-input")} className="p-2 -mr-2 text-gray-400 hover:text-gray-800">
                                        <ArrowRight size={20} />
                                    </button>
                                    <span className="text-sm font-medium text-gray-600">{phone}</span>
                                </div>

                                <label className="block text-center text-sm font-bold text-welf-900 mb-4">کد تایید را وارد کنید</label>

                                <input
                                    type="tel"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-2xl tracking-[1em] font-bold focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    maxLength={4}
                                    placeholder="- - - -"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleOtpSubmit()}
                                />

                                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 font-mono">
                                    <Timer size={14} />
                                    <span>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</span>
                                </div>

                                <button
                                    onClick={handleOtpSubmit}
                                    disabled={otp.length < 4 || loading}
                                    className="w-full mt-6 bg-welf-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {loading ? "در حال بررسی..." : "تایید و ادامه"}
                                </button>
                            </>
                        )}

                        {step === "recovery-password" && (
                            <>
                                <div className="text-center mb-6">
                                    <p className="text-sm text-gray-600 font-bold text-green-600">
                                        هویت شما تایید شد.
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        لطفاً رمز عبور جدید خود را وارد کنید.
                                    </p>
                                </div>

                                <label className="block text-sm font-bold text-welf-900 mb-2">رمز عبور جدید</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="******"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-left focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all font-mono text-lg tracking-widest"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSetNewPassword()}
                                        dir="ltr"
                                    />
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                </div>

                                <button
                                    onClick={handleSetNewPassword}
                                    disabled={newPassword.length < 6 || loading}
                                    className="w-full mt-6 bg-welf-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {loading ? "در حال ثبت..." : "تغییر رمز عبور و ورود"}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    // --- NORMAL LOGIN FLOW ---
                    <>
                        {loginMethod === "otp" ? (
                            <>
                                {step === "phone" ? (
                                    // --- Phase 1: Phone Number ---
                                    <div className="animate-in fade-in slide-in-from-right duration-500">
                                        <label className="block text-sm font-bold text-welf-900 mb-2">شماره موبایل</label>
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                placeholder="09xxxxxxxxx"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-lg tracking-widest focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                                maxLength={11}
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handlePhoneSubmit()}
                                            />
                                            <Smartphone className="absolute right-4 top-4 text-gray-400" size={20} />
                                        </div>
                                        <button
                                            onClick={() => handlePhoneSubmit(false)}
                                            disabled={phone.length < 10 || loading}
                                            className="w-full mt-6 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-vita-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                        >
                                            {loading ? "در حال ارسال..." : "دریافت کد تایید"}
                                        </button>

                                        {/* Divider */}
                                        <div className="relative my-8">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t border-gray-100"></span>
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-white px-2 text-gray-400">یا ورود با</span>
                                            </div>
                                        </div>

                                        {/* Google Login Button */}
                                        <div className="w-full">
                                            <GoogleLogin
                                                onSuccess={handleGoogleSuccess}
                                                onError={handleGoogleError}
                                                useOneTap
                                                theme="outline"
                                                size="large"
                                                text="signin_with"
                                                shape="rectangular"
                                                logo_alignment="left"
                                                width="100%"
                                            />
                                        </div>

                                        {/* UX Hints */}
                                        <p className="text-[10px] text-gray-400 text-center mt-6 leading-5">
                                            با ورود به ولف‌ویتا، <span className="text-welf-900 underline decoration-dotted">قوانین و حریم خصوصی</span> را می‌پذیرید.
                                            <br />
                                            <span className="text-gray-500 font-medium">(ثبت‌نام به صورت خودکار انجام می‌شود)</span>
                                        </p>
                                    </div>
                                ) : (
                                    // --- Phase 2: OTP Code ---
                                    <div className="animate-in fade-in slide-in-from-right duration-500">
                                        <div className="flex items-center justify-between mb-6">
                                            <button onClick={() => setStep("phone")} className="p-2 -mr-2 text-gray-400 hover:text-gray-800">
                                                <ArrowRight size={20} />
                                            </button>
                                            <span className="text-sm font-medium text-gray-600">{phone}</span>
                                        </div>

                                        <label className="block text-center text-sm font-bold text-welf-900 mb-4">کد تایید را وارد کنید</label>

                                        <input
                                            type="tel"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-2xl tracking-[1em] font-bold focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                            maxLength={4}
                                            placeholder="- - - -"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleOtpSubmit()}
                                        />

                                        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 font-mono">
                                            <Timer size={14} />
                                            <span>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</span>
                                        </div>

                                        <button
                                            onClick={handleOtpSubmit}
                                            disabled={otp.length < 4 || loading}
                                            className="w-full mt-6 bg-welf-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            {loading ? "در حال بررسی..." : "ورود به حساب"}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            // --- Password Login Form ---
                            <div className="animate-in fade-in slide-in-from-right duration-500 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-welf-900 mb-2">ایمیل / شماره موبایل</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="شماره‌موبایل یا ایمیل"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-left focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all font-mono text-sm"
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            dir="ltr"
                                        />
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-welf-900">رمز عبور</label>
                                        <button
                                            onClick={startRecovery}
                                            className="text-xs text-vita-600 font-bold hover:underline"
                                        >
                                            فراموشی رمز عبور؟
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            placeholder="******"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-left focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all font-mono text-lg tracking-widest"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                                            dir="ltr"
                                        />
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    </div>
                                </div>

                                <button
                                    onClick={handlePasswordSubmit}
                                    disabled={!identifier || !password || loading}
                                    className="w-full mt-6 bg-welf-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {loading ? "در حال ورود..." : "ورود"}
                                </button>

                                <p className="text-xs text-center text-gray-500 mt-4 leading-6">
                                    حساب کاربری ندارید؟
                                    <br />
                                    برای ثبت‌نام یا ورود سریع، به تب
                                    <button
                                        onClick={() => {
                                            setLoginMethod("otp");
                                            setStep("phone");
                                            setError(null);
                                        }}
                                        className="text-vita-600 font-bold mx-1 hover:underline"
                                    >
                                        پیامک / گوگل
                                    </button>
                                    بروید.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
