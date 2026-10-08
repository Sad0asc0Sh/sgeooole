"use client";
import { useMemo } from "react";
import { Check } from "lucide-react";
import type { ProductAttribute, ProductVariant } from "@/types/product";
import {
    colorHexFor,
    isColorAttribute,
    isOptionOutOfStock,
    priceRange,
    type Selection,
} from "@/lib/variants";

type VariantSelectorProps = {
    attributes: ProductAttribute[];
    variants: ProductVariant[];
    selection: Selection;
    selectedVariant: ProductVariant | undefined;
    onChange: (name: string, value: string) => void;
};

/**
 * جایگزین ColorSelector برای محصولات متغیر — نسخه‌ی بازطراحی‌شده.
 *
 * چیدمان:
 * - ویژگی‌های متنی به‌جای flex-wrap بی‌نظم، داخل یک Grid یکسان رندر می‌شوند:
 *   موبایل کوچک ۱ ستونه، از ۴۲۰px به بالا ۲ ستونه.
 *   متن‌های کوتاه در دسکتاپ عریض ۳ ستونه می‌شوند، ولی متن‌های بلند
 *   (مثل «همراه با دو عدد ریموت و تگ») سقف ۲ ستونه دارند تا کارت باریک
 *   نشود و متن به ۲-۳ خط بد نشکند؛ چیپ اختلاف قیمت هم زیر متن می‌نشیند
 *   تا عرض کامل به نوشته برسد (با شکست متعادل خطوط).
 *   عرض و ارتفاع همه‌ی گزینه‌های یک ردیف همیشه برابر است.
 * - هر گزینه یک کارت هم‌اندازه با نشان رادیویی، متن مقدار و چیپ اختلاف قیمت
 *   در لبه‌ی مخالف است؛ گزینه‌ی ناموجود چیپ «ناموجود» می‌گیرد.
 * - ویژگی «رنگ» (یا displayType=color): دایره‌های رنگی هم‌اندازه با نام و
 *   ردیف اختلاف قیمت با ارتفاع ثابت (ستون‌ها هم‌تراز می‌مانند).
 *
 * قراردادهای حفظ‌شده (تست‌ها به آن‌ها وابسته‌اند):
 * - متن سربرگ دقیقاً «نام: مقدار» در یک span واحد
 * - دایره‌ی رنگ: aria-label «نام مقدار»، اولین span = سواچ با backgroundColor،
 *   خط قرمز ناموجودی با کلاس bg-red-500
 * - متن چیپ اختلاف قیمت دقیقاً «+۲۰٬۰۰۰» (یک بار برای هر گزینه)
 * - جمله‌ی راهنمای بازه‌ی قیمت بدون تغییر
 * - محصول ساده (بدون attributes/variants) هیچ‌چیز رندر نمی‌کند
 */
