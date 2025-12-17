"use client";
import { useState } from "react";
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
            <div className="flex gap-3">
                {colors.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => onColorChange(c)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${selectedColor.id === c.id ? "border-vita-500" : "border-gray-200"
                            }`}
                    >
                        <span
                            className="w-6 h-6 rounded-full border border-gray-100"
                            style={{ backgroundColor: c.hex }}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}
