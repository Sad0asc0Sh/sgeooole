import { fireEvent, render, screen } from "@testing-library/react";
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

describe("BrandsStrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("navigates to products page with brand slug", async () => {
    const push = jest.fn();
    (useRouter as any).mockReturnValue({ push });

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

    const brandLabel = await screen.findByText("DAHUA");
    fireEvent.click(brandLabel);

    expect(push).toHaveBeenCalledWith("/products?brand=dahua");
  });

  it("falls back to _id when slug is missing", async () => {
    const push = jest.fn();
    (useRouter as any).mockReturnValue({ push });

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

    const brandLabel = await screen.findByText("NoSlugBrand");
    fireEvent.click(brandLabel);

    expect(push).toHaveBeenCalledWith(`/products?brand=${brandId}`);
  });
});

