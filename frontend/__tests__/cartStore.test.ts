import { act } from "react";
import { useCartStore } from "@/store/cartStore";
import type { Product } from "@/services/productService";

jest.mock("@/services/authService", () => ({
  authService: { isAuthenticated: () => false },
}));

jest.mock("@/services/cartService", () => ({
  cartService: {
    addItem: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    updateItem: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    removeItem: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    clearCart: jest.fn().mockResolvedValue({ success: true }),
    getCart: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
  },
}));

const product: Product = {
  id: "1",
  name: "p",
  title: "Test Product",
  price: 10000,
  discount: 0,
  image: "/a.png",
  images: ["/a.png"],
  category: "cat",
  rating: 0,
  reviewCount: 0,
  countInStock: 5,
};

describe("cartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useCartStore.getState();
    store.cartItems = [];
    store.mutating = false;
  });

  it("adds item to cart", async () => {
    await act(async () => {
      await useCartStore.getState().addToCart(product, 1, []);
    });
    expect(useCartStore.getState().cartItems.length).toBe(1);
  });

  it("updates quantity", async () => {
    await act(async () => {
      await useCartStore.getState().addToCart(product, 1, []);
      await useCartStore.getState().updateQuantity("1", 2, []);
    });
    expect(useCartStore.getState().cartItems[0].qty).toBe(2);
  });

  it("removes item", async () => {
    await act(async () => {
      await useCartStore.getState().addToCart(product, 1, []);
      await useCartStore.getState().removeFromCart("1", []);
    });
    expect(useCartStore.getState().cartItems.length).toBe(0);
  });
});
