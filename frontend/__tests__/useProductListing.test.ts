import { renderHook } from "@testing-library/react";
import useSWR from "swr";
import { useProductListing } from "@/hooks/useProductListing";
import { productService } from "@/services/productService";

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isLoading: true, isValidating: true })),
  useSWRConfig: () => ({ cache: new Map() }),
}));
jest.mock("@/services/productService", () => ({
  productService: { getProducts: jest.fn() },
}));

const swr = useSWR as jest.Mock;
const getProducts = productService.getProducts as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it("delegates all filters and pagination to the server without page-local stock filtering", async () => {
  const response = {
    products: [{ id: "product", countInStock: 0 }],
    total: 50,
    totalPages: 3,
    currentPage: 2,
    priceRange: { min: 0, max: 500 },
  };
  getProducts.mockResolvedValue(response);
  const query = {
    page: 2, sort: "priceAsc", inStock: true, onSale: true, minRating: 4,
    brand: "a,b", properties: { رنگ: ["قرمز", "آبی"] },
  };
  renderHook(() => useProductListing(query));
  const result = await swr.mock.calls[0][1]();
  expect(getProducts).toHaveBeenCalledWith(expect.objectContaining({ ...query, limit: 24 }));
  expect(result).toEqual(response);
});

it("uses a canonical property cache key without conflating commas with multiple values", () => {
  const { rerender } = renderHook(({ values }) => useProductListing({
    page: 1, sort: "newest", properties: { color: values },
  }), { initialProps: { values: ["a", "b"] } });
  const first = swr.mock.calls.at(-1)![0];
  rerender({ values: ["b", "a", "a"] });
  expect(swr.mock.calls.at(-1)![0]).toBe(first);
  rerender({ values: ["a,b"] });
  expect(swr.mock.calls.at(-1)![0]).not.toBe(first);
});

it("keeps stock, sale and rating queries in separate cache entries", () => {
  const { rerender } = renderHook(({ inStock, onSale, minRating }) => useProductListing({
    page: 1, sort: "newest", inStock, onSale, minRating,
  }), { initialProps: { inStock: false, onSale: false, minRating: 0 } });
  const keys = [swr.mock.calls.at(-1)![0]];
  rerender({ inStock: true, onSale: false, minRating: 0 });
  keys.push(swr.mock.calls.at(-1)![0]);
  rerender({ inStock: true, onSale: true, minRating: 0 });
  keys.push(swr.mock.calls.at(-1)![0]);
  rerender({ inStock: true, onSale: true, minRating: 4 });
  keys.push(swr.mock.calls.at(-1)![0]);
  expect(new Set(keys).size).toBe(4);
});

it("revalidates the server listing in a fresh browser and uses it only for the matching query", () => {
  const { rerender } = renderHook(({ brand }) => {
    const initialListing = {
      cacheKey: "product-listing:page=1&sort=newest&brand=briton",
      products: [],
      total: 0,
      totalPages: 1,
      currentPage: 1,
    };
    return useProductListing({ page: 1, sort: "newest", brand }, initialListing);
  }, { initialProps: { brand: "briton" } });

  const [, , options] = swr.mock.calls.at(-1)!;
  expect(options.fallbackData?.currentPage).toBe(1);
  expect(options.revalidateOnMount).toBe(true);

  rerender({ brand: "dahua" });
  expect(swr.mock.calls.at(-1)![2].fallbackData).toBeUndefined();
});

it("keeps the rendered list usable while a background refresh retries", () => {
  const initialListing = {
    cacheKey: "product-listing:page=1&sort=newest",
    products: [],
    total: 0,
    totalPages: 1,
    currentPage: 1,
  };
  swr.mockImplementationOnce((_key, _fetcher, { fallbackData }) => ({
    data: fallbackData,
    error: new Error("Temporary outage"),
    isLoading: false,
    isValidating: true,
  }));

  const { result } = renderHook(() => useProductListing({ page: 1, sort: "newest" }, initialListing));
  expect(result.current).toMatchObject({
    isReady: true,
    showSkeleton: false,
    showUpdating: false,
    showError: false,
  });
});
