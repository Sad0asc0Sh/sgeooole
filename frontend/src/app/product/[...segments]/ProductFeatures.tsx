"use client";

import type { ProductSpec } from "@/services/productService";

type ProductFeaturesProps = {
    specs: ProductSpec[] | undefined;
};

/**
 * Preview grid of the first six specs (mobile140 PDP style).
 * The «مشاهده همه ویژگی‌ها» button scrolls to the specs tab and activates it.
 */
export default function ProductFeatures({ specs }: ProductFeaturesProps) {
    if (!specs || specs.length === 0) {
        return null;
    }

    const preview = specs.slice(0, 6);

    const handleShowAll = () => {
        document.getElementById("product-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.dispatchEvent(new CustomEvent("product:open-specs"));
    };

    return (
        <section aria-label="ویژگی‌های محصول" className="my-6">
            <h2 className="text-base font-bold text-gray-900 leading-7 mb-3">ویژگی‌ها</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {preview.map((spec, i) => (
                    <li key={i} className="flex flex-col items-start justify-start bg-gray-100 p-2.5 rounded-md min-w-0">
                        <span className="text-gray-500 text-xs leading-6 break-words">{spec.label}</span>
                        <span className="text-xs font-bold leading-6 text-gray-700 break-words line-clamp-2">{spec.value}</span>
                    </li>
                ))}
            </ul>
            <div className="flex justify-center items-center gap-4 mt-4">
                <div className="w-full h-px bg-gray-200" />
                <button
                    type="button"
                    onClick={handleShowAll}
                    className="shrink-0 text-xs font-bold border border-gray-300 text-gray-800 rounded-lg px-4 py-2 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                >
                    مشاهده همه ویژگی‌ها
                </button>
                <div className="w-full h-px bg-gray-200" />
            </div>
        </section>
    );
}
