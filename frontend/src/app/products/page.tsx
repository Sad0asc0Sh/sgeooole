import type { Metadata } from "next";
import { Suspense, cache } from "react";
import ProductsPageClient from "./ProductsPageClient";
import { productService } from "@/services/productService";
import { brandService } from "@/services/brandService";

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

// fallback امن وقتی API در زمان build در دسترس نیست
const humanizeSlug = (slug: string) => slug.replace(/[-_]/g, " ");

const firstString = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;

/**
 * نام فارسی واقعی دسته‌بندی و برند را از API می‌گیرد.
 *
 * `cache` باعث می‌شود در یک رندر، `generateMetadata` و خود صفحه فقط یک بار
 * به API بروند (Next این دو را در یک درخواست اجرا می‌کند).
 * هر خطایی (۴۰۴، قطعی API، تایم‌اوت build) به `null` تبدیل می‌شود تا رندر
 * هرگز به‌خاطر سئو شکست نخورد و fallback اسلاگ استفاده شود.
 */
const resolveCategoryName = cache(async (slug?: string): Promise<string | null> => {
  if (!slug) return null;
  try {
    const category = await productService.getCategoryBySlug(slug);
    const name = category?.name?.trim();
    return name ? name : null;
  } catch {
    return null;
  }
});

const resolveBrandName = cache(async (slug?: string): Promise<string | null> => {
  if (!slug) return null;
  try {
    const brand = await brandService.getBySlug(slug);
    const name = brand?.name?.trim();
    return name ? name : null;
  } catch {
    return null;
  }
});

const brandValuesOf = (params: SearchParams): string[] =>
  (Array.isArray(params.brand) ? params.brand : [params.brand || ""])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const singleBrandSlug = (params: SearchParams): string | undefined => {
  const values = brandValuesOf(params);
  return values.length === 1 ? values[0] : undefined;
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const category = firstString(params.category);
  const brandValues = brandValuesOf(params);
  const brand = brandValues.length === 1 ? brandValues[0] : undefined;
  const search = firstString(params.search);
  const sort = firstString(params.sort);
  const pageParam = typeof params.page === "string" ? Number(params.page) : undefined;
  const minPrice = firstString(params.minPrice);
  const maxPrice = firstString(params.maxPrice);

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

  // نام فارسی از API؛ در نبود آن اسلاگ خوانا می‌شود (هرگز اسلاگ خام نمایش داده نمی‌شود)
  const [categoryName, brandName] = await Promise.all([
    resolveCategoryName(category),
    resolveBrandName(brand),
  ]);

  if (category) {
    const label = categoryName || humanizeSlug(category);
    title = `خرید ${label} | لیست قیمت و مشخصات | فروشگاه ای کا جی کالا`;
    description = `مشاهده و خرید ${label} با قیمت به‌روز، مشخصات فنی کامل و فیلترهای دقیق (برند، قیمت، ویژگی‌ها) در فروشگاه اینترنتی ای کا جی کالا.`;
  } else if (brand) {
    const label = brandName || humanizeSlug(brand);
    title = `محصولات برند ${label} | لیست قیمت | فروشگاه ای کا جی کالا`;
    description = `مشاهده تمام محصولات برند ${label} با قیمت به‌روز و مشخصات فنی در فروشگاه اینترنتی ای کا جی کالا.`;
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
  const category = firstString(params.category);
  const brand = singleBrandSlug(params);
  const search = firstString(params.search);
  const showServerHeader = !search && !brand;

  // نام فارسی واقعی (نه اسلاگ) برای H1 و متن سئو
  const categoryName = showServerHeader ? await resolveCategoryName(category) : null;
  const label = categoryName || (category ? humanizeSlug(category) : null);

  return (
    <>
      {showServerHeader && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-6">
          <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">
            {label ? `محصولات ${label}` : "همه محصولات"}
          </h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            {label
              ? `مشاهده و خرید محصولات دسته‌بندی ${label} در فروشگاه ای کا جی کالا؛ با فیلترهای قیمت، برند و موجودی، انتخابی مطمئن و دقیق داشته باشید.`
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
