import api from "@/lib/api";
import { productService } from "@/services/productService";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedApi = api as unknown as { get: jest.Mock };

describe("productService", () => {
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
});

