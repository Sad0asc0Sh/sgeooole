import { create } from 'zustand';
import { cartService, CartItem } from "@/services/cartService";
import { authService } from "@/services/authService";
import { Product, productService } from "@/services/productService";
import { resolvePricing } from "@/lib/pricing";
import { settingsService } from "@/services/settingsService";
import {
    setLocalStorageWithExpiry,
    getLocalStorageWithExpiry,
    removeLocalStorage
} from "@/lib/localStorageHelper";

// Batched delta mutations (per product+variant) to prevent request spamming + race conditions
const flushTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const pendingDeltas = new Map<string, number>();
const inFlightKeys = new Set<string>();
const FLUSH_DELAY = 150; // ms
// Backwards-compat aliases (legacy debounced code paths)
const debounceTimeouts = flushTimeouts;
const DEBOUNCE_DELAY = FLUSH_DELAY;

const buildVariantKey = (variantOptions?: Array<{ name: string; value: string }>) => {
    return variantOptions
        ?.map((v) => `${String(v.name).trim()}:${String(v.value).trim()}`)
        .sort()
        .join("|") || "no-variant";
};

const buildMutationKey = (productId: string, variantOptions?: Array<{ name: string; value: string }>) => {
    return `${productId}-${buildVariantKey(variantOptions)}`;
};

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

const LOCAL_CART_KEY = "ekgkala_cart";

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
    cartVersion: number;
    cartConfig: CartConfig;

    refreshCart: () => Promise<void>;
    refreshCartConfig: () => Promise<CartConfig>;
    /**
     * Revalidate stored cart prices against live backend data.
     * - Authenticated: pulls the server-priced cart (source of truth).
     * - Guest: re-fetches every product and rewrites stale snapshot prices
     *   (e.g. a discount applied after the item was added).
     * Safe to call on cart/checkout mount; failures keep the current cart.
     */
    revalidateCartPrices: () => Promise<void>;
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

const clearMutationState = (mutationKey: string) => {
    pendingDeltas.delete(mutationKey);

    const timeout = flushTimeouts.get(mutationKey);
    if (timeout) clearTimeout(timeout);

    flushTimeouts.delete(mutationKey);
    inFlightKeys.delete(mutationKey);
};

const clearAllMutationState = () => {
    for (const timeout of flushTimeouts.values()) {
        clearTimeout(timeout);
    }
    flushTimeouts.clear();
    pendingDeltas.clear();
    inFlightKeys.clear();
};

const applyServerCartIfNewer = (set: any, get: any, data: any) => {
    if (!data || !Array.isArray(data.items)) return;

    const serverVersion = Number(data.version ?? 0);
    const currentVersion = Number(get().cartVersion ?? 0);

    if (serverVersion < currentVersion) return;

    const serverItems = transformBackendItems(data.items);
    const currentItems: LocalCartItem[] = get().cartItems || [];

    const serverKeySet = new Set(
        serverItems.map((item) => buildMutationKey(item.id, item.variantOptions))
    );

    const mergedItems = serverItems.map((item) => {
        const key = buildMutationKey(item.id, item.variantOptions);
        const pending = pendingDeltas.get(key) || 0;
        const nextQty = item.qty + pending;

        return pending !== 0 ? { ...item, qty: nextQty } : item;
    });

    for (const optimisticItem of currentItems) {
        const key = buildMutationKey(optimisticItem.id, optimisticItem.variantOptions);
        if (!serverKeySet.has(key)) {
            mergedItems.push(optimisticItem);
        }
    }

    set({ cartItems: mergedItems, cartVersion: serverVersion });
};

