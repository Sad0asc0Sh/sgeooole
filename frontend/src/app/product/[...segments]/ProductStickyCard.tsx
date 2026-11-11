"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Store } from "lucide-react";
import ResilientImage from "@/components/ui/ResilientImage";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { getServerNow } from "@/lib/serverClock";
import { promotionPillClass } from "@/lib/campaignTheme";
import { useCart } from "@/hooks/useCart";
import type { Product, ProductVariantOption } from "@/types/product";

type ProductStickyCardProps = {
    product: Product;
    variantOptions: ProductVariantOption[];
};

/**
 * Desktop sticky mini buy card (mobile140 PDP right-rail equivalent).
 * It stays hidden until the user scrolls past the hero so it never
 * duplicates the main price box, then docks to the bottom-start with
 * a short slide-up. Wrap the main price box in an element with
 * id="product-buy-box" — this card appears once that element has
 * been scrolled past.
 *
 * Desktop only (lg+); mobile keeps its fixed bottom bar.
 */
export default function ProductStickyCard({ product, variantOptions }: ProductStickyCardProps) {
    const [visible, setVisible] = useState(false);
    const [addingToCart, setAddingToCart] = useState(false);
    const { addToCart } = useCart();
    const [now] = useState(() => getServerNow());

    useEffect(() => {
        const onScroll = () => {
            const buyBox =
                document.getElementById("product-buy-box-desktop") ||
                document.getElementById("product-buy-box");
            if (!buyBox) return;
            const rect = buyBox.getBoundingClientRect();
            setVisible(rect.bottom < 0);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, []);

    if (!visible) return null;

    const promotion = resolveProductPromotion(product, now);
    const hasActivePromotion = promotion.kind !== "none";
    const discountPillClass = promotionPillClass(promotion.kind, product.campaignTheme);
    const displayPrice = promotion.displayPrice;
    const inStock = product.countInStock > 0;

    const handleAddToCart = async () => {
        try {
            setAddingToCart(true);
            await addToCart(product, 1, variantOptions);
        } catch (err: unknown) {
            console.error("Error adding to cart:", err);
        } finally {
            setAddingToCart(false);
        }
    };

    return (
        <aside
            aria-label="خلاصه خرید"
            className="hidden lg:block fixed bottom-6 left-6 z-40 w-[320px] rounded-2xl border border-gray-200 bg-white shadow-xl p-4 motion-safe:animate-[sticky-card-in_.25s_ease-out]"
        >
            <div className="flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white">
                    <ResilientImage
                        src={product.image}
                        alt={product.title}
                        fill
                        className="object-contain"
                        sizes="80px"
                        loading="lazy"
                        quality={60}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs leading-6 text-gray-800 line-clamp-2">{product.title}</p>
                    {product.guarantee && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600">
                            <ShieldCheck size={14} className="shrink-0 text-gray-500" aria-hidden />
                            <span className="truncate">{product.guarantee}</span>
                        </p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600">
                        <Store size={14} className={`shrink-0 ${inStock ? "text-kala-500" : "text-red-500"}`} aria-hidden />
                        <span>{inStock ? "موجود در انبار" : "ناموجود"}</span>
                    </p>
                </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                            {product.oldPrice && hasActivePromotion && product.discount > 0 && (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${discountPillClass}`}>
                                    {product.discount.toLocaleString("fa-IR")}٪
                                </span>
                            )}
                            {product.oldPrice && hasActivePromotion && (
                                <span className="text-xs text-gray-400 line-through">
                                    {product.oldPrice.toLocaleString("fa-IR")}
                                </span>
                            )}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                            <span className="text-lg font-black text-gray-900">
                                {displayPrice.toLocaleString("fa-IR")}
                            </span>
                            <span className="text-[11px] font-bold text-gray-500">تومان</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!inStock || addingToCart}
                        className={`h-11 rounded-xl px-5 text-sm font-bold transition-colors ${
                            !inStock
                                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                                : "bg-kala-500 text-white hover:bg-kala-600"
                        }`}
                    >
                        {addingToCart ? <Loader2 size={18} className="animate-spin" /> : inStock ? "افزودن به سبد" : "ناموجود"}
                    </button>
                </div>
            </div>
            <style>{`@keyframes sticky-card-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </aside>
    );
}
