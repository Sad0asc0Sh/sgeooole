import { create } from 'zustand';
import { cartService, CartItem } from "@/services/cartService";
import { authService } from "@/services/authService";
import { Product } from "@/services/productService";
import { resolvePricing } from "@/lib/pricing";
import { settingsService } from "@/services/settingsService";
import {
    setLocalStorageWithExpiry,
    getLocalStorageWithExpiry,
    removeLocalStorage
} from "@/lib/localStorageHelper";

// Local cart item format (for guest users)
export interface LocalCartItem {
    id: string; // Product ID
    name: string;
    price: number;
    originalPrice?: number;
    image: string;
    color?: string;
    qty: number;
    discount?: number;
    compareAtPrice?: number;
    isFlashDeal?: boolean;
    flashDealEndTime?: string;
    isSpecialOffer?: boolean;
    specialOfferEndTime?: string;
    campaignLabel?: string;
    variantOptions?: Array<{
        name: string;
        value: string;
    }>;
}

const LOCAL_CART_KEY = "welfvita_cart";

// Helper to save local cart with admin settings (expiration)
const saveLocalCart = (cartItems: LocalCartItem[], cartConfig: { persistCart: boolean; cartExpirationDays: number }) => {
    if (typeof window === "undefined") return;

    if (!cartConfig.persistCart) {
        console.log("[useCartStore] Cart persistence disabled, not saving to localStorage");
        return;
    }

    // Use localStorageHelper with expiration from admin settings
    setLocalStorageWithExpiry(LOCAL_CART_KEY, cartItems, cartConfig.cartExpirationDays);
    console.log(`[useCartStore] Saved cart with ${cartItems.length} items, expiry: ${cartConfig.cartExpirationDays === 0 ? 'never' : cartConfig.cartExpirationDays + ' days'}`);
};

// Cart configuration from admin settings
interface CartConfig {
    persistCart: boolean;
    cartExpirationDays: number; // 0 = بی‌نهایت
}

interface CartState {
    cartItems: LocalCartItem[];
    loading: boolean;
    error: string | null;
    initialized: boolean;
    mutating: boolean;
    cartConfig: CartConfig;

    refreshCart: () => Promise<void>;
    refreshCartConfig: () => Promise<CartConfig>;
    addToCart: (product: Product, quantity?: number, variantOptions?: Array<{ name: string; value: string }>) => Promise<void>;
    updateQuantity: (productId: string, quantity: number, variantOptions?: Array<{ name: string; value: string }>) => Promise<void>;
    removeFromCart: (productId: string, variantOptions?: Array<{ name: string; value: string }>) => Promise<void>;
    clearCart: () => Promise<void>;
}

// Helper to transform backend items to local format
const transformBackendItems = (backendItems: CartItem[]): LocalCartItem[] => {
    const now = Date.now();

    const transformedItems: LocalCartItem[] = backendItems.map((item: CartItem) => {
        const rawItem: any = item as any;
        const productData = typeof item.product === "object" && item.product !== null ? (item.product as any) : null;
        const productId =
            typeof item.product === "string"
                ? item.product
                : productData?._id || productData?.id || rawItem._id || "";

        const discountValue = Number.isFinite(rawItem.discount)
            ? Number(rawItem.discount)
            : Number(productData?.discount ?? 0);

        const priceInput = Number(
            (rawItem.finalPrice ?? rawItem.price ?? productData?.price ?? 0)
        ) || 0;

        const compareAtInput = Number(
            rawItem.originalPrice ?? productData?.compareAtPrice ?? rawItem.compareAtPrice ?? 0
        ) || undefined;

        const pricing = resolvePricing({
            price: priceInput,
            discount: discountValue,
            compareAtPrice: compareAtInput,
            isFlashDeal: rawItem.isFlashDeal ?? productData?.isFlashDeal,
            flashDealEndTime: rawItem.flashDealEndTime ?? productData?.flashDealEndTime,
            isSpecialOffer: rawItem.isSpecialOffer ?? productData?.isSpecialOffer,
            specialOfferEndTime: rawItem.specialOfferEndTime ?? productData?.specialOfferEndTime,
            campaignLabel: rawItem.campaignLabel ?? productData?.campaignLabel,
            now,
        });

        const image =
            rawItem.image ||
            (Array.isArray(productData?.images) && productData.images.length > 0
                ? productData.images[0]?.url ?? productData.images[0]
                : null) ||
            (Array.isArray(rawItem.images) && rawItem.images.length > 0
                ? rawItem.images[0]?.url ?? rawItem.images[0]
                : null) ||
            "/placeholder.svg";

        const quantity = Number(rawItem.quantity ?? rawItem.qty ?? 1);

        return {
            id: String(productId),
            name: rawItem.name || productData?.name || "",
            price: pricing.finalPrice,
            originalPrice: pricing.basePrice ?? priceInput,
            image,
            qty: quantity,
            variantOptions: item.variantOptions,
            color: rawItem.color,
            discount: pricing.discount,
            compareAtPrice: pricing.basePrice ?? compareAtInput,
            isFlashDeal: Boolean(rawItem.isFlashDeal ?? productData?.isFlashDeal),
            flashDealEndTime: rawItem.flashDealEndTime ?? productData?.flashDealEndTime,
            isSpecialOffer: Boolean(rawItem.isSpecialOffer ?? productData?.isSpecialOffer),
            specialOfferEndTime: rawItem.specialOfferEndTime ?? productData?.specialOfferEndTime,
            campaignLabel: rawItem.campaignLabel ?? productData?.campaignLabel,
        };
    });

    // Deduplicate items
    return transformedItems.reduce((acc, item) => {
        const variantKey = item.variantOptions
            ?.map((v) => `${v.name}:${v.value}`)
            .sort()
            .join("|") || "no-variant";
        const uniqueKey = `${item.id}-${item.color || "no-color"}-${variantKey}`;

        const existingItem = acc.find((i) => {
            const existingVariantKey = i.variantOptions
                ?.map((v) => `${v.name}:${v.value}`)
                .sort()
                .join("|") || "no-variant";
            const existingKey = `${i.id}-${i.color || "no-color"}-${existingVariantKey}`;
            return existingKey === uniqueKey;
        });

        if (existingItem) {
            existingItem.qty += item.qty;
        } else {
            acc.push(item);
        }

        return acc;
    }, [] as LocalCartItem[]);
};

