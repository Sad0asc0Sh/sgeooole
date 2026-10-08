"use client";
import { useMemo } from "react";
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
 * جایگزین ColorSelector برای محصولات متغیر.
 * - ویژگی «رنگ» (یا displayType=color): دایره‌های رنگی
 * - بقیه‌ی ویژگی‌ها: دکمه‌ی متنی
 * - گزینه‌ی ناموجود: خط‌خورده ولی قابل انتخاب (تا کاربر «ناموجود» را ببیند)
 * - زیر هر گزینه: اختلاف قیمتش نسبت به ارزان‌ترین ترکیب («+۲۰٬۰۰۰»)
 *
 * برای محصول ساده (بدون attributes/variants) هیچ‌چیز رندر نمی‌کند تا
 * ColorSelector قدیمی بدون تداخل کار کند.
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

    const renderDiff = (diff: number | null) => {
        if (diff === null || diff === 0) return null;
        return (
            <span
                className={`text-[11px] font-bold leading-none ${
                    diff > 0 ? "text-orange-600" : "text-green-600"
                }`}
            >
                {diff > 0 ? "+" : "−"}
                {Math.abs(diff).toLocaleString("fa-IR")}
            </span>
        );
    };

    return (
        <div className="space-y-5 mb-6">
            {visibleAttributes.map((attr) => {
                const colorMode = isColorAttribute(attr);
                const selectedValue = selection?.[attr.name] ?? "";

                return (
                    <div key={attr.name}>
                        <span className="text-sm font-bold text-gray-800 block mb-3">
                            {attr.name}: {selectedValue || "—"}
                        </span>

                        {colorMode ? (
                            <div className="flex flex-wrap gap-3">
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
                                        <div key={value} className="flex flex-col items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => onChange(attr.name, value)}
                                                title={value}
                                                aria-label={`${attr.name} ${value}`}
                                                aria-pressed={isSelected}
                                                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all relative ${
                                                    isSelected
                                                        ? "border-kala-500 ring-2 ring-kala-200 scale-110"
                                                        : "border-gray-200 hover:border-gray-400"
                                                } ${out ? "opacity-50" : ""}`}
                                            >
                                                <span
                                                    className={`w-7 h-7 rounded-full border ${isLight ? "border-gray-300" : "border-gray-100"}`}
                                                    style={{ backgroundColor: hex }}
                                                />
                                                {out && (
                                                    <span
                                                        aria-hidden
                                                        className="absolute w-[130%] h-[2px] bg-red-500 rotate-45 rounded-full"
                                                    />
                                                )}
                                            </button>
                                            <span className="text-[11px] text-gray-500 leading-none">{value}</span>
                                            {renderDiff(diff)}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {attr.values.map((value) => {
                                    const isSelected = selectedValue === value;
                                    const out = isOptionOutOfStock(variants, selection, attr.name, value);
                                    const cheapest = cheapestForValue(attr.name, value);
                                    const diff =
                                        cheapest !== null && range ? cheapest - range.min : null;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => onChange(attr.name, value)}
                                            aria-pressed={isSelected}
                                            className={`min-w-[44px] px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all relative ${
                                                isSelected
                                                    ? "border-kala-500 bg-kala-50 text-kala-700"
                                                    : "border-gray-200 text-gray-700 hover:border-gray-400"
                                            } ${out ? "opacity-60" : ""}`}
                                        >
                                            <span className={out ? "line-through decoration-red-500" : ""}>
                                                {value}
                                            </span>
                                            {diff !== null && diff !== 0 && (
                                                <span
                                                    className={`block text-[10px] font-bold ${
                                                        diff > 0 ? "text-orange-600" : "text-green-600"
                                                    }`}
                                                >
                                                    {diff > 0 ? "+" : "−"}
                                                    {Math.abs(diff).toLocaleString("fa-IR")}
                                                </span>
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
                <p className="text-[11px] text-gray-400">
                    قیمت از {range.min.toLocaleString("fa-IR")} تا {range.max.toLocaleString("fa-IR")} تومان
                    متغیر است
                </p>
            )}
        </div>
    );
}
