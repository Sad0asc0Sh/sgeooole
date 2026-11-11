"use client";
import { Check } from "lucide-react";
import { ProductColor } from "@/services/productService";

type ColorSelectorProps = {
    colors: ProductColor[];
    selectedColor: ProductColor | null;
    onColorChange: (color: ProductColor) => void;
};

export default function ColorSelector({ colors, selectedColor, onColorChange }: ColorSelectorProps) {
    if (!colors || colors.length === 0 || !selectedColor) {
        return null;
    }

    return (
        <div className="mb-6">
            <span className="text-sm font-bold text-gray-800 block mb-3">
                رنگ: {selectedColor.name}
            </span>
            <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                    const isSelected = selectedColor.id === c.id;
                    return (
                        <button
                            key={c.id}
                            onClick={() => onColorChange(c)}
                            aria-pressed={isSelected}
                            aria-label={c.name}
                            className={`rounded-full p-1 border flex items-center justify-center transition-colors ${isSelected
                                ? "bg-kala-50 border-transparent"
                                : "bg-white border-gray-300 hover:border-gray-400"
                                }`}
                        >
                            <span
                                className="w-7 h-7 rounded-full border border-gray-100 flex items-center justify-center"
                                style={{ backgroundColor: c.hex }}
                            >
                                {isSelected && <Check size={18} className="text-white drop-shadow" aria-hidden />}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
