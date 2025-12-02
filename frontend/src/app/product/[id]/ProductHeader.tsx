"use client";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Search, X } from "lucide-react";
import Link from "next/link";
import { Product } from "@/services/productService";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

type ProductHeaderProps = {
    product: Product;
};

export default function ProductHeader({ product }: ProductHeaderProps) {
    const router = useRouter();
    const { itemCount } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const isFavorite = isInWishlist(product.id);

    return (
        <div className="fixed top-0 left-0 w-full z-20 flex justify-between items-center p-4 pointer-events-none">
            {/* Right: Close Button */}
            <button
                onClick={() => router.back()}
                className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:bg-white pointer-events-auto"
            >
                <X size={24} />
            </button>

            {/* Left: Actions (Favorites, Cart, Search) - Visual LTR */}
            <div className="flex gap-3 pointer-events-auto" dir="ltr">
                {/* Favorites */}
                <button
                    onClick={() => toggleWishlist(product)}
                    className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-red-500 transition-colors"
                >
                    <Heart size={20} className={isFavorite ? "fill-red-500 text-red-500" : ""} />
                </button>

                {/* Cart */}
                <Link href="/cart" className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-vita-600 transition-colors relative">
                    <ShoppingCart size={20} />
                    {itemCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-vita-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                            {itemCount}
                        </span>
                    )}
                </Link>

                {/* Search */}
                <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-vita-600 transition-colors">
                    <Search size={20} />
                </button>
            </div>
        </div>
    );
}
