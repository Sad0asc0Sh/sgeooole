import { generateMetadata } from "@/app/products/page";

jest.mock("@/app/products/ProductsPageClient", () => ({ __esModule: true, default: () => null }));

it.each([
  { inStock: "true" }, { onSale: "true" }, { minRating: "4" },
  { prop_رنگ: ["آبی", "قرمز"] }, { brand: "a,b" },
  { category: "cameras", brand: "a" }, { search: "دوربین" },
])("does not index combinations of product filters: %j", async (query) => {
  const metadata = await generateMetadata({ searchParams: Promise.resolve(query) });
  expect(metadata.robots).toEqual({ index: false, follow: true });
});

it("keeps a single category listing indexable", async () => {
  const metadata = await generateMetadata({ searchParams: Promise.resolve({ category: "cameras" }) });
  expect(metadata.robots).toEqual({ index: true, follow: true });
  expect(metadata.alternates?.canonical).toContain("/products?category=cameras");
});
