import type { Metadata } from "next";
import ProductsPageClient from "./ProductsPageClient";

export const revalidate = 300;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

type SearchParams = {
  category?: string;
  brand?: string;
  search?: string;
  sort?: string;
  page?: string;
  minPrice?: string;
  maxPrice?: string;
};

const humanizeSlug = (slug: string) => slug.replace(/[-_]/g, " ");

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const brand = typeof params.brand === "string" ? params.brand : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const sort = typeof params.sort === "string" ? params.sort : undefined;
  const pageParam = typeof params.page === "string" ? Number(params.page) : undefined;
  const minPrice = typeof params.minPrice === "string" ? params.minPrice : undefined;
  const maxPrice = typeof params.maxPrice === "string" ? params.maxPrice : undefined;

  let canonicalPath = "/products";
  if (category) {
    canonicalPath = `/products?category=${encodeURIComponent(category)}`;
  } else if (brand) {
    canonicalPath = `/products?brand=${encodeURIComponent(brand)}`;
  }
  const canonical = SITE_URL ? `${SITE_URL}${canonicalPath}` : canonicalPath;

  const pageNumber = Number.isFinite(pageParam) && pageParam ? pageParam : 1;
  const hasFilters = pageNumber > 1 || Boolean(sort) || Boolean(minPrice) || Boolean(maxPrice);
  const indexable = !hasFilters;

  let title = "همه محصولات | فروشگاه";
  let description = "مشاهده و خرید تمامی محصولات فروشگاه";

  if (category) {
    title = `محصولات ${humanizeSlug(category)} | فروشگاه`;
    description = `مشاهده محصولات دسته‌بندی ${humanizeSlug(category)}`;
  } else if (brand) {
    title = `محصولات ${humanizeSlug(brand)} | فروشگاه`;
    description = `مشاهده تمام محصولات برند ${humanizeSlug(brand)}`;
  } else if (search) {
    title = `نتایج جستجو: ${search} | فروشگاه`;
    description = `نتایج جستجو برای ${search}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
}

export default function ProductListingPage() {
  return <ProductsPageClient />;
}
