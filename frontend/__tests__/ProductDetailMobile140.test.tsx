import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductBreadcrumb from "@/app/product/[...segments]/ProductBreadcrumb";
import ProductFeatures from "@/app/product/[...segments]/ProductFeatures";
import ProductTrustRow from "@/app/product/[...segments]/ProductTrustRow";
import ProductTags from "@/app/product/[...segments]/ProductTags";
import ProductDisclaimer from "@/app/product/[...segments]/ProductDisclaimer";
import type { Product } from "@/types/product";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

jest.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    cartItems: [],
    addToCart: jest.fn(),
    updateQuantity: jest.fn(),
    removeFromCart: jest.fn(),
  }),
}));

jest.mock("@/components/ui/ResilientImage", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const baseProduct: Product = {
  id: "prod-1",
  name: "میکروفون تست",
  title: "میکروفون تست",
  price: 1000000,
  oldPrice: undefined,
  discount: 0,
  image: "/placeholder.png",
  images: ["/placeholder.png"],
  category: "میکروفون",
  categoryPath: [
    { id: "c1", name: "صوتی و تصویری", slug: "audio-visual" },
    { id: "c2", name: "میکروفون بی سیم", slug: "wireless-microphone" },
  ],
  brand: "هالی لند",
  brandSlug: "hollyland",
  rating: 0,
  reviewCount: 0,
  countInStock: 5,
  specs: [
    { label: "مدل", value: "Lark M2" },
    { label: "وزن", value: "۹ گرم" },
    { label: "زمان کار", value: "تا ۴۰ ساعت" },
  ],
};

describe("mobile140 PDP sections", () => {
  it("renders the slash breadcrumb with category and brand leaf", () => {
    render(<ProductBreadcrumb product={baseProduct} />);
    expect(screen.getByText("فروشگاه اینترنتی")).toBeInTheDocument();
    expect(screen.getByText("صوتی و تصویری")).toBeInTheDocument();
    expect(screen.getByText("هالی لند")).toBeInTheDocument();
    expect(screen.getByText("میکروفون بی سیم هالی لند")).toBeInTheDocument();
  });

  it("renders nothing without category path or brand", () => {
    const { container } = render(
      <ProductBreadcrumb product={{ ...baseProduct, categoryPath: [], brand: undefined }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the features preview and the show-all action", () => {
    render(<ProductFeatures specs={baseProduct.specs} />);
    expect(screen.getByText("ویژگی‌ها")).toBeInTheDocument();
    expect(screen.getByText("Lark M2")).toBeInTheDocument();
    expect(screen.getByText("مشاهده همه ویژگی‌ها")).toBeInTheDocument();
  });

  it("renders nothing without specs", () => {
    const { container } = render(<ProductFeatures specs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the four trust services", () => {
    render(<ProductTrustRow />);
    expect(screen.getByText("امکان تحویل اکسپرس")).toBeInTheDocument();
    expect(screen.getByText("۲۴ ساعته، ۷ روز هفته")).toBeInTheDocument();
    expect(screen.getByText("هفت روز ضمانت بازگشت کالا")).toBeInTheDocument();
    expect(screen.getByText("ضمانت اصل بودن کالا")).toBeInTheDocument();
  });

  it("derives related tags from brand and categories", () => {
    render(<ProductTags product={baseProduct} />);
    expect(screen.getByText("تگ‌های‌ مرتبط")).toBeInTheDocument();
    expect(screen.getByText("هالی لند")).toBeInTheDocument();
    expect(screen.getByText("صوتی و تصویری")).toBeInTheDocument();
  });

  it("renders the unboxing-video notice", () => {
    render(<ProductDisclaimer />);
    expect(screen.getByText(/فیلم‌برداری/)).toBeInTheDocument();
  });
});
