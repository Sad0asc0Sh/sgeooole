"use client";
import { useState } from "react";
import { Heart, Share2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Product } from "@/services/productService";
import { useWishlist } from "@/hooks/useWishlist";

type ProductSocialActionsProps = {
    product: Product;
};

export default function ProductSocialActions({ product }: ProductSocialActionsProps) {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [copied, setCopied] = useState(false);

    const isFavorite = isInWishlist(product.id);

    const productUrl = typeof window !== "undefined"
        ? `${window.location.origin}/product/${product.slug || product.id}`
        : "";

    const handleShare = async () => {
        if (!productUrl) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.title,
                    text: `${product.title} - ${product.price.toLocaleString("fa-IR")} تومان`,
                    url: productUrl,
                });
                return;
            } catch (err) {
                const maybeAbort =
                    err instanceof DOMException
                    && err.name === "AbortError";
                const maybeAbortCompat =
                    typeof err === "object"
                    && err !== null
                    && "name" in err
                    && (err as { name?: unknown }).name === "AbortError";

                if (maybeAbort || maybeAbortCompat) return;
            }
        }

        await handleCopyLink();
    };

    const handleCopyLink = async () => {
        if (!productUrl) return;
        try {
            await navigator.clipboard.writeText(productUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            try {
                window.prompt("لینک محصول را کپی کنید:", productUrl);
            } catch {
                console.error("Failed to copy:", err);
            }
        }
    };

    return (
        <>
            {/* Action Buttons - Square Icons Centered */}
            <div className="flex items-center justify-center gap-4 mb-4">
                {/* Wishlist Button */}
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => toggleWishlist(product)}
                    className={`
                        w-12 h-12 flex items-center justify-center rounded-xl transition-all shadow-sm
                        ${isFavorite
                            ? "bg-red-50 text-red-500 border border-red-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                        }
                    `}
                    title={isFavorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
                >
                    <Heart
                        size={22}
                        className={isFavorite ? "fill-red-500" : ""}
                    />
                </motion.button>

                {/* Share Button */}
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={handleShare}
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all border border-gray-200 shadow-sm"
                    title={copied ? "لینک کپی شد" : "اشتراک‌گذاری"}
                >
                    {copied ? <Check size={22} /> : <Share2 size={22} />}
                </motion.button>
            </div>
        </>
    );
}