export const useCartStore = create<CartState>((set, get) => ({
    cartItems: [],
    loading: false,
    error: null,
    initialized: false,
    mutating: false,
    cartConfig: {
        persistCart: true,
        cartExpirationDays: 30, // Default values
    },

    refreshCartConfig: async () => {
        try {
            console.log("[useCartStore] Fetching cart config from server...");
            const config = await settingsService.getCartConfig();
            set({ cartConfig: config });
            console.log("[useCartStore] Cart config loaded:", config);
            return config;
        } catch (err: any) {
            console.error("[useCartStore] Error fetching cart config:", err);
            // Return default config
            return {
                persistCart: true,
                cartExpirationDays: 30,
            };
        }
    },

    refreshCart: async () => {
        const isAuthenticated = authService.isAuthenticated();
        set({ loading: true, error: null, mutating: true });

        try {
            // Fetch cart config from admin settings first
            const config = await get().refreshCartConfig();

            if (isAuthenticated) {
                const response = await cartService.getCart();
                if (response.success && response.data) {
                    const items = transformBackendItems(response.data.items);
                    set({ cartItems: items, initialized: true });
                }
            } else {
                if (typeof window !== "undefined") {
                    // Check if cart persistence is enabled
                    if (!config.persistCart) {
                        console.log("[useCartStore] Cart persistence is disabled. Clearing local cart.");
                        removeLocalStorage(LOCAL_CART_KEY);
                        set({ cartItems: [], initialized: true });
                    } else {
                        // Use localStorageHelper with expiration support
                        const localCart = getLocalStorageWithExpiry<LocalCartItem[]>(LOCAL_CART_KEY, config.cartExpirationDays);

                        if (localCart === null) {
                            console.log("[useCartStore] No valid local cart found (expired or empty).");
                            set({ cartItems: [], initialized: true });
                        } else {
                            console.log("[useCartStore] Local cart loaded with", localCart.length, "items");
                            set({ cartItems: localCart, initialized: true });
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error("[useCartStore] Error loading cart:", err);
            set({ error: err.message || "خطا در بارگذاری سبد خرید" });
        } finally {
            set({ loading: false, mutating: false });
        }
    },

    addToCart: async (product, quantity = 1, variantOptions) => {
        if (get().mutating) return;
        set({ mutating: true });
        const isAuthenticated = authService.isAuthenticated();
        const { cartItems } = get();

        try {
            if (isAuthenticated) {
                // Optimistic Update
                const previousCart = [...cartItems];
                const pricing = resolvePricing({
                    price: product.price,
                    discount: product.discount,
                    compareAtPrice: product.compareAtPrice || product.oldPrice,
                    isFlashDeal: product.isFlashDeal,
                    flashDealEndTime: (product as any).flashDealEndTime,
                    isSpecialOffer: product.isSpecialOffer,
                    specialOfferEndTime: (product as any).specialOfferEndTime,
                    campaignLabel: product.campaignLabel,
                    now: Date.now(),
                });
                const newItem: LocalCartItem = {
                    id: String(product.id),
                    name: product.title,
                    price: pricing.finalPrice,
                    originalPrice: pricing.basePrice,
                    image: product.images[0] || "/placeholder.svg",
                    qty: quantity,
                    discount: pricing.discount,
                    compareAtPrice: product.compareAtPrice,
                    isFlashDeal: product.isFlashDeal,
                    flashDealEndTime: (product as any).flashDealEndTime,
                    isSpecialOffer: product.isSpecialOffer,
                    specialOfferEndTime: (product as any).specialOfferEndTime,
                    campaignLabel: product.campaignLabel,
                    variantOptions: variantOptions,
                };

                const updatedCart = [...cartItems];
                const existingIndex = updatedCart.findIndex((item) => {
                    if (item.id !== String(product.id)) return false;
                    const itemVariants = item.variantOptions || [];
                    const newVariants = variantOptions || [];
                    if (itemVariants.length !== newVariants.length) return false;
                    return itemVariants.every(v1 => newVariants.some(v2 => v1.name === v2.name && v1.value === v2.value));
                });

                if (existingIndex > -1) {
                    const existing = updatedCart[existingIndex];
                    updatedCart[existingIndex] = {
                        ...existing,
                        qty: existing.qty + quantity,
                        price: pricing.finalPrice,
                        originalPrice: pricing.basePrice,
                        discount: pricing.discount,
                        compareAtPrice: product.compareAtPrice,
                        isFlashDeal: product.isFlashDeal,
                        flashDealEndTime: (product as any).flashDealEndTime,
                        isSpecialOffer: product.isSpecialOffer,
                        specialOfferEndTime: (product as any).specialOfferEndTime,
                        campaignLabel: product.campaignLabel,
                    };
                } else {
                    updatedCart.push(newItem);
                }
                set({ cartItems: updatedCart });

                try {
                    const response = await cartService.addItem(product.id, quantity, variantOptions);
                    if (response.success && response.data) {
                        const items = transformBackendItems(response.data.items);
                        set({ cartItems: items });
                    }
                } catch (err) {
                    set({ cartItems: previousCart }); // Revert
                    throw err;
                }
            } else {
                // Guest
                const currentCart = [...cartItems];
                const pricing = resolvePricing({
                    price: product.price,
                    discount: product.discount,
                    compareAtPrice: product.compareAtPrice || product.oldPrice,
                    isFlashDeal: product.isFlashDeal,
                    flashDealEndTime: (product as any).flashDealEndTime,
                    isSpecialOffer: product.isSpecialOffer,
                    specialOfferEndTime: (product as any).specialOfferEndTime,
                    campaignLabel: product.campaignLabel,
                    now: Date.now(),
                });
                const existingIndex = currentCart.findIndex((item) => {
                    if (item.id !== String(product.id)) return false;
                    const itemVariants = item.variantOptions || [];
                    const newVariants = variantOptions || [];
                    if (itemVariants.length !== newVariants.length) return false;
                    return itemVariants.every(v1 => newVariants.some(v2 => v1.name === v2.name && v1.value === v2.value));
                });

                if (existingIndex > -1) {
                    const existing = currentCart[existingIndex];
                    currentCart[existingIndex] = {
                        ...existing,
                        qty: existing.qty + quantity,
                        price: pricing.finalPrice,
                        originalPrice: pricing.basePrice,
                        discount: pricing.discount,
                        compareAtPrice: product.compareAtPrice,
                        isFlashDeal: product.isFlashDeal,
                        flashDealEndTime: (product as any).flashDealEndTime,
                        isSpecialOffer: product.isSpecialOffer,
                        specialOfferEndTime: (product as any).specialOfferEndTime,
                        campaignLabel: product.campaignLabel,
                    };
                } else {
                    const newItem: LocalCartItem = {
                        id: String(product.id),
                        name: product.title,
                        price: pricing.finalPrice,
                        originalPrice: pricing.basePrice,
                        image: product.images[0] || "/placeholder.svg",
                        qty: quantity,
                        discount: pricing.discount,
                        compareAtPrice: product.compareAtPrice,
                        isFlashDeal: product.isFlashDeal,
                        flashDealEndTime: (product as any).flashDealEndTime,
                        isSpecialOffer: product.isSpecialOffer,
                        specialOfferEndTime: (product as any).specialOfferEndTime,
                        campaignLabel: product.campaignLabel,
                        variantOptions: variantOptions,
                    };
                    currentCart.push(newItem);
                }

                saveLocalCart(currentCart, get().cartConfig);
                set({ cartItems: currentCart });
            }
        } catch (err: any) {
            console.error("[useCartStore] Error adding to cart:", err);
            set({ error: err.message || "خطا در افزودن به سبد خرید" });
            throw err;
        } finally {
            set({ mutating: false });
        }
    },

    updateQuantity: async (productId, quantity, variantOptions) => {
        if (get().mutating) return;
        if (quantity < 1) {
            return get().removeFromCart(productId, variantOptions);
        }

        const isAuthenticated = authService.isAuthenticated();
        const { cartItems } = get();

        try {
            set({ mutating: true });
            if (isAuthenticated) {
                // Optimistic Update
                const previousCart = [...cartItems];
                const updatedCart = cartItems.map(item => {
                    if (item.id !== productId) return item;
                    const itemVariants = item.variantOptions || [];
                    const targetVariants = variantOptions || [];
                    if (itemVariants.length !== targetVariants.length) return item;
                    const isMatch = itemVariants.every(v1 => targetVariants.some(v2 => v1.name === v2.name && v1.value === v2.value));
                    return isMatch ? { ...item, qty: Number(quantity) } : item;
                });
                set({ cartItems: updatedCart });

                // Debounce logic is complex in store, simplifying for now to direct call
                // Ideally we should keep the debounce logic, but for fixing the infinite loop, direct call is safer.
                // If performance is an issue, we can add debounce back later.

                try {
                    const response = await cartService.updateItem(productId, quantity, variantOptions);
                    if (response.success && response.data) {
                        const items = transformBackendItems(response.data.items);
                        set({ cartItems: items });
                    }
                } catch (err) {
                    set({ cartItems: previousCart });
                    throw err;
                }

            } else {
                // Guest
                const currentCart = cartItems.map((item) => {
                    if (item.id !== productId) return item;
                    const itemVariants = item.variantOptions || [];
                    const targetVariants = variantOptions || [];
                    if (itemVariants.length !== targetVariants.length) return item;
                    const isMatch = itemVariants.every((v1) => targetVariants.some((v2) => v1.name === v2.name && v1.value === v2.value));
                    return isMatch ? { ...item, qty: Number(quantity) } : item;
                });

                saveLocalCart(currentCart, get().cartConfig);
                set({ cartItems: currentCart });
            }
        } catch (err: any) {
            console.error("[useCartStore] Error updating quantity:", err);
            set({ error: err.message || "خطا در به‌روزرسانی تعداد" });
            throw err;
        } finally {
            set({ mutating: false });
        }
    },

    removeFromCart: async (productId, variantOptions) => {
        if (get().mutating) return;
        const isAuthenticated = authService.isAuthenticated();
        const { cartItems } = get();

        try {
            set({ mutating: true });
            if (isAuthenticated) {
                const previousCart = [...cartItems];
                const updatedCart = cartItems.filter(item => {
                    if (item.id !== productId) return true;
                    const itemVariants = item.variantOptions || [];
                    const targetVariants = variantOptions || [];
                    if (itemVariants.length !== targetVariants.length) return true;
                    const isMatch = itemVariants.every(v1 => targetVariants.some(v2 => v1.name === v2.name && v1.value === v2.value));
                    return !isMatch;
                });
                set({ cartItems: updatedCart });

                try {
                    const response = await cartService.removeItem(productId, variantOptions);
                    if (response.success && response.data) {
                        const items = transformBackendItems(response.data.items);
                        set({ cartItems: items });
                    }
                } catch (err) {
                    set({ cartItems: previousCart });
                    throw err;
                }
            } else {
                const currentCart = cartItems.filter((item) => {
                    if (item.id !== productId) return true;
                    const itemVariants = item.variantOptions || [];
                    const targetVariants = variantOptions || [];
                    if (itemVariants.length !== targetVariants.length) return true;
                    const isMatch = itemVariants.every((v1) => targetVariants.some((v2) => v1.name === v2.name && v1.value === v2.value));
                    return !isMatch;
                });

                saveLocalCart(currentCart, get().cartConfig);
                set({ cartItems: currentCart });
            }
        } catch (err: any) {
            console.error("[useCartStore] Error removing item:", err);
            set({ error: err.message || "خطا در حذف از سبد خرید" });
            throw err;
        } finally {
            set({ mutating: false });
        }
    },

    clearCart: async () => {
        if (get().mutating) return;
        const isAuthenticated = authService.isAuthenticated();
        const { cartItems } = get();

        try {
            set({ mutating: true });
            if (isAuthenticated) {
                const previousCart = [...cartItems];
                set({ cartItems: [] });

                try {
                    await cartService.clearCart();
                } catch (err) {
                    set({ cartItems: previousCart });
                    throw err;
                }
            } else {
                removeLocalStorage(LOCAL_CART_KEY);
                set({ cartItems: [] });
            }
        } catch (err: any) {
            console.error("[useCartStore] Error clearing cart:", err);
            set({ error: err.message || "خطا در پاک کردن سبد خرید" });
            throw err;
        } finally {
            set({ mutating: false });
        }
    }
}));
