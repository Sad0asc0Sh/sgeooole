"use client";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { getServerNow } from "@/lib/serverClock";

interface CartItemProps {
    item: {
        id: string;
        name: string;
        price: number;
        originalPrice?: number;
        image: string;
        color?: string;
        qty: number;
        discount?: number;
        campaignLabel?: string;
        /** موجودی لحظه‌ای همین قلم (از بک‌اند)؛ وقتی معلوم باشد دکمه‌ی + روی سقف غیرفعال است. */
        countInStock?: number;
        isFlashDeal?: boolean;
        flashDealEndTime?: string;
        isSpecialOffer?: boolean;
        specialOfferEndTime?: string;
        variantOptions?: Array<{ name: string; value: string }>;
    };
    onIncrease: () => void;
    onDecrease: () => void;
}

export default function CartItem({ item, onIncrease, onDecrease }: CartItemProps) {
    const now = getServerNow();
    // Single source: the shared resolver. Never derive % from the price gap —
    // a stale compareAtPrice would fabricate 80%+ badges.
    const promotion = resolveProductPromotion(
        {
            price: item.price,
            oldPrice: item.originalPrice,
            discount: item.discount,
            isFlashDeal: item.isFlashDeal,
            flashDealEndTime: item.flashDealEndTime,
            isSpecialOffer: item.isSpecialOffer,
            specialOfferEndTime: item.specialOfferEndTime,
            campaignLabel: item.campaignLabel,
        },
        now,
    );
    const promotionKind = promotion.kind;
    const discountValue = promotion.effectiveDiscount;
    const basePrice = item.originalPrice ?? item.price;
    const hasDiscount = promotion.effectiveDiscount > 0 && basePrice > item.price;
    const isFlashActive = promotion.isFlashDealActive;
    const isSpecialActive = promotion.isSpecialOfferActive;
    // A persisted (localStorage) cart item can carry a label whose promotion has ended.
    const effectiveLabel =
        promotionKind === "none"
            ? undefined
            : item.campaignLabel ||
              (isFlashActive ? "پیشنهاد لحظه‌ای" : isSpecialActive ? "پیشنهاد شگفت‌انگیز" : undefined);
    const cleanLabel = effectiveLabel?.replace(/\?/g, "").trim();
    const campaignBadge = cleanLabel
        ? `${cleanLabel}${discountValue ? ` • ${discountValue}%` : ""}`
        : discountValue
            ? `${discountValue}%`
            : null;

    const isFlashBadge = isFlashActive || Boolean(cleanLabel && (cleanLabel.includes("پیشنهاد لحظه‌ای") || cleanLabel.includes("زمان‌دار")));
    const badgeClass = isFlashBadge
        ? "legacy-grad-timed bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-white shadow-sm"
        : "bg-red-500 text-white";

    return (
        <div className="bg-white p-3 rounded-2xl shadow-sm flex gap-3">
            {/* Image */}
            <div className="w-24 h-24 relative bg-gray-100 rounded-xl overflow-hidden shrink-0">
                {/* Placeholder if image fails or is mock path */}
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ShoppingBag />
                </div>
                {/* <Image src={item.image} fill className="object-cover" alt={item.name} /> */}
            </div>

            {/* Details */}
            <div className="flex-1 flex flex-col justify-between py-1">
                <h3 className="text-xs font-bold text-gray-800 leading-5 line-clamp-2">{item.name}</h3>

                {/* Color/Variant — مقادیر واقعی انتخاب‌شده؛ fallback قدیمی فقط وقتی variantOptions نیست */}
                {item.variantOptions && item.variantOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {item.variantOptions.map((o) => (
                            <span key={o.name} className="text-[11px] text-gray-500">{o.name}: {o.value}</span>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-1 mt-1">
                        <span
                            className="w-3 h-3 rounded-full border border-gray-200"
                            style={{ backgroundColor: item.color || "#e5e7eb" }}
                        />
                        <span className="text-[10px] text-gray-500">رنگ / گزینه‌های انتخابی</span>
                    </div>
                )}

                {/* Price & Actions Row */}
                <div className="flex items-end justify-between mt-2">
                    <div className="flex flex-col">
                        {hasDiscount ? (
                            <>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {campaignBadge && (
                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${badgeClass}`}>
                                            {campaignBadge}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-400 line-through decoration-gray-400">
                                        {basePrice.toLocaleString("fa-IR")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-black text-gray-900">
                                        {item.price.toLocaleString("fa-IR")}
                                    </span>
                                    <span className="text-[9px] text-gray-400">تومان</span>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-black text-gray-900">{item.price.toLocaleString("fa-IR")}</span>
                                <span className="text-[9px] text-gray-400">تومان</span>
                            </div>
                        )}
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-100 h-8">
                        <button
                            onClick={onIncrease}
                            disabled={typeof item.countInStock === "number" && item.qty >= item.countInStock}
                            title={
                                typeof item.countInStock === "number" && item.qty >= item.countInStock
                                    ? "به سقف موجودی رسیده‌اید"
                                    : undefined
                            }
                            className="w-8 h-full flex items-center justify-center text-kala-600 hover:bg-kala-100 rounded-r-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-gray-700">{item.qty}</span>
                        <button
                            onClick={onDecrease}
                            className="w-8 h-full flex items-center justify-center text-red-500 hover:bg-red-50 rounded-l-lg transition"
                        >
                            {item.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
