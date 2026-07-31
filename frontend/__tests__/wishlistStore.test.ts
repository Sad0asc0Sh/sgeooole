import { act } from "react";
import { useWishlistStore } from "@/store/wishlistStore";
import type { Product } from "@/services/productService";

jest.mock("@/services/authService", () => ({
  authService: { isAuthenticated: () => true },
}));

jest.mock("@/services/wishlistService", () => ({
  wishlistService: {
    getWishlist: jest.fn().mockResolvedValue([]),
    addToWishlist: jest.fn().mockResolvedValue({ success: true }),
    removeFromWishlist: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const product: Product = {
  id: "10",
  name: "p",
  title: "Wish Product",
  price: 5000,
  discount: 0,
  image: "/b.png",
  images: ["/b.png"],
  category: "cat",
  rating: 0,
  reviewCount: 0,
  countInStock: 5,
};

describe("wishlistStore", () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useWishlistStore.getState();
    store.wishlistItems = [];
  });

  it("adds and toggles wishlist", async () => {
    await act(async () => {
      await useWishlistStore.getState().addToWishlist(product);
    });
    expect(useWishlistStore.getState().wishlistItems.length).toBe(1);

    await act(async () => {
      await useWishlistStore.getState().toggleWishlist(product);
    });
    expect(useWishlistStore.getState().wishlistItems.length).toBe(0);
  });
});
