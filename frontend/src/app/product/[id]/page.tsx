import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";
import ProductStructuredData from "./ProductStructuredData";
import { fetchProductById, fetchProductsForStatic, fetchRelatedProducts } from "@/lib/productData";
import { buildProductUrl } from "@/lib/paths";
import ProductRail from "@/components/home/ProductRail";

// Force dynamic rendering - no caching, always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const product = await fetchProductById(id);

    if (!product) {
        return {
            title: "محصول یافت نشد",
            description: "محصول مورد نظر پیدا نشد.",
            robots: { index: false, follow: false },
        };
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const slug = product.slug || product.id;
    const canonicalPath = buildProductUrl(product);
    const canonicalUrl = siteUrl ? `${siteUrl}${canonicalPath}` : canonicalPath;
    const coverImage = product.images?.[0];

    const priceText = product.price
        ? ` | قیمت ${product.price.toLocaleString("fa-IR")} تومان`
        : "";
    const baseDescription = product.description || product.title;
    const truncate = (value: string, max: number) =>
        value.length <= max ? value : `${value.slice(0, max - 1)}…`;
    const description = truncate(baseDescription, Math.max(0, 155 - priceText.length)) + priceText;

    const keywords = [product.title, product.brand, product.category].filter(Boolean) as string[];
    const seoTitle = `خرید ${product.title} | ${product.brand || "بدون برند"} - قیمت و مشخصات`;
    const indexable = (product as any)?.isActive !== false;

    return {
        title: seoTitle,
        description,
        keywords,
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

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Step 1: Fetch the main product first
    const product = await fetchProductById(id);

    if (!product) {
        notFound();
    }

    // Step 2: Fetch related products using the product's category
    // This is SSR-rendered for SEO benefits - crawlers will see related product links
    let relatedProducts: Awaited<ReturnType<typeof fetchRelatedProducts>> = [];

    try {
        // Get the most specific category (last in path)
        const categoryId = product.categoryPath?.[product.categoryPath.length - 1]?.id;

        if (categoryId) {
            // Use SSR-safe native fetch function (avoids url.parse deprecation)
            relatedProducts = await fetchRelatedProducts(categoryId, id, 10);
        }
    } catch (error) {
        // Silent fail - don't break the page if related products fail
        console.error('[ProductPage] Error fetching related products:', error);
    }

    return (
        <>
            {/* SEO: Structured data with related products for better crawling */}
            <ProductStructuredData product={product} relatedProducts={relatedProducts} />
            <ProductDetailClient product={product} />

            {/* Related Products Section */}
            {relatedProducts.length > 0 && (
                <div className="pb-4">
                    <ProductRail
                        title="محصولات مشابه"
                        products={relatedProducts}
                    />
                </div>
            )}

            {/* Product Code Footer */}
            <div className="bg-gray-50 py-6 px-4 pb-28 border-t border-gray-100">
                <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-xs text-gray-400">کد محصول</span>
                    <span className="text-lg font-mono font-bold bg-white text-gray-800 px-4 py-2 rounded-lg border border-gray-200 tracking-widest shadow-sm">
                        {(() => {
                            const skuDigits = product.sku ? product.sku.replace(/\D/g, '') : '';
                            let code = '';
                            if (skuDigits.length > 0) {
                                code = skuDigits.slice(-7).padStart(7, '0');
                            } else {
                                let hash = 0;
                                for (let i = 0; i < product.id.length; i++) {
                                    hash = ((hash << 5) - hash) + product.id.charCodeAt(i);
                                    hash |= 0;
                                }
                                code = Math.abs(hash).toString().slice(0, 7).padStart(7, '0');
                            }
                            return `KY-${code}`;
                        })()}
                    </span>
                </div>
            </div>
        </>
    );
}

export async function generateStaticParams() {
    const products = await fetchProductsForStatic(100);
    return products.map((p) => ({ id: p.id }));
}
