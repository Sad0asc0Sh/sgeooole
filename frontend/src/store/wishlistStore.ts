import { create } from 'zustand';
import { Product } from "@/services/productService";
import { wishlistService } from "@/services/wishlistService";
import { authService } from "@/services/authService";

export interface WishlistItem {
    id: string;
    name: string;
    price: number;
    image: string;
    description?: string;
}

interface WishlistState {
    wishlistItems: WishlistItem[];
    loading: boolean;
    initialized: boolean;

    refreshWishlist: () => Promise<void>;
    addToWishlist: (product: Product) => Promise<void>;
    removeFromWishlist: (productId: string) => Promise<void>;
    toggleWishlist: (product: Product) => Promise<void>;
}

// Transform backend item to local format
const transformBackendItem = (item: any): WishlistItem => ({
    id: item._id || item.id,
    name: item.name,
    price: item.price,
    image: item.images && item.images.length > 0 ? item.images[0].url : (item.image || "/placeholder.jpg"),
    description: item.description,
});

export const useWishlistStore = create<WishlistState>((set, get) => ({
    wishlistItems: [],
    loading: false,
    initialized: false,

    refreshWishlist: async () => {
        const isAuthenticated = authService.isAuthenticated();
        set({ loading: true });
        try {
            if (isAuthenticated) {
                // Authenticated: Fetch from server
                const items = await wishlistService.getWishlist();
                set({ wishlistItems: items.map(transformBackendItem), initialized: true });
            } else {
                // Guest: wishlist requires authentication
                set({ wishlistItems: [], initialized: true });
            }
        } catch (error) {
            console.error("Error loading wishlist:", error);
        } finally {
            set({ loading: false });
        }
    },

    addToWishlist: async (product: Product) => {
        const isAuthenticated = authService.isAuthenticated();
        const { wishlistItems } = get();

        if (!isAuthenticated) {
            throw new Error("AUTH_REQUIRED");
        }

        // Optimistic update
        const previousItems = [...wishlistItems];
        const newItem: WishlistItem = {
            id: product.id,
            name: product.title,
            price: product.price,
            image: product.images[0] || "/placeholder.jpg",
            description: product.description,
        };

        if (!wishlistItems.some(item => item.id === product.id)) {
            const newItems = [...wishlistItems, newItem];
            set({ wishlistItems: newItems });
        }

        try {
            await wishlistService.addToWishlist(product.id);
        } catch (error) {
            console.error("Error adding to wishlist:", error);
            set({ wishlistItems: previousItems }); // Revert on error
        }
    },

    removeFromWishlist: async (productId: string) => {
        const isAuthenticated = authService.isAuthenticated();
        const { wishlistItems } = get();

        if (!isAuthenticated) {
            throw new Error("AUTH_REQUIRED");
        }

        // Optimistic update
        const previousItems = [...wishlistItems];
        const newItems = wishlistItems.filter(item => item.id !== productId);
        set({ wishlistItems: newItems });

        try {
            await wishlistService.removeFromWishlist(productId);
        } catch (error) {
            console.error("Error removing from wishlist:", error);
            set({ wishlistItems: previousItems }); // Revert on error
        }
    },

    toggleWishlist: async (product: Product) => {
        const { wishlistItems, addToWishlist, removeFromWishlist } = get();
        const isInWishlist = wishlistItems.some((item) => item.id === product.id);

        if (isInWishlist) {
            await removeFromWishlist(product.id);
        } else {
            await addToWishlist(product);
        }
    }
}));
