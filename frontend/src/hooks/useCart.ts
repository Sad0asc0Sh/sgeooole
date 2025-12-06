import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { authService } from "@/services/authService";
import { resolvePricing } from "@/lib/pricing";

export const useCart = () => {
  const store = useCartStore();
  const isAuthenticated = authService.isAuthenticated();
  const [now, setNow] = useState(() => Date.now());

  // Initialize cart on mount (only once per app session)
  useEffect(() => {
    if (!store.initialized) {
      store.refreshCart();
    }
  }, [store.initialized, store.refreshCart]);

  // Tick every second so countdown expirations reflect in pricing
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Re-evaluate pricing for items at render time (handles expired countdowns)
  const computedCartItems = useMemo(() => {
    return store.cartItems.map((item) => {
      const basePrice = item.originalPrice ?? item.compareAtPrice ?? item.price;
      const compareAtPrice = item.compareAtPrice ?? item.originalPrice ?? basePrice;

      const pricing = resolvePricing({
        price: basePrice,
        discount: item.discount,
        compareAtPrice,
        isFlashDeal: item.isFlashDeal,
        flashDealEndTime: item.flashDealEndTime,
        isSpecialOffer: item.isSpecialOffer,
        specialOfferEndTime: item.specialOfferEndTime,
        campaignLabel: item.campaignLabel,
        now,
      });

      return {
        ...item,
        price: pricing.finalPrice,
        originalPrice: pricing.basePrice,
        discount: pricing.discount,
      };
    });
  }, [store.cartItems, now]);

  /**
   * Get total price
   */
  const totalPrice = computedCartItems.reduce(
    (total, item) => {
      return total + item.price * item.qty;
    },
    0
  );

  /**
   * Get item count
   */
  const itemCount = computedCartItems.reduce((total, item) => total + item.qty, 0);

  /**
   * Check if product is in cart
   */
  const isInCart = (productId: string): boolean => {
    return computedCartItems.some((item) => item.id === productId);
  };

  /**
   * Get item quantity by product ID
   */
  const getItemQuantity = (productId: string): number => {
    const item = computedCartItems.find((item) => item.id === productId);
    return item?.qty || 0;
  };

  /**
   * Get total original price (before discounts)
   */
  const totalOriginalPrice = computedCartItems.reduce((total, item) => total + (item.originalPrice ?? item.price) * item.qty, 0);

  /**
   * Get total profit (savings from product discounts)
   */
  const totalProfit = Math.max(0, totalOriginalPrice - totalPrice);

  return {
    // State
    cartItems: computedCartItems,
    loading: store.loading,
    error: store.error,
    totalPrice,
    totalOriginalPrice,
    totalProfit,
    itemCount,
    cartConfig: store.cartConfig,

    // Methods
    addToCart: store.addToCart,
    updateQuantity: store.updateQuantity,
    removeFromCart: store.removeFromCart,
    clearCart: store.clearCart,
    refreshCart: store.refreshCart,
    refreshCartConfig: store.refreshCartConfig,
    isInCart,
    getItemQuantity,

    // Flags
    isEmpty: store.cartItems.length === 0,
    isAuthenticated,
  };
};