const flushDeltaMutation = async (
    set: any,
    get: any,
    productId: string,
    variantOptions?: Array<{ name: string; value: string }>
) => {
    const mutationKey = buildMutationKey(productId, variantOptions);
    flushTimeouts.delete(mutationKey);

    if (!authService.isAuthenticated()) {
        pendingDeltas.delete(mutationKey);
        return;
    }

    if (inFlightKeys.has(mutationKey)) {
        const timeoutId = setTimeout(() => {
            flushDeltaMutation(set, get, productId, variantOptions);
        }, FLUSH_DELAY);
        flushTimeouts.set(mutationKey, timeoutId);
        return;
    }

    const deltaToSend = pendingDeltas.get(mutationKey) || 0;
    if (deltaToSend === 0) return;

    pendingDeltas.set(mutationKey, 0);
    inFlightKeys.add(mutationKey);

    try {
        const response = await cartService.adjustItem(productId, deltaToSend, variantOptions);
        if (response.success && response.data) {
            applyServerCartIfNewer(set, get, response.data);
        }
    } catch (err: any) {
        const status = Number(err?.status ?? err?.response?.status);
        const code = err?.code ?? err?.data?.code ?? err?.response?.data?.code;

        // 409/CART_MIN_QTY is a deterministic conflict (won't succeed on retry as-is). Reconcile instead of retrying.
        if (status === 409 && code === "CART_MIN_QTY") {
            const serverQty = Number(err?.data?.currentQuantity ?? err?.response?.data?.currentQuantity);
            const targetVariantKey = buildVariantKey(variantOptions);
            const desiredQty =
                get().cartItems.find((item: LocalCartItem) => {
                    if (item.id !== productId) return false;
                    return buildVariantKey(item.variantOptions) === targetVariantKey;
                })?.qty ?? 1;

            try {
                if (Number.isFinite(serverQty) && serverQty > 0) {
                    const pending = pendingDeltas.get(mutationKey) || 0;
                    const desiredServerQty = Math.max(1, desiredQty - pending);
                    const correctedDelta = desiredServerQty - serverQty;

                    if (correctedDelta !== 0) {
                        const corrected = await cartService.adjustItem(productId, correctedDelta, variantOptions);
                        if (corrected.success && corrected.data) {
                            applyServerCartIfNewer(set, get, corrected.data);
                            return;
                        }
                    }
                }

                const refreshed = await cartService.getCart();
                if (refreshed.success && refreshed.data) {
                    applyServerCartIfNewer(set, get, refreshed.data);
                }
            } catch (reconcileErr: any) {
                set({ error: reconcileErr?.message || err.message || "Error adjusting cart item" });
            }

            return;
        }

        pendingDeltas.set(mutationKey, (pendingDeltas.get(mutationKey) || 0) + deltaToSend);
        set({ error: err.message || "Error adjusting cart item" });
    } finally {
        inFlightKeys.delete(mutationKey);

        const remaining = pendingDeltas.get(mutationKey) || 0;
        if (remaining !== 0) {
            const timeoutId = setTimeout(() => {
                flushDeltaMutation(set, get, productId, variantOptions);
            }, FLUSH_DELAY);
            flushTimeouts.set(mutationKey, timeoutId);
        }
    }
};

const enqueueDeltaMutation = (
    set: any,
    get: any,
    productId: string,
    delta: number,
    variantOptions?: Array<{ name: string; value: string }>
) => {
    const mutationKey = buildMutationKey(productId, variantOptions);
    pendingDeltas.set(mutationKey, (pendingDeltas.get(mutationKey) || 0) + delta);

    const existingTimeout = flushTimeouts.get(mutationKey);
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeoutId = setTimeout(() => {
        flushDeltaMutation(set, get, productId, variantOptions);
    }, FLUSH_DELAY);

    flushTimeouts.set(mutationKey, timeoutId);
};

