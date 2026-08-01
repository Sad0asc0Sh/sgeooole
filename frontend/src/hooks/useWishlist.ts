import { useEffect } from "react";
import { useWishlistStore, WishlistItem } from "@/store/wishlistStore";
import { authService } from "@/services/authService";
import { useAuthModal } from "@/providers/AuthModalProvider";
import type { Product } from "@/services/productService";

export type { WishlistItem };

export const useWishlist = () => {
    const { initialized, refreshWishlist, wishlistItems, addToWishlist: storeAddToWishlist, removeFromWishlist: storeRemoveFromWishlist, toggleWishlist: storeToggleWishlist, loading } = useWishlistStore();
    const { requireAuth } = useAuthModal();

    // Initial load (only once)
    useEffect(() => {
        if (!initialized) {
            refreshWishlist();
        }
    }, [initialized, refreshWishlist]);

    const isInWishlist = (productId: string) => {
        return wishlistItems.some((item) => item.id === productId);
    };

    const requireWishlistAuth = async (): Promise<boolean> => {
        if (authService.isAuthenticated()) return true;

        const ok = await requireAuth({
            title: "ورود / ثبت‌نام",
            description: "برای افزودن به علاقه‌مندی‌ها وارد حساب خود شوید.",
        });

        if (!ok) return false;

        await refreshWishlist();
        return true;
    };

    const addToWishlist = async (product: Product) => {
        try {
            const ok = await requireWishlistAuth();
            if (!ok) return;
            await storeAddToWishlist(product);
        } catch (error) {
            console.error("[WISHLIST] addToWishlist error:", error);
        }
    };

    const removeFromWishlist = async (productId: string) => {
        try {
            const ok = await requireWishlistAuth();
            if (!ok) return;
            await storeRemoveFromWishlist(productId);
        } catch (error) {
            console.error("[WISHLIST] removeFromWishlist error:", error);
        }
    };

    const toggleWishlist = async (product: Product) => {
        try {
            const ok = await requireWishlistAuth();
            if (!ok) return;
            await storeToggleWishlist(product);
        } catch (error) {
            console.error("[WISHLIST] toggleWishlist error:", error);
        }
    };

    return {
        wishlistItems,
        loading,
        error: null,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        refreshWishlist,
        clearWishlist: async () => {},
    };
};
