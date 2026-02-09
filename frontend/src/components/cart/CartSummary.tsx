import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface CartSummaryProps {
    totalPrice: number; // Discounted price of items
    totalOriginalPrice?: number; // Original price before product discounts
    shipping: number;
    finalPrice: number;
    discount?: number; // Coupon discount
    onApplyCoupon?: (code: string) => Promise<void>;
    couponLoading?: boolean;
    couponError?: string | null;
    couponSuccess?: string | null;
}

export default function CartSummary({
    totalPrice,
    totalOriginalPrice,
    shipping,
    finalPrice,
    discount = 0,
    onApplyCoupon,
    couponLoading = false,
    couponError,
    couponSuccess
}: CartSummaryProps) {
    const [code, setCode] = useState("");

    const handleApply = () => {
        if (onApplyCoupon && code.trim()) {
            onApplyCoupon(code.trim());
        }
    };

    // Calculate total savings (Product Discounts + Coupon Discount)
    const productSavings = totalOriginalPrice ? totalOriginalPrice - totalPrice : 0;
    const totalSavings = productSavings + discount;

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
            <div className="flex justify-between text-xs text-gray-500">
                <span>قیمت کالاها</span>
                <span>{(totalOriginalPrice || totalPrice).toLocaleString("fa-IR")} تومان</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
                <span>هزینه ارسال</span>
                <span>{shipping === 0 ? "محاسبه در مرحله بعد" : `${shipping.toLocaleString("fa-IR")} تومان`}</span>
            </div>

            {/* Savings Section */}
            {totalSavings > 0 && (
                <div className="flex justify-between text-xs text-red-500 font-bold">
                    <span>سود شما از این خرید</span>
                    <span>{totalSavings.toLocaleString("fa-IR")} تومان</span>
                </div>
            )}

            {discount > 0 && (
                <div className="flex justify-between text-[10px] text-gray-400">
                    <span>کد تخفیف</span>
                    <span>{discount.toLocaleString("fa-IR")} - تومان</span>
                </div>
            )}

            {/* Coupon Input */}
            <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="کد تخفیف"
                        className={`flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-kala-500 transition-all ${couponError ? "border-red-300 bg-red-50" : couponSuccess ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                        disabled={couponLoading || !!couponSuccess}
                    />
                    <button
                        onClick={handleApply}
                        disabled={couponLoading || !code.trim() || !!couponSuccess}
                        className="bg-gray-100 text-kala-600 text-xs font-bold px-4 rounded-lg hover:bg-kala-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[60px] flex items-center justify-center"
                    >
                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "ثبت"}
                    </button>
                </div>

                {couponError && (
                    <div className="flex items-center gap-1 text-[10px] text-red-500">
                        <AlertCircle size={12} />
                        <span>{couponError}</span>
                    </div>
                )}

                {couponSuccess && (
                    <div className="flex items-center gap-1 text-[10px] text-green-600">
                        <CheckCircle2 size={12} />
                        <span>{couponSuccess}</span>
                    </div>
                )}
            </div>

            <div className="border-t border-gray-100 my-2" />
            <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">جمع سبد خرید</span>
                <span className="font-black text-lg text-kala-600">{finalPrice.toLocaleString("fa-IR")} <span className="text-xs font-normal text-gray-500">تومان</span></span>
            </div>
        </div>
    );
}
