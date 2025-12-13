import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ProductDetailClient from "../product/[id]/ProductDetailClient";
import { fetchProductBySlug, fetchProductsForStatic } from "@/lib/productData";
import { buildProductUrl } from "@/lib/paths";

// Force dynamic rendering - no caching, always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

export async function generateStaticParams() {
  const products = await fetchProductsForStatic(100);
  return products.map((product) => {
    const path = buildProductUrl(product).slice(1); // remove leading slash
    return { slug: path.split("/") };
  });
}

type CatchAllParams = Promise<{ slug?: string[] }>;

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

    // If user is on old path like /product/:id, redirect to canonical
    const currentPath = `/${segments.join("/")}`;
    if (canonicalPath !== currentPath) {
      redirect(siteUrl ? `${siteUrl}${canonicalPath}` : canonicalPath);
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
