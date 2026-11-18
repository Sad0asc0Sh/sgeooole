"use client";
import { useState } from "react";
import type { ProductPromotionState } from "@/lib/promotions/productPromotion";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import type { Product, ProductVariantOption } from "@/types/product";
import { promotionPillClass } from "@/lib/campaignTheme";
import { optionsKey } from "@/lib/variants";
import { isAtStockCap, resolveAvailableStock } from "@/lib/stockLimits";
import { useCart } from "@/hooks/useCart";

type ProductActionsProps = {
    product: Product;
    promotion: ProductPromotionState;
    variantOptions: ProductVariantOption[];
    /** @deprecated فقط برای سازگاری عقب‌رو؛ استفاده نکنید */
    selectedColor?: { name: string } | null;
    isDesktop?: boolean;
};

export default function ProductActions({ product, promotion, variantOptions = [], selectedColor, isDesktop = false }: ProductActionsProps) {
    // سازگاری عقب‌رو: اگر variantOptions داده نشد ولی selectedColor قدیمی آمد.
    const effectiveVariantOptions: ProductVariantOption[] =
        variantOptions.length > 0
            ? variantOptions
            : selectedColor
                ? [{ name: "رنگ", value: selectedColor.name }]
                : [];
    const variantKey = optionsKey(effectiveVariantOptions);
    const [addingToCart, setAddingToCart] = useState(false);
    const { addToCart, updateQuantity, removeFromCart, cartItems } = useCart();
    const quantity = cartItems.find((item) => item.id === product.id && optionsKey(item.variantOptions) === variantKey)?.qty ?? 0;
    const isInStock = product.countInStock > 0;
    const atStockCap = isAtStockCap(quantity, resolveAvailableStock(product));
    const hasActivePromotion = promotion.kind !== "none";
    const { displayPrice, effectiveDiscount } = promotion;
    const discountPillClass = promotionPillClass(promotion.kind, product.campaignTheme);

    const handleAddToCart = async () => {
        if (!isInStock || atStockCap || addingToCart) return;
        try {
            setAddingToCart(true);
            await addToCart(product, 1, effectiveVariantOptions);
        } catch (err: any) {
            console.error("Error adding to cart:", err);
            alert(`Error: ${err.message || "Unknown error"}`);
        } finally {
            setAddingToCart(false);
        }
    };

    const handleIncrement = async () => {
        if (!isInStock || atStockCap) return;
        try {
            await updateQuantity(product.id, quantity + 1, effectiveVariantOptions);
        } catch (err) {
            console.error("Error incrementing:", err);
        }
    };

    const handleDecrement = async () => {
        try {
            if (quantity > 1) {
                await updateQuantity(product.id, quantity - 1, effectiveVariantOptions);
            } else {
                await removeFromCart(product.id, effectiveVariantOptions);
            }
        } catch (err) {
            console.error("Error decrementing:", err);
        }
    };

    // Desktop inline layout
    if (isDesktop) {
        return (
            <div className="flex items-center justify-between gap-6">
                {/* Price Section */}
                <div className="flex flex-col">
                    {/* Show old price and discount badge only when there's an active promotion */}
                    {product.oldPrice && hasActivePromotion && (
                        <div className="flex items-center gap-3 mb-2">
                            {product.discount > 0 && (
                                <div
                                    className={`text-white text-xs font-bold px-3 py-1 rounded-full ${discountPillClass}`}
                                >
                                    {product.discount.toLocaleString("fa-IR")}٪
                                </div>
                            )}
                            <span className="text-sm text-gray-400 line-through decoration-gray-300 decoration-1">
                                {product.oldPrice.toLocaleString("fa-IR")}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-black text-black">
                            {displayPrice.toLocaleString("fa-IR")}
                        </span>
                        <span className="text-sm text-gray-500">تومان</span>
                    </div>
                </div>

                {/* Cart Actions */}
                <div className="flex-1 max-w-[220px] h-[56px] relative flex justify-end">
                    <AnimatePresence mode="wait" initial={false}>
                        {quantity > 0 ? (
                            <motion.div
                                key="quantity-controls"
                                initial={{ opacity: 0, width: "100%" }}
                                animate={{ opacity: 1, width: "180px" }}
                                exit={{ opacity: 0, width: "100%" }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="h-full flex items-center justify-between bg-white border-2 border-amber-200 rounded-xl shadow-sm px-2"
                            >
                                <motion.button
                                    whileTap={{ scale: 0.8 }}
                                    onClick={handleDecrement}
                                    className="w-11 h-11 flex items-center justify-center text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                                >
                                    {quantity === 1 ? <Trash2 size={22} /> : <Minus size={22} />}
                                </motion.button>

                                <motion.span
                                    key={quantity}
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="text-xl font-bold text-amber-700 w-10 text-center"
                                >
                                    {quantity.toLocaleString("fa-IR")}
                                </motion.span>

                                <motion.button
                                    whileTap={{ scale: 0.8 }}
                                    onClick={handleIncrement}
                                    disabled={!isInStock || atStockCap}
                                    title={atStockCap ? "به سقف موجودی رسیده‌اید" : undefined}
                                    className={`w-11 h-11 flex items-center justify-center text-amber-700 rounded-lg transition-colors ${atStockCap ? "opacity-40 cursor-not-allowed" : "hover:bg-amber-50"}`}
                                >
                                    <Plus size={22} />
                                </motion.button>
                            </motion.div>
                        ) : (
                            <motion.button
                                key="add-to-cart"
                                initial={{ opacity: 0, width: "180px" }}
                                animate={{ opacity: 1, width: "100%" }}
                                exit={{ opacity: 0, width: "180px" }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleAddToCart}
                                disabled={!isInStock || atStockCap || addingToCart}
                                className={`h-full font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all text-base ${!isInStock
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-gradient-to-l from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-amber-200"
                                    }`}
                            >
                                {!isInStock ? (
                                    "ناموجود"
                                ) : addingToCart ? (
                                    <>
                                        <Loader2 className="animate-spin" size={22} />
                                        <span>...</span>
                                    </>
                                ) : (
                                    "افزودن به سبد خرید"
                                )}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    const showDiscount = effectiveDiscount > 0 && (product.oldPrice ?? 0) > displayPrice;

    return (
        <div className="product-actions-mobile pb-[calc(0.75rem_+_var(--safe-area-bottom))]" role="region" aria-label="خرید محصول">
            <div className="product-actions-mobile__control">
                {quantity > 0 ? (
                    <div className="product-actions-mobile__quantity" aria-label="تعداد در سبد خرید" role="group">
                        <button type="button" onClick={handleIncrement} disabled={!isInStock || atStockCap} aria-label="افزایش تعداد">
                            <Plus size={20} aria-hidden="true" />
                        </button>
                        <output aria-label="تعداد در سبد خرید">{quantity.toLocaleString("fa-IR")}</output>
                        <button type="button" onClick={handleDecrement} aria-label={quantity === 1 ? "حذف از سبد خرید" : "کاهش تعداد"}>
                            {quantity === 1 ? <Trash2 size={19} aria-hidden="true" /> : <Minus size={20} aria-hidden="true" />}
                        </button>
                    </div>
                ) : (
                    <button type="button" className="product-actions-mobile__buy" onClick={handleAddToCart} disabled={!isInStock || atStockCap || addingToCart} aria-busy={addingToCart}>
                        {addingToCart && <Loader2 className="motion-safe:animate-spin" size={18} aria-hidden="true" />}
                        {!isInStock ? "ناموجود" : addingToCart ? "در حال افزودن" : "افزودن به سبد خرید"}
                    </button>
                )}
            </div>
            <div className="product-actions-mobile__prices">
                {showDiscount && (
                    <div className="product-actions-mobile__discount">
                        <bdi className={`product-actions-mobile__discount-badge ${discountPillClass}`}>
                            {effectiveDiscount.toLocaleString("fa-IR")}٪
                        </bdi>
                        <del><bdi>{product.oldPrice?.toLocaleString("fa-IR")}</bdi></del>
                    </div>
                )}
                <div className="product-actions-mobile__price">
                    <bdi>{displayPrice.toLocaleString("fa-IR")}</bdi>
                    <span>تومان</span>
                </div>
            </div>
        </div>
    );
}
