"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, X } from "lucide-react";
import { getLocalStorageExpiryInfo } from "@/lib/localStorageHelper";
import { useCart } from "@/hooks/useCart";

interface CartExpiryInfo {
    expiresAt: Date | null;
    daysRemaining: number | null;
    isExpired: boolean;
}

/**
 * CartExpiryWarning Component
 * 
 * نمایش هشدار انقضای سبد خرید برای کاربران مهمان
 * - اگر کمتر از 3 روز باقی‌مانده باشد هشدار نارنجی
 * - اگر کمتر از 1 روز باقی‌مانده باشد هشدار قرمز
 */
export default function CartExpiryWarning() {
    const { cartConfig, isAuthenticated, isEmpty } = useCart();
    const [expiryInfo, setExpiryInfo] = useState<CartExpiryInfo | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // فقط برای کاربران مهمان و سبدهای غیرخالی نمایش بده
        if (isAuthenticated || isEmpty) {
            setExpiryInfo(null);
            return;
        }

        // اگر انقضا بی‌نهایت است، نیازی به هشدار نیست
        if (cartConfig.cartExpirationDays === 0) {
            setExpiryInfo(null);
            return;
        }

        // اگر ماندگاری غیرفعال است، نشان بده
        if (!cartConfig.persistCart) {
            setExpiryInfo({
                expiresAt: null,
                daysRemaining: 0,
                isExpired: true,
            });
            return;
        }

        // دریافت اطلاعات انقضا از localStorage
        const info = getLocalStorageExpiryInfo("welfvita_cart");
        if (info) {
            setExpiryInfo(info);
        }
    }, [isAuthenticated, isEmpty, cartConfig]);

    // بررسی هر 1 دقیقه
    useEffect(() => {
        if (isAuthenticated || isEmpty) return;

        const interval = setInterval(() => {
            const info = getLocalStorageExpiryInfo("welfvita_cart");
            if (info) {
                setExpiryInfo(info);
            }
        }, 60000); // هر 1 دقیقه

        return () => clearInterval(interval);
    }, [isAuthenticated, isEmpty]);

    // شرایط عدم نمایش
    if (!expiryInfo || dismissed || isAuthenticated || isEmpty) return null;

    // اگر ماندگاری غیرفعال است
    if (!cartConfig.persistCart) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 animate-fade-in">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-full">
                        <AlertTriangle size={18} className="text-red-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-red-800 text-sm">ماندگاری سبد خرید غیرفعال است</h4>
                        <p className="text-xs text-red-600 mt-1">
                            سبد خرید شما پس از بستن مرورگر پاک خواهد شد. برای نگهداری سبد، وارد حساب کاربری شوید.
                        </p>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 hover:bg-red-100 rounded-full transition-colors"
                    >
                        <X size={16} className="text-red-400" />
                    </button>
                </div>
            </div>
        );
    }

    // اگر انقضا بی‌نهایت است، هشداری نمایش نده
    if (expiryInfo.daysRemaining === null) return null;

    // تعیین سطح هشدار
    const isUrgent = expiryInfo.daysRemaining <= 1; // کمتر از 1 روز
    const isWarning = expiryInfo.daysRemaining <= 3 && expiryInfo.daysRemaining > 1; // 1-3 روز

    // اگر بیش از 3 روز مانده، نیازی به هشدار نیست
    if (!isUrgent && !isWarning) return null;

    const bgColor = isUrgent ? "bg-red-50" : "bg-amber-50";
    const borderColor = isUrgent ? "border-red-200" : "border-amber-200";
    const iconBg = isUrgent ? "bg-red-100" : "bg-amber-100";
    const iconColor = isUrgent ? "text-red-600" : "text-amber-600";
    const titleColor = isUrgent ? "text-red-800" : "text-amber-800";
    const textColor = isUrgent ? "text-red-600" : "text-amber-600";
    const buttonHover = isUrgent ? "hover:bg-red-100" : "hover:bg-amber-100";
    const buttonIconColor = isUrgent ? "text-red-400" : "text-amber-400";

    // متن هشدار
    const getWarningText = () => {
        if (expiryInfo.daysRemaining === 0) {
            return "سبد خرید شما امروز منقضی می‌شود! برای نگهداری آیتم‌ها، خرید را تکمیل کنید یا وارد حساب شوید.";
        }
        if (expiryInfo.daysRemaining === 1) {
            return "فقط ۱ روز تا انقضای سبد خرید باقی‌مانده! برای نگهداری آیتم‌ها، وارد حساب کاربری شوید.";
        }
        return `${expiryInfo.daysRemaining} روز تا انقضای سبد خرید باقی‌مانده. برای نگهداری دائمی، وارد حساب کاربری شوید.`;
    };

    // عنوان هشدار
    const getWarningTitle = () => {
        if (expiryInfo.daysRemaining === 0) {
            return "سبد خرید امروز منقضی می‌شود!";
        }
        return "سبد خرید به زودی منقضی می‌شود";
    };

    return (
        <div className={`${bgColor} border ${borderColor} rounded-xl p-4 mb-4 animate-fade-in`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-full flex-shrink-0`}>
                    <Clock size={18} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className={`font-bold ${titleColor} text-sm`}>
                        {getWarningTitle()}
                    </h4>
                    <p className={`text-xs ${textColor} mt-1 leading-relaxed`}>
                        {getWarningText()}
                    </p>
                    {expiryInfo.expiresAt && (
                        <p className={`text-[10px] ${textColor} mt-2 opacity-75`}>
                            تاریخ انقضا: {new Date(expiryInfo.expiresAt).toLocaleDateString('fa-IR')}
                            {" ساعت "}
                            {new Date(expiryInfo.expiresAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setDismissed(true)}
                    className={`p-1 ${buttonHover} rounded-full transition-colors flex-shrink-0`}
                >
                    <X size={16} className={buttonIconColor} />
                </button>
            </div>
        </div>
    );
}
