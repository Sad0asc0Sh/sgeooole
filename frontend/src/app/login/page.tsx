"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone, Timer, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { authService } from "@/services/authService";
import { cartService } from "@/services/cartService";

export default function LoginPage() {
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [timer, setTimer] = useState(120);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Countdown Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (step === "otp" && timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const handlePhoneSubmit = async () => {
        if (phone.length < 10) return;

        try {
            setLoading(true);
            setError(null);

            // Call authService to send OTP
            const response = await authService.sendOtp(phone);

            if (response.success) {
                setStep("otp");
                setTimer(response.expiresIn || 120); // Use server-provided expiry or default 120s
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

    // Helper function to sync local cart with server
    const syncLocalCart = async () => {
        try {
            const localCartKey = "welfvita_cart";
            const localCartData = localStorage.getItem(localCartKey);

            if (!localCartData) {
                console.log("[CART SYNC] No local cart found, skipping sync");
                return;
            }

            const localCart = JSON.parse(localCartData);

            // Transform local cart format to backend format
            // Local format: { id, name, price, qty, ... }
            // Backend format: { product, quantity, variantOptions? }
            const itemsToSync = localCart.map((item: any) => ({
                product: item.id || item.product,
                quantity: item.qty || item.quantity || 1,
                variantOptions: item.variantOptions,
            }));

            if (itemsToSync.length > 0) {
                console.log(`[CART SYNC] Syncing ${itemsToSync.length} items with server`);
                await cartService.syncCart(itemsToSync);

                // Clear local cart after successful sync
                localStorage.removeItem(localCartKey);
                console.log("[CART SYNC] Cart synced and local storage cleared");
            }
        } catch (error) {
            console.error("[CART SYNC] Error syncing cart:", error);
            // Don't throw error - cart sync failure shouldn't block login
        }
    };

    const handleOtpSubmit = async () => {
        if (otp.length < 4) return;

        try {
            setLoading(true);
            setError(null);

            // Call authService to verify OTP
            const response = await authService.verifyOtp(phone, otp);

            if (response.success && response.data?.token) {
                // Authentication successful

                // Sync local cart with server (non-blocking)
                await syncLocalCart();

                // Redirect to profile
                router.push("/profile");
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
                {/* Error Message Display */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center animate-in fade-in slide-in-from-top duration-300">
                        {error}
                    </div>
                )}

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
                            disabled={phone.length < 10 || loading}
                            className="w-full mt-6 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-vita-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                        >
                            {loading ? "در حال ارسال..." : "دریافت کد تایید"}
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
                            disabled={otp.length < 4 || loading}
                            className="w-full mt-6 bg-welf-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {loading ? "در حال بررسی..." : "ورود به حساب"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
