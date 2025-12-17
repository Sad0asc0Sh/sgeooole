"use client";
import { useState } from "react";
import { Heart, Share2, Copy, Check, MessageCircle, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Product } from "@/services/productService";
import { useWishlist } from "@/hooks/useWishlist";

type ProductSocialActionsProps = {
    product: Product;
};

export default function ProductSocialActions({ product }: ProductSocialActionsProps) {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const isFavorite = isInWishlist(product.id);

    const productUrl = typeof window !== "undefined"
        ? `${window.location.origin}/product/${product.slug || product.id}`
        : "";

    const handleShare = async () => {
        // Try native share first (mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.title,
                    text: `${product.title} - ${product.price.toLocaleString("fa-IR")} تومان`,
                    url: productUrl,
                });
                return;
            } catch (err) {
                // User cancelled or not supported, show custom dialog
            }
        }
        setIsShareOpen(true);
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(productUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const shareOptions = [
        {
            name: "تلگرام",
            icon: Send,
            color: "bg-[#0088cc]",
            url: `https://t.me/share/url?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(product.title)}`,
        },
        {
            name: "واتساپ",
            icon: MessageCircle,
            color: "bg-[#25D366]",
            url: `https://wa.me/?text=${encodeURIComponent(`${product.title}\n${productUrl}`)}`,
        },
    ];

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
                    title="اشتراک‌گذاری"
                >
                    <Share2 size={22} />
                </motion.button>
            </div>

            {/* Share Modal/Sheet */}
            <AnimatePresence>
                {isShareOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-[200]"
                            onClick={() => setIsShareOpen(false)}
                        />

                        {/* Bottom Sheet */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[201] p-6 pb-10"
                        >
                            {/* Handle */}
                            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />

                            <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">
                                اشتراک‌گذاری محصول
                            </h3>

                            {/* Product Preview */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-6">
                                {product.image && (
                                    <img
                                        src={product.image}
                                        alt={product.title}
                                        className="w-16 h-16 object-contain rounded-lg bg-white"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {product.title}
                                    </p>
                                    <p className="text-sm text-vita-600 font-bold">
                                        {product.price.toLocaleString("fa-IR")} تومان
                                    </p>
                                </div>
                            </div>

                            {/* Share Options */}
                            <div className="flex justify-center gap-4 mb-6">
                                {shareOptions.map((option) => (
                                    <a
                                        key={option.name}
                                        href={option.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex flex-col items-center gap-2"
                                        onClick={() => setIsShareOpen(false)}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl ${option.color} flex items-center justify-center shadow-lg`}>
                                            <option.icon size={24} className="text-white" />
                                        </div>
                                        <span className="text-xs font-medium text-gray-600">
                                            {option.name}
                                        </span>
                                    </a>
                                ))}
                            </div>

                            {/* Copy Link */}
                            <div className="flex gap-2">
                                <div className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-600 truncate font-mono" dir="ltr">
                                    {productUrl}
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleCopyLink}
                                    className={`
                                        px-4 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all
                                        ${copied
                                            ? "bg-green-500 text-white"
                                            : "bg-vita-500 text-white hover:bg-vita-600"
                                        }
                                    `}
                                >
                                    {copied ? (
                                        <>
                                            <Check size={18} />
                                            کپی شد
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={18} />
                                            کپی
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
