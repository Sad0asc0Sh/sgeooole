import type { Metadata } from "next";
import { Suspense } from "react";
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
  inStock?: string;
  onSale?: string;
  minRating?: string;
  [key: string]: string | string[] | undefined;
};

const humanizeSlug = (slug: string) => slug.replace(/[-_]/g, " ");

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const brandValues = (Array.isArray(params.brand) ? params.brand : [params.brand || ""])
    .flatMap((value) => value.split(",")).filter(Boolean);
  const brand = brandValues.length === 1 ? brandValues[0] : undefined;
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
  const hasFilters = pageNumber > 1 || Boolean(sort) || Boolean(minPrice) || Boolean(maxPrice)
    || Boolean(search) || brandValues.length > 1 || Boolean(category && brand)
    || params.inStock === "true" || params.onSale === "true" || Boolean(params.minRating)
    || Object.keys(params).some((key) => key.startsWith("prop_"));
  const indexable = !hasFilters;

  let title = "همه محصولات | فروشگاه اینترنتی ای کا جی کالا";
  let description = "مشاهده و خرید آنلاین تمامی محصولات تکنولوژی، دیجیتال و هوشمند در فروشگاه اینترنتی ای کا جی کالا";

  if (category) {
    title = `محصولات ${humanizeSlug(category)} | فروشگاه`;
    description = `مشاهده و خرید محصولات دسته‌بندی ${humanizeSlug(category)}`;
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
      // noindex,follow (not nofollow): keep thin filtered/paginated pages out of
      // the index but let link equity flow through to product pages.
      follow: true,
    },
  };
}

export default async function ProductListingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Phase 2 SEO: ProductsPageClient reads useSearchParams() (filter state).
  // It must suspend inside its own boundary so the route renders a real
  // server shell (header/nav/footer + H1 + intro + metadata) instead of
  // bailing out to a CSR shell.
  //
  // The client renders its own H1 for search results and brand views, so the
  // server header is shown only for the base and category views (no duplicate H1).
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const brandValues = (Array.isArray(params.brand) ? params.brand : [params.brand || ""])
    .flatMap((value) => value.split(","))
    .filter(Boolean);
  const brand = brandValues.length === 1 ? brandValues[0] : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const showServerHeader = !search && !brand;

  return (
    <>
      {showServerHeader && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-6">
          <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">
            {category ? `محصولات ${humanizeSlug(category)}` : "همه محصولات"}
          </h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            {category
              ? `مشاهده و خرید محصولات دسته‌بندی ${humanizeSlug(category)} در فروشگاه ای کا جی کالا؛ با فیلترهای قیمت، برند و موجودی، انتخابی مطمئن و دقیق داشته باشید.`
              : "مشاهده و خرید آنلاین طیف گسترده‌ای از کالاهای تکنولوژی، دیجیتال، الکترونیک و هوشمند در فروشگاه اینترنتی ای کا جی کالا؛ با تضمین اصالت، قیمت به‌روز و گارانتی معتبر."}
          </p>
        </div>
      )}
      <Suspense fallback={null}>
        <ProductsPageClient />
      </Suspense>
    </>
  );
}
