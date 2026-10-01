"use client";
import { useState, useEffect } from "react";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { Product, ProductColor } from "@/services/productService";
import { useCart } from "@/hooks/useCart";

type ProductActionsProps = {
    product: Product;
    selectedColor: ProductColor | null;
    isDesktop?: boolean;
};

export default function ProductActions({ product, selectedColor, isDesktop = false }: ProductActionsProps) {
    const [addingToCart, setAddingToCart] = useState(false);
    const { addToCart, updateQuantity, removeFromCart, cartItems } = useCart();
    const [now, setNow] = useState(() => Date.now());

    // Check if flash deal countdown is still active
    const isFlashDealActive = Boolean(
        product.isFlashDeal &&
        (!product.flashDealEndTime || new Date(product.flashDealEndTime).getTime() > now)
    );

    const isSpecialOfferActive = Boolean(
        product.isSpecialOffer &&
        (!product.specialOfferEndTime || new Date(product.specialOfferEndTime).getTime() > now)
    );

    // Any active countdown (flash deal or special offer)
    // A campaign label counts only while its promotion is live; a label alone (stale snapshot
    // with an ended countdown) must not keep the discount badge / struck-through price alive.
    const hasActivePromotion =
        isFlashDealActive ||
        isSpecialOfferActive ||
        (Boolean(product.campaignLabel) && resolveProductPromotion(product, now).kind === "campaign");

    // Price reversion: when flash deal or special offer with an end date expires, revert to original price
    const flashExpired = Boolean(product.isFlashDeal && product.flashDealEndTime && new Date(product.flashDealEndTime).getTime() <= now);
    const specialExpired = Boolean(product.isSpecialOffer && product.specialOfferEndTime && new Date(product.specialOfferEndTime).getTime() <= now);

    const displayPrice =
        (flashExpired || specialExpired) && product.oldPrice
            ? product.oldPrice
            : product.price;

    // Calculate quantity for the SPECIFIC selected variant
    const [quantity, setQuantity] = useState(0);

    useEffect(() => {
        const matchedItem = cartItems.find((item) => {
            if (item.id !== product.id) return false;

            if (selectedColor) {
                const variantOptions = item.variantOptions || [];
                return variantOptions.some((v) => v.name === "رنگ" && v.value === selectedColor.name);
            }
            return true;
        });
        setQuantity(matchedItem?.qty || 0);
    }, [cartItems, product.id, selectedColor]);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const handleAddToCart = async () => {
        try {
            setAddingToCart(true);
            const variantOptions = selectedColor ? [{ name: "رنگ", value: selectedColor.name }] : [];
            await addToCart(product, 1, variantOptions);
        } catch (err: any) {
            console.error("Error adding to cart:", err);
            alert(`Error: ${err.message || "Unknown error"}`);
        } finally {
            setAddingToCart(false);
        }
    };

    const handleIncrement = async () => {
        try {
            const variantOptions = selectedColor ? [{ name: "رنگ", value: selectedColor.name }] : [];
            await updateQuantity(product.id, quantity + 1, variantOptions);
        } catch (err) {
            console.error("Error incrementing:", err);
        }
    };

    const handleDecrement = async () => {
        try {
            const variantOptions = selectedColor ? [{ name: "رنگ", value: selectedColor.name }] : [];
            if (quantity > 1) {
                await updateQuantity(product.id, quantity - 1, variantOptions);
            } else {
                await removeFromCart(product.id, variantOptions);
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
                                <div className={`text-white text-xs font-bold px-3 py-1 rounded-full ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                    product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                        product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' || product.campaignTheme === 'green-orange' ? 'bg-gradient-to-r from-lime-400 to-green-500' :
                                            product.campaignLabel ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                                                isFlashDealActive ? 'bg-amber-500' : 'bg-[#ef394e]'
                                    }`}>
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
                                    className="w-11 h-11 flex items-center justify-center text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
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
                                disabled={product.countInStock === 0 || addingToCart}
                                className={`h-full font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all text-base ${product.countInStock === 0
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-gradient-to-l from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-amber-200"
                                    }`}
                            >
                                {product.countInStock === 0 ? (
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

    // Mobile fixed bottom bar layout (default)
    return (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 pb-[calc(1rem_+_var(--safe-area-bottom))] z-[100] flex items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col">
                {/* Show old price and discount badge only when there's an active promotion */}
                {product.oldPrice && hasActivePromotion && (
                    <div className="flex items-center gap-2 mb-1">
                        {product.discount > 0 && (
                            <div className={`text-white text-[11px] font-bold px-2 py-0.5 rounded-full ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                    product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' || product.campaignTheme === 'green-orange' ? 'bg-gradient-to-r from-lime-400 to-green-500' :
                                        product.campaignLabel ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                                            isFlashDealActive ? 'bg-amber-500' : 'bg-[#ef394e]'
                                }`}>
                                {product.discount.toLocaleString("fa-IR")}٪
                            </div>
                        )}
                        <span className="text-[12px] text-gray-400 line-through decoration-gray-300 decoration-1">
                            {product.oldPrice.toLocaleString("fa-IR")}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <span className="text-xl font-black text-black">
                        {displayPrice.toLocaleString("fa-IR")}
                    </span>
                    <span className="text-xs text-gray-500">تومان</span>
                </div>
            </div>
            <div className="flex-1 h-[50px] relative flex justify-end">
                <AnimatePresence mode="wait" initial={false}>
                    {quantity > 0 ? (
                        <motion.div
                            key="quantity-controls"
                            initial={{ opacity: 0, width: "100%" }}
                            animate={{ opacity: 1, width: "160px" }}
                            exit={{ opacity: 0, width: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="h-full flex items-center justify-between bg-white border border-gray-200 rounded-lg shadow-sm px-1"
                        >
                            <motion.button
                                whileTap={{ scale: 0.8 }}
                                onClick={handleDecrement}
                                className="w-10 h-10 flex items-center justify-center text-amber-700 rounded-full hover:bg-amber-50 transition-colors"
                            >
                                {quantity === 1 ? <Trash2 size={20} /> : <Minus size={20} />}
                            </motion.button>

                            <motion.span
                                key={quantity}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-lg font-bold text-amber-700 w-8 text-center"
                            >
                                {quantity.toLocaleString("fa-IR")}
                            </motion.span>

                            <motion.button
                                whileTap={{ scale: 0.8 }}
                                onClick={handleIncrement}
                                className="w-10 h-10 flex items-center justify-center text-amber-700 rounded-full hover:bg-amber-50 transition-colors"
                            >
                                <Plus size={20} />
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.button
                            key="add-to-cart"
                            initial={{ opacity: 0, width: "160px" }}
                            animate={{ opacity: 1, width: "100%" }}
                            exit={{ opacity: 0, width: "160px" }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAddToCart}
                            disabled={product.countInStock === 0 || addingToCart}
                            className={`h-full font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all ${product.countInStock === 0
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-100"
                                }`}
                        >
                            {product.countInStock === 0 ? (
                                "ناموجود"
                            ) : addingToCart ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
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
