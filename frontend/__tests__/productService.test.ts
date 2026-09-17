import api from "@/lib/api";
import { productService } from "@/services/productService";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedApi = api as unknown as { get: jest.Mock };

describe("productService", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
  });

  it("maps deep categoryPath correctly from backend payload", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          _id: "p1",
          name: "Test Product",
          price: 100_000,
          discount: 0,
          stock: 3,
          category: {
            _id: "c3",
            name: "Leaf",
            slug: "leaf",
            parent: "c2",
          },
          categoryPath: [
            { _id: "c1", name: "Root", slug: "root" },
            { _id: "c2", name: "Child", slug: "child" },
            { _id: "c3", name: "Leaf", slug: "leaf" },
          ],
        },
      },
    });

    const product = await productService.getById("p1");

    expect(product.categoryPath?.map((c) => c.slug)).toEqual(["root", "child", "leaf"]);
    expect(product.category).toBe("Root > Child > Leaf");
  });

  it("keeps active flash-deal fields and pricing in a best-seller card", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: "flash-best-seller",
            name: "محصول لحظه‌ای",
            slug: "flash-best-seller",
            image: "/uploads/flash.png",
            // Contract returned by /bestsellers: the active discount is already
            // applied once, while compareAtPrice remains the original amount.
            price: 422400,
            discount: 12,
            compareAtPrice: 480000,
            stock: 4,
            isFlashDeal: true,
            flashDealEndTime: "2099-01-01T00:00:00.000Z",
            isSpecialOffer: false,
          },
        ],
      },
    });

    const [product] = await productService.getBestSellers(1);

    expect(mockedApi.get).toHaveBeenCalledWith(
      "/bestsellers?limit=1&in_stock=true&nocache=true",
    );
    expect(product.isFlashDeal).toBe(true);
    expect(product.flashDealEndTime).toBe("2099-01-01T00:00:00.000Z");
    expect(product.discount).toBe(12);
    expect(product.oldPrice).toBe(480000);
    expect(product.price).toBe(422400);
  });

  it("sends listing filter params including stock, sale, rating and multi-value properties", async () => {
    mockedApi.get.mockResolvedValue({
      data: { success: true, data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1 } },
    });

    await productService.getProducts({
      page: 2,
      limit: 24,
      sort: "priceAsc",
      brand: "apple,samsung",
      inStock: true,
      onSale: true,
      minRating: 4,
      minPrice: 0,
      maxPrice: 5_000_000,
      properties: { رنگ: ["آبی", "قرمز"], گارانتی: "۱۸ ماهه" },
    });

    const url = mockedApi.get.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split("?")[1]);

    expect(params.get("page")).toBe("2");
    expect(params.get("brand")).toBe("apple,samsung");
    expect(params.get("inStock")).toBe("true");
    expect(params.get("onSale")).toBe("true");
    expect(params.get("minRating")).toBe("4");
    expect(params.get("minPrice")).toBe("0");
    expect(params.getAll("properties[رنگ]")).toEqual(["آبی", "قرمز"]);
    expect(params.getAll("properties[گارانتی]")).toEqual(["۱۸ ماهه"]);
  });
});

