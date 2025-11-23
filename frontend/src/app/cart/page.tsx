"use client";
import { useState } from "react";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { INITIAL_CART } from "@/lib/mock/cartData";
import CartItem from "@/components/cart/CartItem";
import CartSummary from "@/components/cart/CartSummary";

export default function CartPage() {
    const [cartItems, setCartItems] = useState(INITIAL_CART);

    // Calculations
    const totalPrice = cartItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const shipping = 50000; // Mock shipping
    const finalPrice = totalPrice + shipping;

    const handleIncrease = (id: number) => {
        setCartItems(prev => prev.map(item =>
            item.id === id ? { ...item, qty: item.qty + 1 } : item
        ));
    };

    const handleDecrease = (id: number, qty: number) => {
        if (qty === 1) {
            setCartItems(prev => prev.filter(item => item.id !== id));
        } else {
            setCartItems(prev => prev.map(item =>
                item.id === id ? { ...item, qty: item.qty - 1 } : item
            ));
        }
    };

    if (cartItems.length === 0) return <EmptyCart />;

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <header className="bg-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <h1 className="font-bold text-lg text-welf-900">سبد خرید <span className="text-xs font-normal text-gray-500">({cartItems.length} کالا)</span></h1>
                <Link href="/" className="p-2 bg-gray-100 rounded-full"><ChevronLeft size={20} /></Link>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-40 space-y-4 no-scrollbar">
                {/* Items */}
                {cartItems.map(item => (
                    <CartItem
                        key={item.id}
                        item={item}
                        onIncrease={() => handleIncrease(item.id)}
                        onDecrease={() => handleDecrease(item.id, item.qty)}
                    />
                ))}

                {/* Summary Card */}
                <CartSummary totalPrice={totalPrice} shipping={shipping} finalPrice={finalPrice} />
            </div>

            {/* Sticky Checkout Footer (Fixed ABOVE Bottom Nav) */}
            <div className="fixed bottom-[65px] left-0 w-full bg-white border-t border-gray-200 p-4 z-40 flex items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">

                {/* Total Price Section */}
                <div className="flex flex-col items-start">
                    <span className="text-[10px] text-gray-500">مبلغ قابل پرداخت</span>
                    <div className="flex items-center gap-1">
                        <span className="text-lg font-black text-black">{finalPrice.toLocaleString("fa-IR")}</span>
                        <span className="text-xs text-gray-500">تومان</span>
                    </div>
                </div>

                {/* Checkout Button */}
                <button className="flex-1 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-3 rounded-xl shadow-md shadow-vita-200 active:scale-95 transition-transform">
                    ادامه فرآیند خرید
                </button>
            </div>
        </div>
    );
}

function EmptyCart() {
    return (
        <div className="h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-4 bg-white">
            <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                <ShoppingBag size={48} className="text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">سبد خرید شما خالی است!</h2>
            <p className="text-xs text-gray-400 max-w-xs text-center px-8">می‌توانید برای مشاهده محصولات به صفحه اصلی بازگردید.</p>
            <Link href="/" className="mt-4 bg-welf-900 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-welf-800 transition">
                بازگشت به فروشگاه
            </Link>
        </div>
    );
}
