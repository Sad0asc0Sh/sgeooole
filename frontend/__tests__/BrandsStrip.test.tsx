import { render, screen } from "@testing-library/react";
import BrandsStrip from "@/components/home/BrandsStrip";
import { brandService } from "@/services/brandService";
import { useRouter } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/services/brandService", () => ({
  brandService: {
    getHomepageBrands: jest.fn(),
  },
}));

/**
 * These assertions were rewritten when the brand tiles stopped being
 * `<div onClick={() => router.push(...)}>` and became real `<Link href>`
 * elements.
 *
 * The old tiles were not focusable, not keyboard-operable, and inert under
 * touch, so `router.push` was the only observable behaviour to assert. With a
 * real anchor the destination *is* the contract — and it now also supports
 * Tab/Enter, middle-click and "open in new tab", none of which the imperative
 * version did. So the tests check the resolved href rather than a spy on an
 * implementation detail.
 */
describe("BrandsStrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("links to the products page filtered by brand slug", async () => {
    (useRouter as any).mockReturnValue({ push: jest.fn() });

    (brandService.getHomepageBrands as any).mockResolvedValue([
      {
        _id: "brand1",
        name: "DAHUA",
        slug: "dahua",
        logo: null,
        textColor: "#000000",
        hoverColor: "#111111",
        displayOrder: 1,
      },
    ]);

    render(<BrandsStrip />);

    const link = await screen.findByRole("link", { name: /DAHUA/ });
    expect(link).toHaveAttribute("href", "/products?brand=dahua");
  });

  it("falls back to _id when slug is missing", async () => {
    (useRouter as any).mockReturnValue({ push: jest.fn() });

    const brandId = "507f1f77bcf86cd799439011";
    (brandService.getHomepageBrands as any).mockResolvedValue([
      {
        _id: brandId,
        name: "NoSlugBrand",
        slug: undefined,
        logo: null,
        textColor: "#000000",
        hoverColor: "#111111",
        displayOrder: 1,
      },
    ]);

    render(<BrandsStrip />);

    const link = await screen.findByRole("link", { name: /NoSlugBrand/ });
    expect(link).toHaveAttribute("href", `/products?brand=${brandId}`);
  });
});

