"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShoppingBag, Loader2 } from "lucide-react";
import Link from "next/link";
import CartItem from "@/components/cart/CartItem";
import CartSummary from "@/components/cart/CartSummary";
import CartExpiryWarning from "@/components/cart/CartExpiryWarning";
import { useCart } from "@/hooks/useCart";

import api from "@/lib/api";
import { useState } from "react";

export default function CartPage() {
    const router = useRouter();
    const { cartItems, loading, updateQuantity, removeFromCart, totalPrice, totalOriginalPrice, isEmpty } = useCart();

    // Coupon State
    const [discount, setDiscount] = useState(0);
    const [couponCode, setCouponCode] = useState("");
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

    // Calculations
    const shipping = 0; // Calculated at checkout
    const finalPrice = Math.max(0, totalPrice + shipping - discount);

    const handleApplyCoupon = async (code: string) => {
        try {
            setCouponLoading(true);
            setCouponError(null);
            setCouponSuccess(null);

            const res = await api.get(`/coupons/validate/${code}?totalPrice=${totalPrice}`);

            if (res.data.success) {
                setDiscount(res.data.data.discount);
                setCouponCode(code);
                setCouponSuccess("کد تخفیف با موفقیت اعمال شد");
            }
        } catch (err: any) {
            setCouponError(err.response?.data?.message || "کد تخفیف نامعتبر است");
            setDiscount(0);
            setCouponCode("");
        } finally {
            setCouponLoading(false);
        }
    };

    const handleIncrease = async (id: string, variantOptions?: Array<{ name: string; value: string }>) => {
        const item = cartItems.find(item => {
            if (item.id !== id) return false;

            // Match by variantOptions
            const itemVariants = item.variantOptions || [];
            const targetVariants = variantOptions || [];

            if (itemVariants.length !== targetVariants.length) return false;

            return itemVariants.every((v1) =>
                targetVariants.some((v2) => v1.name === v2.name && v1.value === v2.value)
            );
        });

        if (item) {
            await updateQuantity(id, item.qty + 1, variantOptions);
        }
    };

    const handleDecrease = async (id: string, qty: number, variantOptions?: Array<{ name: string; value: string }>) => {
        if (qty === 1) {
            await removeFromCart(id, variantOptions);
        } else {
            await updateQuantity(id, qty - 1, variantOptions);
        }
    };

    /**
     * Instant Auth Check Before Navigation
     * Prevents flash of unauthenticated content on checkout page
     */
    const handleCheckoutProcess = () => {
        // Check for token in localStorage
        const token = localStorage.getItem("token");

        if (!token) {
            // Not logged in - redirect directly to login
            console.log("[CART] No token found, redirecting to login");
            router.push("/login");
        } else {
            // Logged in - proceed to checkout
            console.log("[CART] Token found, proceeding to checkout");
            // Pass coupon code via query param if needed, or store in context/localStorage
            // For now, we just navigate. Ideally, we should persist the coupon.
            if (couponCode) {
                localStorage.setItem("appliedCoupon", couponCode);
            }
            router.push("/checkout");
        }
    };

    // Show loading spinner while cart data is being fetched
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-vita-500" size={48} />
                    <span className="text-sm text-gray-500">در حال بارگذاری سبد خرید...</span>
                </div>
            </div>
        );
    }

    // Only show empty cart after loading is complete
    if (!loading && isEmpty) return <EmptyCart />;

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <header className="bg-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <h1 className="font-bold text-lg text-welf-900">سبد خرید <span className="text-xs font-normal text-gray-500">({cartItems.length} کالا)</span></h1>
                <Link href="/" className="p-2 bg-gray-100 rounded-full"><ChevronLeft size={20} /></Link>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-40 space-y-4 no-scrollbar">
                {/* Cart Expiry Warning for Guest Users */}
                <CartExpiryWarning />

                {/* Items */}
                {cartItems.map((item, index) => {
                    // Create unique key using product ID (string), color, and variants
                    // Note: Items are already deduplicated in useCart hook
                    const productId = String(item.id ?? index);
                    const variantKey = item.variantOptions
                        ?.map((v) => `${v.name}:${v.value}`)
                        .sort() // Sort to ensure consistent key generation
                        .join("|") || "no-variant";
                    const itemKey = `${productId}-${item.color || "no-color"}-${variantKey}`;

                    return (
                        <CartItem
                            key={itemKey}
                            item={item}
                            onIncrease={() => handleIncrease(item.id, item.variantOptions)}
                            onDecrease={() => handleDecrease(item.id, item.qty, item.variantOptions)}
                        />
                    );
                })}

                {/* Summary Card */}
                <CartSummary
                    totalPrice={totalPrice}
                    totalOriginalPrice={totalOriginalPrice}
                    shipping={shipping}
                    finalPrice={finalPrice}
                    discount={discount}
                    onApplyCoupon={handleApplyCoupon}
                    couponLoading={couponLoading}
                    couponError={couponError}
                    couponSuccess={couponSuccess}
                />
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
                <button
                    onClick={handleCheckoutProcess}
                    className="flex-1 bg-gradient-to-r from-vita-500 to-vita-600 text-white font-bold py-3 rounded-xl shadow-md shadow-vita-200 active:scale-95 transition-transform"
                >
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
