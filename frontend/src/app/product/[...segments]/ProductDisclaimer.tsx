import { Info } from "lucide-react";

/**
 * Unboxing-video notice (mobile140 PDP style). Static, same copy as the
 * reference page, styled into the sgeooole warm palette.
 */
export default function ProductDisclaimer() {
    return (
        <div className="rounded-lg bg-amber-50/70 border border-amber-100 my-4">
            <div className="flex gap-2.5 p-3.5">
                <Info size={18} className="shrink-0 mt-0.5 text-gray-500" aria-hidden />
                <p className="text-xs leading-6 text-gray-500">
                    هنگام دریافت سفارش، از لحظهٔ باز کردن بسته‌بندی تا نمایش کامل کالا، به‌صورت پیوسته فیلم‌برداری
                    کنید. این ویدئو تنها مدرک قابل استناد برای بررسی هرگونه ایراد، آسیب یا مغایرت احتمالی است و ارائهٔ
                    آن الزامی می‌باشد.
                </p>
            </div>
        </div>
    );
}
