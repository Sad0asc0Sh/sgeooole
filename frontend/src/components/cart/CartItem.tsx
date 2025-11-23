"use client";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import Image from "next/image";

interface CartItemProps {
    item: {
        id: number;
        name: string;
        price: number;
        image: string;
        color: string;
        qty: number;
    };
    onIncrease: () => void;
    onDecrease: () => void;
}

export default function CartItem({ item, onIncrease, onDecrease }: CartItemProps) {
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

                {/* Color/Variant */}
                <div className="flex items-center gap-1 mt-1">
                    <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-gray-500">رنگ انتخابی</span>
                </div>

                {/* Price & Actions Row */}
                <div className="flex items-end justify-between mt-2">
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900">{item.price.toLocaleString("fa-IR")}</span>
                        <span className="text-[9px] text-gray-400">تومان</span>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-100 h-8">
                        <button
                            onClick={onIncrease}
                            className="w-8 h-full flex items-center justify-center text-vita-600 hover:bg-vita-100 rounded-r-lg transition"
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
