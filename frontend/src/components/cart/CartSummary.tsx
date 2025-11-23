"use client";

interface CartSummaryProps {
    totalPrice: number;
    shipping: number;
    finalPrice: number;
}

export default function CartSummary({ totalPrice, shipping, finalPrice }: CartSummaryProps) {
    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
            <div className="flex justify-between text-xs text-gray-500">
                <span>قیمت کالاها</span>
                <span>{totalPrice.toLocaleString("fa-IR")} تومان</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
                <span>هزینه ارسال</span>
                <span>{shipping.toLocaleString("fa-IR")} تومان</span>
            </div>

            {/* Coupon Input */}
            <div className="flex gap-2 mt-2">
                <input
                    type="text"
                    placeholder="کد تخفیف"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-vita-500"
                />
                <button className="bg-gray-100 text-vita-600 text-xs font-bold px-4 rounded-lg hover:bg-vita-50 transition-colors">
                    ثبت
                </button>
            </div>

            <div className="border-t border-gray-100 my-2" />
            <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">جمع سبد خرید</span>
                <span className="font-black text-lg text-vita-600">{finalPrice.toLocaleString("fa-IR")} <span className="text-xs font-normal text-gray-500">تومان</span></span>
            </div>
        </div>
    );
}
