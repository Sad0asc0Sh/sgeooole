import { useEffect } from "react";
import { useWishlistStore, WishlistItem } from "@/store/wishlistStore";
import { authService } from "@/services/authService";
import { useAuthModal } from "@/providers/AuthModalProvider";
import type { Product } from "@/services/productService";

export type { WishlistItem };

export const useWishlist = () => {
    const store = useWishlistStore();
    const { requireAuth } = useAuthModal();

    // Initial load (only once)
    useEffect(() => {
        if (!store.initialized) {
            store.refreshWishlist();
        }
    }, [store.initialized, store.refreshWishlist]);

    const isInWishlist = (productId: string) => {
        return store.wishlistItems.some((item) => item.id === productId);
    };

    const requireWishlistAuth = async (): Promise<boolean> => {
        if (authService.isAuthenticated()) return true;

        const ok = await requireAuth({
            title: "ورود / ثبت‌نام",
            description: "برای افزودن به علاقه‌مندی‌ها وارد حساب خود شوید.",
        });

        if (!ok) return false;

        await store.refreshWishlist();
        return true;
    };

    const addToWishlist = async (product: Product) => {
        try {
            const ok = await requireWishlistAuth();
            if (!ok) return;
            await store.addToWishlist(product);
        } catch (error) {
            console.error("[WISHLIST] addToWishlist error:", error);
        }
    };

    const removeFromWishlist = async (productId: string) => {
        try {
            const ok = await requireWishlistAuth();
            if (!ok) return;
            await store.removeFromWishlist(productId);
        } catch (error) {
            console.error("[WISHLIST] removeFromWishlist error:", error);
        }
    };

    const toggleWishlist = async (product: Product) => {
        const intentWasInWishlist = isInWishlist(product.id);

        try {
            const ok = await requireWishlistAuth();
            if (!ok) return;

            const nowInWishlist = isInWishlist(product.id);

            if (intentWasInWishlist) {
                if (!nowInWishlist) return;
                await store.removeFromWishlist(product.id);
            } else {
                if (nowInWishlist) return;
                await store.addToWishlist(product);
            }
        } catch (error) {
            console.error("[WISHLIST] toggleWishlist error:", error);
        }
    };

    return {
        wishlistItems: store.wishlistItems,
        loading: store.loading,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        refreshWishlist: store.refreshWishlist,
    };
};
