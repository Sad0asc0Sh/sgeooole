"use client";
import { useState } from "react";
import { Heart, ShoppingCart, Search, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { Product } from "@/services/productService";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useSmartBack } from "@/hooks/useSmartBack";
import AIChatSheet from "@/components/features/ai/AIChatSheet";
import MobileSearchOverlay from "@/components/features/search/MobileSearchOverlay";

type ProductHeaderProps = {
    product: Product;
};

export default function ProductHeader({ product }: ProductHeaderProps) {
    const handleSmartBack = useSmartBack();
    const { itemCount } = useCart();
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // const { toggleWishlist, isInWishlist } = useWishlist(); // Wishlist removed from header as per request
    // const isFavorite = isInWishlist(product.id);

    return (
        <>
            <div className="fixed top-0 left-0 w-full z-[100] bg-white shadow-sm flex justify-between items-center px-4 py-3 border-b border-gray-100 md:hidden">
                {/* Right: Close Button */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSmartBack("/");
                    }}
                    className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-gray-700 active:bg-gray-100 hover:bg-gray-50 transition-colors touch-manipulation cursor-pointer z-10"
                    title="بستن صفحه محصول"
                    aria-label="بستن صفحه محصول"
                >
                    <X size={26} className="pointer-events-none" />
                </button>

                {/* Left: Actions (AI, Cart, Search) - Visual LTR */}
                <div className="flex items-center gap-2" dir="ltr">
                    {/* AI Icon */}
                    <button
                        onClick={() => setIsAiOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-ekg-50 text-kala-500 hover:bg-kala-50 transition-colors"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>

                    {/* Cart */}
                    <Link href="/cart" className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-kala-600 transition-colors relative">
                        <ShoppingCart size={22} />
                        {itemCount > 0 && (
                            <span className="absolute top-0 right-0 w-4 h-4 bg-kala-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                                {itemCount}
                            </span>
                        )}
                    </Link>

                    {/* Search */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-kala-600 transition-colors"
                    >
                        <Search size={22} />
                    </button>
                </div>
            </div>

            <AIChatSheet open={isAiOpen} onOpenChange={setIsAiOpen} />
            <MobileSearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
