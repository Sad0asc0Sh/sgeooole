"use client";
import { useState } from "react";
import { ShoppingCart, Search, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useSmartBack } from "@/hooks/useSmartBack";
import AIChatSheet from "@/components/features/ai/AIChatSheet";
import MobileSearchOverlay from "@/components/features/search/MobileSearchOverlay";

export default function ProductHeader() {
    const handleSmartBack = useSmartBack();
    const { itemCount } = useCart();
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    return (
        <>
            <nav className="product-detail__mobile-header" aria-label="ناوبری صفحه محصول">
                <button
                    type="button"
                    onClick={() => handleSmartBack("/")}
                    aria-label="بستن صفحه محصول"
                >
                    <X size={24} aria-hidden="true" />
                </button>
                <div className="product-detail__header-actions">
                    <button type="button" onClick={() => setIsSearchOpen(true)} aria-label="جستجو">
                        <Search size={22} aria-hidden="true" />
                    </button>
                    <Link href="/cart" aria-label={itemCount > 0 ? `سبد خرید، ${itemCount.toLocaleString("fa-IR")} کالا` : "سبد خرید"}>
                        <ShoppingCart size={22} aria-hidden="true" />
                        {itemCount > 0 && (
                            <span className="product-detail__cart-count" aria-hidden="true">
                                {itemCount.toLocaleString("fa-IR")}
                            </span>
                        )}
                    </Link>
                    <button type="button" onClick={() => setIsAiOpen(true)} className="product-detail__header-assistant" aria-label="دستیار خرید">
                        <Sparkles size={20} aria-hidden="true" />
                    </button>
                </div>
            </nav>

            <AIChatSheet open={isAiOpen} onOpenChange={setIsAiOpen} />
            <MobileSearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