export default function VariantSelector({
    attributes,
    variants,
    selection,
    selectedVariant,
    onChange,
}: VariantSelectorProps) {
    const range = useMemo(() => priceRange(variants), [variants]);

    const visibleAttributes = useMemo(
        () =>
            (Array.isArray(attributes) ? attributes : []).filter(
                (a) =>
                    a &&
                    typeof a.name === "string" &&
                    Array.isArray(a.values) &&
                    a.values.length > 0,
            ),
        [attributes],
    );

    if (visibleAttributes.length === 0 || !Array.isArray(variants) || variants.length === 0) {
        return null;
    }

    // ارزان‌ترین ترکیب سازگار با یک مقدار (با حفظ بقیه‌ی انتخاب‌ها) — مبنای تگ تفاوت قیمت
    const cheapestForValue = (attrName: string, value: string): number | null => {
        const others = Object.entries(selection ?? {}).filter(([k]) => k !== attrName);
        const compatible = variants.filter((v) => {
            const opts = v?.options ?? [];
            if (!opts.some((o) => o.name === attrName && o.value === value)) return false;
            return others.every(([k, val]) =>
                !val || opts.some((o) => o.name === k && o.value === val),
            );
        });
        if (compatible.length === 0) return null;
        return Math.min(...compatible.map((v) => v.price));
    };

    /** چیپ اختلاف قیمت — متن دقیقاً «+۲۰٬۰۰۰» / «−۲۰٬۰۰۰» (قرارداد تست). */
    const renderDiff = (diff: number | null) => {
        if (diff === null || diff === 0) return null;
        return (
            <span
                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    diff > 0 ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                }`}
            >
                {diff > 0 ? "+" : "−"}
                {Math.abs(diff).toLocaleString("fa-IR")}
            </span>
        );
    };

    return (
        <div className="space-y-6 mb-6">
            {visibleAttributes.map((attr) => {
                const colorMode = isColorAttribute(attr);
                const selectedValue = selection?.[attr.name] ?? "";
                // متن بلند در ستون باریک ۳تایی به ۲-۳ خط بد می‌شکند؛ سقف ۲ ستون.
                const longText =
                    !colorMode &&
                    attr.values.some((v) => String(v ?? "").trim().length > 12);
                const textGridClass = longText
                    ? "grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2"
                    : "grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 xl:grid-cols-3";

                return (
                    <div key={attr.name}>
                        {/* سربرگ ویژگی: نوار accent + «نام: مقدار انتخاب‌شده» (متن واحد — قرارداد تست) */}
                        <div className="mb-3 flex items-center gap-2">
                            <span aria-hidden className="h-4 w-1 rounded-full bg-kala-500" />
                            <span className="text-sm font-bold text-gray-800">
                                {attr.name}: {selectedValue || "—"}
                            </span>
                        </div>

                        {colorMode ? (
                            <div className="flex flex-wrap gap-x-3 gap-y-4">
                                {attr.values.map((value) => {
                                    const isSelected = selectedValue === value;
                                    const out = isOptionOutOfStock(variants, selection, attr.name, value);
                                    const hex = colorHexFor(value, attr.swatches);
                                    const isLight = ["#ffffff", "#fef3c7", "#e7d8b7"].includes(
                                        hex.toLowerCase(),
                                    );
                                    const cheapest = cheapestForValue(attr.name, value);
                                    const diff =
                                        cheapest !== null && range ? cheapest - range.min : null;
                                    return (
                                        <div key={value} className="flex w-16 flex-col items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onChange(attr.name, value)}
                                                title={value}
                                                aria-label={`${attr.name} ${value}`}
                                                aria-pressed={isSelected}
                                                className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-kala-500/50 active:scale-95 ${
                                                    isSelected
                                                        ? "scale-110 border-kala-500 ring-2 ring-kala-200"
                                                        : "border-gray-200 hover:scale-105 hover:border-gray-400"
                                                } ${out ? "opacity-60" : ""}`}
                                            >
                                                <span
                                                    className={`h-8 w-8 rounded-full border ${isLight ? "border-gray-300" : "border-gray-100"}`}
                                                    style={{ backgroundColor: hex }}
                                                />
                                                {out && (
                                                    <span
                                                        aria-hidden
                                                        className="absolute w-[130%] h-[2px] bg-red-500 rotate-45 rounded-full"
                                                    />
                                                )}
                                            </button>
                                            <span className="w-full truncate text-center text-[11px] font-medium leading-none text-gray-600">
                                                {value}
                                            </span>
                                            {/* ردیف با ارتفاع ثابت تا ستون‌های رنگ هم‌تراز بمانند */}
                                            <span className="flex h-4 items-center justify-center">
                                                {renderDiff(diff)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div
                                role="group"
                                aria-label={attr.name}
                                className={textGridClass}
                            >
                                {attr.values.map((value) => {
                                    const isSelected = selectedValue === value;
                                    const out = isOptionOutOfStock(variants, selection, attr.name, value);
                                    const cheapest = cheapestForValue(attr.name, value);
                                    const diff =
                                        cheapest !== null && range ? cheapest - range.min : null;
                                    if (longText) {
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => onChange(attr.name, value)}
                                                aria-pressed={isSelected}
                                                className={`group flex min-h-[60px] w-full items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-right outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-kala-500/50 active:scale-[0.98] ${
                                                    isSelected
                                                        ? "border-kala-500 bg-kala-50/70 shadow-sm"
                                                        : "border-gray-200 bg-white hover:border-kala-300 hover:bg-kala-50/40"
                                                } ${out ? "opacity-70" : ""}`}
                                            >
                                                {/* نشان رادیویی انتخاب */}
                                                <span
                                                    aria-hidden
                                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                                        isSelected
                                                            ? "border-kala-500 bg-kala-500 text-white"
                                                            : "border-gray-300 text-transparent group-hover:border-kala-300"
                                                    }`}
                                                >
                                                    <Check size={12} strokeWidth={3.5} />
                                                </span>
                                                <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                                                    <span
                                                        className={`break-words text-balance text-sm font-bold leading-6 ${
                                                            isSelected ? "text-kala-700" : "text-gray-700"
                                                        } ${out ? "line-through decoration-red-400" : ""}`}
                                                    >
                                                        {value}
                                                    </span>
                                                    {out ? (
                                                        <span className="whitespace-nowrap rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-500">
                                                            ناموجود
                                                        </span>
                                                    ) : (
                                                        renderDiff(diff)
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    }
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => onChange(attr.name, value)}
                                            aria-pressed={isSelected}
                                            className={`group flex min-h-[52px] w-full items-center justify-between gap-2 rounded-xl border-2 px-3.5 py-3 text-right outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-kala-500/50 active:scale-[0.98] ${
                                                isSelected
                                                    ? "border-kala-500 bg-kala-50/70 shadow-sm"
                                                    : "border-gray-200 bg-white hover:border-kala-300 hover:bg-kala-50/40"
                                            } ${out ? "opacity-70" : ""}`}
                                        >
                                            <span className="flex min-w-0 items-center gap-2.5">
                                                {/* نشان رادیویی انتخاب */}
                                                <span
                                                    aria-hidden
                                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                                        isSelected
                                                            ? "border-kala-500 bg-kala-500 text-white"
                                                            : "border-gray-300 text-transparent group-hover:border-kala-300"
                                                    }`}
                                                >
                                                    <Check size={12} strokeWidth={3.5} />
                                                </span>
                                                <span
                                                    className={`break-words text-sm font-bold leading-5 ${
                                                        isSelected ? "text-kala-700" : "text-gray-700"
                                                    } ${out ? "line-through decoration-red-400" : ""}`}
                                                >
                                                    {value}
                                                </span>
                                            </span>
                                            {out ? (
                                                <span className="shrink-0 whitespace-nowrap rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-500">
                                                    ناموجود
                                                </span>
                                            ) : (
                                                renderDiff(diff)
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* راهنمای بازه‌ی قیمت ترکیب‌ها */}
            {selectedVariant && range && range.max > range.min && (
                <p className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                    قیمت از {range.min.toLocaleString("fa-IR")} تا {range.max.toLocaleString("fa-IR")} تومان متغیر است
                </p>
            )}
        </div>
    );
}
