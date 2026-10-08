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

  describe("variable products", () => {
    const variableBackend = {
      _id: "var1",
      name: "تی‌شرت متغیر",
      productType: "variable",
      // top-level price/stock are empty for variable products
      price: 0,
      stock: 0,
      discount: 10,
      isSpecialOffer: true,
      specialOfferEndTime: "2099-01-01T00:00:00.000Z",
      attributes: [
        {
          name: "رنگ",
          values: ["مشکی", "قرمز"],
          displayType: "color",
          swatches: [{ value: "قرمز", hex: "#ff0000" }],
        },
      ],
      variants: [
        {
          _id: "v1",
          price: 500000,
          stock: 3,
          options: [{ name: "رنگ", value: "مشکی" }],
          images: ["/uploads/black.png"],
        },
        {
          _id: "v2",
          price: 520000,
          stock: 0,
          options: [{ name: "رنگ", value: "قرمز" }],
          images: [],
        },
      ],
    };

    it("maps variants with the same pricing contract, min price and total stock", async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: variableBackend } });

      const product = await productService.getById("var1");

      expect(product.productType).toBe("variable");
      expect(product.variants).toHaveLength(2);
      // 10% special-offer discount applies to each variant
      expect(product.variants![0].price).toBe(450000);
      expect(product.variants![0].oldPrice).toBe(500000);
      expect(product.variants![0].stock).toBe(3);
      expect(product.variants![1].price).toBe(468000);
      // card-level: cheapest price + total stock (fixes «ناموجود» for variable)
      expect(product.price).toBe(450000);
      expect(product.countInStock).toBe(3);
      // attribute swatches array -> record
      expect(product.attributes![0].swatches).toEqual({ "قرمز": "#ff0000" });
      expect(product.attributes![0].displayType).toBe("color");
      // variant images are normalized with backend base
      expect(product.variants![0].images![0]).toContain("/uploads/black.png");
    });

    it("keeps simple products untouched (no variants/attributes override)", async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          success: true,
          data: { _id: "s1", name: "ساده", price: 100000, discount: 0, stock: 7 },
        },
      });

      const product = await productService.getById("s1");

      expect(product.productType).toBe("simple");
      expect(product.variants).toEqual([]);
      expect(product.price).toBe(100000);
      expect(product.countInStock).toBe(7);
    });

    it("skips corrupt variant entries instead of crashing", async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            _id: "var2",
            name: "خراب",
            productType: "variable",
            variants: [null, { _id: "v9", price: 200000, stock: 1, options: null, images: null }],
            attributes: [null],
          },
        },
      });

      const product = await productService.getById("var2");

      expect(product.productType).toBe("variable");
      expect(product.variants).toHaveLength(1);
      expect(product.variants![0].options).toEqual([]);
      expect(product.price).toBe(200000);
      expect(product.countInStock).toBe(1);
    });
  });
});

