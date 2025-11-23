"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone, Timer, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [timer, setTimer] = useState(120);
    const router = useRouter();

    // Countdown Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (step === "otp" && timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const handlePhoneSubmit = () => {
        if (phone.length >= 10) setStep("otp");
    };

    const handleOtpSubmit = () => {
        // Mock Verification: Any 4 digit code works
        if (otp.length === 4) router.push("/profile");
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
                <p className="text-xs text-gray-400 mt-2">ورود به حساب کاربری</p>
            </div>

            <div className="w-full max-w-xs space-y-6">
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
                            />
                            <Smartphone className="absolute right-4 top-4 text-gray-400" size={20} />
                        </div>
                        <button
                            onClick={handlePhoneSubmit}
                            disabled={phone.length < 10}
                            className="w-full mt-6 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-vita-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                        >
                            دریافت کد تایید
                        </button>
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
                        />

                        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 font-mono">
                            <Timer size={14} />
                            <span>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</span>
                        </div>

                        <button
                            onClick={handleOtpSubmit}
                            disabled={otp.length < 4}
                            className="w-full mt-6 bg-welf-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 disabled:opacity-50 transition-all active:scale-95"
                        >
                            ورود به حساب
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