export const useCartStore = create<CartState>((set, get) => ({
    cartItems: [],
    loading: false,
    error: null,
    initialized: false,
    mutating: false,
    cartVersion: 0,
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
                    applyServerCartIfNewer(set, get, response.data);
                    set({ initialized: true });
                }
            } else {
                if (typeof window !== "undefined") {
                    // Check if cart persistence is enabled
                    if (!config.persistCart) {
                        console.log("[useCartStore] Cart persistence is disabled. Clearing local cart.");
                        removeLocalStorage(LOCAL_CART_KEY);
                        set({ cartItems: [], cartVersion: 0, initialized: true });
                    } else {
                        // Use localStorageHelper with expiration support
                        const localCart = getLocalStorageWithExpiry<LocalCartItem[]>(LOCAL_CART_KEY, config.cartExpirationDays);

                        if (localCart === null) {
                            console.log("[useCartStore] No valid local cart found (expired or empty).");
                            set({ cartItems: [], cartVersion: 0, initialized: true });
                        } else {
                            console.log("[useCartStore] Local cart loaded with", localCart.length, "items");
                            set({ cartItems: localCart, cartVersion: 0, initialized: true });
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

    revalidateCartPrices: async () => {
        const isAuthenticated = authService.isAuthenticated();

        // Authenticated carts are priced by the server on every read.
        if (isAuthenticated) {
            try {
                const response = await cartService.getCart();
                if (response.success && response.data) {
                    applyServerCartIfNewer(set, get, response.data);
                }
            } catch {
                // Offline/backend unreachable: keep the current cart.
            }
            return;
        }

        // Guest carts live only in localStorage and would otherwise keep a
        // stale (pre-discount) snapshot forever. Refresh each line from the
        // live product record; keep the old line if its product is gone.
        const { cartItems } = get();
        if (cartItems.length === 0) return;

        const refreshed = await Promise.all(
            cartItems.map(async (item) => {
                try {
                    const fresh = await productService.getById(item.id);
                    if (!fresh || String(fresh.id) !== String(item.id)) return item;

                    const pricing = resolvePricing({
                        price: fresh.price,
                        discount: fresh.discount,
                        compareAtPrice: fresh.compareAtPrice || (fresh as any).oldPrice,
                        isFlashDeal: fresh.isFlashDeal,
                        flashDealEndTime: (fresh as any).flashDealEndTime,
                        isSpecialOffer: fresh.isSpecialOffer,
                        specialOfferEndTime: (fresh as any).specialOfferEndTime,
                        campaignLabel: fresh.campaignLabel,
                        now: Date.now(),
                    });

                    return {
                        ...item,
                        name: fresh.title || item.name,
                        price: pricing.finalPrice,
                        originalPrice: pricing.basePrice,
                        image: fresh.images?.[0] || item.image,
                        discount: pricing.discount,
                        compareAtPrice: fresh.compareAtPrice,
                        isFlashDeal: fresh.isFlashDeal,
                        flashDealEndTime: (fresh as any).flashDealEndTime,
                        isSpecialOffer: fresh.isSpecialOffer,
                        specialOfferEndTime: (fresh as any).specialOfferEndTime,
                        campaignLabel: fresh.campaignLabel,
                    };
                } catch {
                    return item;
                }
            })
        );

        saveLocalCart(refreshed, get().cartConfig);
        set({ cartItems: refreshed });
    },

    addToCart: async (product, quantity = 1, variantOptions) => {
        const isAuthenticated = authService.isAuthenticated();
        const { cartItems } = get();
        const safeQty = Math.max(1, Number(quantity) || 1);

        // Live-price guard: the rendered `product` snapshot may be stale
        // (ISR / router cache from before a discount was applied). Fetch the
        // current record so the cart always stores the live price. On failure
        // (offline/backend down) fall back to the rendered snapshot.
        try {
            const fresh = await productService.getById(String(product.id));
            if (fresh && String(fresh.id) === String(product.id)) {
                product = fresh;
            }
        } catch {
            // keep rendered snapshot
        }

        try {
            if (isAuthenticated) {
                // Optimistic Update
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
                    qty: safeQty,
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
                        qty: existing.qty + safeQty,
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

                enqueueDeltaMutation(set, get, String(product.id), safeQty, variantOptions);
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
                        qty: existing.qty + safeQty,
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
                        qty: safeQty,
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
        }
    },

    updateQuantity: async (productId, quantity, variantOptions) => {
        // Handle removal separately (no debounce for removal)
        if (quantity < 1) {
            return get().removeFromCart(productId, variantOptions);
        }

        const isAuthenticated = authService.isAuthenticated();
        const { cartItems } = get();

        // Delta-based mutations (race-safe) — batch rapid +/- clicks and ignore stale responses via cartVersion
        const targetVariantKey = buildVariantKey(variantOptions);
        const currentItem = cartItems.find((item) => {
            if (item.id !== productId) return false;
            return buildVariantKey(item.variantOptions) === targetVariantKey;
        });

        if (!currentItem) return;

        const nextQty = Math.max(1, Number(quantity) || 1);
        const delta = nextQty - currentItem.qty;
        if (delta === 0) return;

        const nextCart = cartItems.map((item) => {
            if (item.id !== productId) return item;
            if (buildVariantKey(item.variantOptions) !== targetVariantKey) return item;
            return { ...item, qty: nextQty };
        });

        set({ cartItems: nextCart });

        if (isAuthenticated) {
            enqueueDeltaMutation(set, get, productId, delta, variantOptions);
        } else {
            saveLocalCart(nextCart, get().cartConfig);
        }

        return;

        // Create unique key for this product+variant combination
        const variantKey = variantOptions
            ?.map((v) => `${v.name}:${v.value}`)
            .sort()
            .join("|") || "no-variant";
        const debounceKey = `${productId}-${variantKey}`;

        // 1. INSTANT UI UPDATE (Optimistic)
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

        // 2. DEBOUNCED SERVER SYNC
        // Clear any existing timeout for this product
        const existingTimeout = debounceTimeouts.get(debounceKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new debounced timeout
        const timeoutId = setTimeout(async () => {
            debounceTimeouts.delete(debounceKey);

            if (isAuthenticated) {
                try {
                    console.log(`[CartStore] Syncing quantity for ${productId}: ${quantity}`);
                    const response = await cartService.updateItem(productId, quantity, variantOptions);

                    if (response.success && response.data) {
                        // Only update if this is still the latest data
                        // (user might have clicked again while waiting)
                        const currentCart = get().cartItems;
                        const currentItem = currentCart.find(i => i.id === productId);

                        // If current quantity matches what we sent, sync with server response
                        if (currentItem?.qty === quantity) {
                            const items = transformBackendItems(response.data.items);
                            set({ cartItems: items });
                        }
                    }
                } catch (err: any) {
                    console.error("[CartStore] Error syncing quantity:", err);
                    // Rollback on error
                    set({
                        cartItems: previousCart,
                        error: err.message || "خطا در به‌روزرسانی تعداد"
                    });
                }
            } else {
                // Guest: Sync to localStorage (already updated in UI, just persist)
                const currentCart = get().cartItems;
                saveLocalCart(currentCart, get().cartConfig);
            }
        }, DEBOUNCE_DELAY);

        debounceTimeouts.set(debounceKey, timeoutId);
    },

    removeFromCart: async (productId, variantOptions) => {
        if (get().mutating) return;
        const isAuthenticated = authService.isAuthenticated();
        const { cartItems } = get();

        try {
            set({ mutating: true });
            if (isAuthenticated) {
                clearMutationState(buildMutationKey(productId, variantOptions));
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
                        applyServerCartIfNewer(set, get, response.data);
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
                clearAllMutationState();
                const previousCart = [...cartItems];
                set({ cartItems: [] });

                try {
                    const response = await cartService.clearCart();
                    if (response.success && response.data) {
                        applyServerCartIfNewer(set, get, response.data);
                    } else {
                        set({ cartItems: [], cartVersion: 0 });
                    }
                } catch (err) {
                    set({ cartItems: previousCart });
                    throw err;
                }
            } else {
                removeLocalStorage(LOCAL_CART_KEY);
                set({ cartItems: [], cartVersion: 0 });
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
