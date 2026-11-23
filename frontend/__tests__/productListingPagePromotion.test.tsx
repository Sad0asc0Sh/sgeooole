/** @jest-environment node */

import { renderToStaticMarkup } from "react-dom/server";
import ProductListingPage from "@/app/products/page";
import type { InitialProductListing } from "@/lib/productListingState";

jest.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({ toggleWishlist: jest.fn(), isInWishlist: () => false }),
}));

jest.mock("@/app/products/ProductsPageClient", () => {
  const ProductCard = jest.requireActual<typeof import("@/components/product/ProductCard")>(
    "@/components/product/ProductCard",
  ).default;
  return {
    __esModule: true,
    default: ({ initialListing }: { initialListing?: InitialProductListing | null }) => (
      <>{initialListing?.products.map((product) => <ProductCard key={product.id} product={product} />)}</>
    ),
  };
});

afterEach(() => jest.restoreAllMocks());

it("loads updated campaign pricing into the first render of a fresh listing request", async () => {
  const baseProduct = { _id: "iot-73p8", name: "Briton IOT-73P8", price: 8_900_000, stock: 1 };
  const campaignProduct = {
    ...baseProduct,
    price: 8_188_000,
    compareAtPrice: baseProduct.price,
    discount: 8,
    isSpecialOffer: true,
    specialOfferEndTime: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    campaignLabel: "Black Friday",
  };
  let product = baseProduct;
  let cachedResponse: typeof baseProduct | undefined;
  const fetchListing = jest.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
    const data = options?.cache === "no-store" ? product : (cachedResponse ??= product);
    return Response.json({ success: true, data: [data] });
  });
  const renderListing = async () => renderToStaticMarkup(
    await ProductListingPage({ searchParams: Promise.resolve({ brand: "briton" }) }),
  );
  const price = (amount: number) => `aria-label="${amount.toLocaleString("fa-IR")} تومان"`;

  expect(await renderListing()).toContain(price(8_900_000));
  product = campaignProduct;

  const firstRenderOnReload = await renderListing();
  expect(firstRenderOnReload).toContain(price(8_188_000));
  expect(firstRenderOnReload).toContain((8_900_000).toLocaleString("fa-IR"));
  expect(firstRenderOnReload).toContain("Black Friday");
  const [url, options] = fetchListing.mock.calls.at(-1)!;
  expect(new URL(String(url)).searchParams.get("brand")).toBe("briton");
  expect(options?.cache).toBe("no-store");

  product = baseProduct;
  const afterCampaign = await renderListing();
  expect(afterCampaign).toContain(price(8_900_000));
  expect(afterCampaign).not.toContain("Black Friday");
});
