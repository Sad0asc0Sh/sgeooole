/**
 * Regression: `cardImages` must stay strictly parallel to `images`
 * (cardImages[i] is the card variant of images[i]). The dual-filter build
 * in the image commits shifted indexes whenever an image had no cardUrl,
 * so galleries paired thumbnails with the wrong photo.
 */
import api from "@/lib/api";
import { mapBackendProduct } from "@/lib/productData";
import { productService } from "@/services/productService";
import { wishlistItemToProduct } from "@/lib/wishlistCard";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedApi = api as unknown as { get: jest.Mock };

const API = "http://localhost:5000/api";

const mixedImages = [
  { url: "https://cdn.example/a.webp" }, // no card variant yet (legacy row)
  { url: "https://cdn.example/b.webp", cardUrl: "https://cdn.example/b-card.webp" },
  "https://cdn.example/c.webp", // plain string image
];

describe("cardImages parallelism", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
  });

  it("mapBackendProduct keeps cardImages[i] aligned with images[i]", () => {
    const product = mapBackendProduct(
      { _id: "p1", name: "P", price: 1000, images: mixedImages } as any,
      API
    );

    expect(product.images).toEqual([
      "https://cdn.example/a.webp",
      "https://cdn.example/b.webp",
      "https://cdn.example/c.webp",
    ]);
    expect(product.cardImages).toEqual([
      "https://cdn.example/a.webp", // falls back to the main image itself
      "https://cdn.example/b-card.webp",
      "https://cdn.example/c.webp",
    ]);
    expect(product.cardImage).toBe("https://cdn.example/a.webp");
  });

  it("mapBackendProduct pairs variant cardImages the same way", () => {
    const product = mapBackendProduct(
      {
        _id: "p2",
        name: "V",
        price: 1000,
        variants: [
          { _id: "v1", price: 1000, stock: 1, options: [], images: mixedImages },
        ],
      } as any,
      API
    );

    expect(product.variants?.[0].images).toHaveLength(3);
    expect(product.variants?.[0].cardImages).toEqual([
      "https://cdn.example/a.webp",
      "https://cdn.example/b-card.webp",
      "https://cdn.example/c.webp",
    ]);
  });

  it("productService mapping keeps cardImages[i] aligned with images[i]", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: { _id: "p3", name: "S", price: 1000, stock: 2, images: mixedImages },
      },
    });

    const product = await productService.getById("p3");

    expect(product.images).toEqual([
      "https://cdn.example/a.webp",
      "https://cdn.example/b.webp",
      "https://cdn.example/c.webp",
    ]);
    expect(product.cardImages).toEqual([
      "https://cdn.example/a.webp",
      "https://cdn.example/b-card.webp",
      "https://cdn.example/c.webp",
    ]);
  });

  it("wishlistItemToProduct pairs variant and top-level cardImages", () => {
    const product = wishlistItemToProduct({
      _id: "w1",
      name: "W",
      price: 1000,
      images: [
        { url: "https://cdn.example/a.webp" },
        { url: "https://cdn.example/b.webp", cardUrl: "https://cdn.example/b-card.webp" },
      ],
      variants: [
        { _id: "v1", price: 1000, stock: 1, options: [], images: mixedImages },
      ],
    } as any);

    expect(product.cardImages).toEqual([
      "https://cdn.example/a.webp",
      "https://cdn.example/b-card.webp",
    ]);
    expect(product.variants?.[0].cardImages).toEqual([
      "https://cdn.example/a.webp",
      "https://cdn.example/b-card.webp",
      "https://cdn.example/c.webp",
    ]);
  });
});
