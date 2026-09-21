import { redirect, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ProductDetailClient from "../product/[...segments]/ProductDetailClient";
import ProductStructuredData from "../product/[...segments]/ProductStructuredData";
import { fetchProductBySlug } from "@/lib/productData";
import { buildProductUrl } from "@/lib/paths";

// ISR: cache rendered product pages for 60s instead of re-rendering on every
// hit (previously force-dynamic). Dramatically improves TTFB / crawl budget
// while staying fresh enough after admin edits.
export const revalidate = 60;
export const dynamicParams = true;

type CatchAllParams = Promise<{ slug?: string[] }>;

const truncate = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

export async function generateMetadata({
  params,
}: {
  params: CatchAllParams;
}): Promise<Metadata> {
  const resolved = await params;
  const segments = resolved.slug || [];
  if (segments.length === 0) {
    return {};
  }

  const productSlug = segments[segments.length - 1];
  let product: any = null;
  try {
    product = await fetchProductBySlug(productSlug);
  } catch {
    product = null;
  }

  // Non-product slugs redirect to a category listing; nothing indexable here.
  if (!product) {
    return { robots: { index: false, follow: true } };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const canonicalPath = buildProductUrl(product);
  const canonicalUrl = siteUrl ? `${siteUrl}${canonicalPath}` : canonicalPath;
  const coverImage = product.images?.[0];

  const priceText = product.price
    ? ` | قیمت ${product.price.toLocaleString("fa-IR")} تومان`
    : "";
  const baseDescription = product.description || product.title;
  const description =
    truncate(baseDescription, Math.max(0, 155 - priceText.length)) + priceText;

  const seoTitle = `خرید ${product.title} | ${product.brand || "بدون برند"} - قیمت و مشخصات`;
  const indexable = product?.isActive !== false;

  return {
    title: seoTitle,
    description,
    keywords: [product.title, product.brand, product.category].filter(
      Boolean
    ) as string[],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: seoTitle,
      description,
      url: canonicalUrl,
      type: "website",
      images: coverImage ? [{ url: coverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description,
      images: coverImage ? [coverImage] : undefined,
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
}

export default async function CatchAllPage({ params }: { params: CatchAllParams }) {
  const resolved = await params;
  const segments = resolved.slug || [];
  if (segments.length === 0) {
    redirect("/");
  }

  const productSlug = segments[segments.length - 1];
  const product = await fetchProductBySlug(productSlug);

  if (product) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const canonicalPath = buildProductUrl(product);

    // Permanent consolidation: old/non-canonical product paths → canonical URL.
    // 308 (not 307) so Google drops the old URL and consolidates ranking signals.
    const currentPath = `/${segments.join("/")}`;
    if (canonicalPath !== currentPath) {
      permanentRedirect(siteUrl ? `${siteUrl}${canonicalPath}` : canonicalPath);
    }

    const breadcrumbs = [
      { label: "صفحه اصلی", href: "/" },
      ...(product.categoryPath || []).map((c) => ({
        label: c.name,
        href: `/products?category=${c.slug || c.id}&includeChildren=true`,
      })),
      { label: product.title },
    ];

    return (
      <>
        <ProductStructuredData product={product} relatedProducts={[]} />
        <div className="px-4 pt-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <ProductDetailClient product={product} />
      </>
    );
  }

  // Treat as category path: redirect to products listing with last slug as category
  const categorySlug = productSlug;
  redirect(`/products?category=${encodeURIComponent(categorySlug)}&includeChildren=true`);
}
