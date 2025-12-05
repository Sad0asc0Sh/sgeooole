"use client";
import { ArrowRight, Clock, Trash2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useHistoryStore } from "@/store/historyStore";
import { useEffect, useState } from "react";

export default function RecentPage() {
    const { viewedProducts, clearHistory } = useHistoryStore();
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <div className="bg-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Link
                        href="/profile"
                        className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        <ArrowRight size={20} />
                    </Link>
                    <h1 className="font-bold text-lg text-gray-800">بازدیدهای اخیر</h1>
                </div>
                {viewedProducts.length > 0 && (
                    <button
                        onClick={clearHistory}
                        className="text-red-500 text-xs font-bold flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                    >
                        <Trash2 size={14} />
                        پاک کردن همه
                    </button>
                )}
            </div>

            {viewedProducts.length === 0 ? (
                <div className="text-center py-24 px-4">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                        <Clock size={40} className="text-gray-300" />
                    </div>
                    <h3 className="text-gray-800 font-bold mb-2">لیست بازدیدها خالی است</h3>
                    <p className="text-gray-400 text-sm mb-6">شما هنوز از هیچ محصولی بازدید نکرده‌اید</p>
                    <Link href="/products" className="inline-flex items-center gap-2 bg-vita-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-vita-200 hover:bg-vita-700 transition-colors">
                        <ShoppingBag size={18} />
                        مشاهده محصولات
                    </Link>
                </div>
            ) : (
                <div className="p-4 grid grid-cols-2 gap-4">
                    {viewedProducts.map((product) => {
                        const hasSpecialOfferCountdown = Boolean(
                            (product as any).isSpecialOffer &&
                            (product as any).specialOfferEndTime &&
                            new Date((product as any).specialOfferEndTime).getTime() > now
                        );
                        const displayPrice = (!hasSpecialOfferCountdown && (product as any).isSpecialOffer && product.price)
                            ? product.price
                            : (product.finalPrice || product.price);

                        return (
                            <Link href={`/product/${product.slug || product._id}`} key={product._id} className="block group">
                                <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 h-full flex flex-col">
                                    <div className="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden relative">
                                        <img
                                            src={product.image?.startsWith('http') ? product.image : `http://localhost:5000/${product.image}`}
                                            alt={product.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        {product.discount && product.discount > 0 && (!((product as any).isSpecialOffer) || hasSpecialOfferCountdown) && (
                                            <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                                                {product.discount}%
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xs font-bold text-gray-800 line-clamp-2 mb-auto leading-5 min-h-[2.5rem]">
                                        {product.title}
                                    </h3>
                                    <div className="mt-3 flex items-end justify-between">
                                        <div className="flex flex-col">
                                            {product.discount && product.discount > 0 && (!((product as any).isSpecialOffer) || hasSpecialOfferCountdown) && (
                                                <span className="text-[10px] text-gray-400 line-through decoration-red-400">
                                                    {product.price?.toLocaleString('fa-IR')}
                                                </span>
                                            )}
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-sm font-black text-gray-800">
                                                    {displayPrice?.toLocaleString('fa-IR')}
                                                </span>
                                                <span className="text-[10px] text-gray-400">تومان</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
