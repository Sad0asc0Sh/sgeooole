import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";
import ProductStructuredData from "./ProductStructuredData";
import { fetchProductById, fetchProductsForStatic, PRODUCT_REVALIDATE } from "@/lib/productData";
import { buildProductUrl } from "@/lib/paths";
import ProductRail from "@/components/home/ProductRail";

export const revalidate = PRODUCT_REVALIDATE;
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

    // Parallel data fetching to avoid waterfall
    const [product, relatedProducts] = await Promise.all([
        fetchProductById(id),
        // Fetch related products only if we have a category
        (async () => {
            try {
                const currentProduct = await fetchProductById(id);
                if (!currentProduct) return [];

                // Get the last category in the path (most specific)
                const categoryId = currentProduct.categoryPath?.[currentProduct.categoryPath.length - 1]?.id;
                if (!categoryId) return [];

                const { productService } = await import('@/services/productService');
                return await productService.getRelated(categoryId, id, 10);
            } catch (error) {
                console.error('Error fetching related products:', error);
                return []; // Return empty array on error to prevent page crash
            }
        })()
    ]);

    if (!product) {
        notFound();
    }

    return (
        <>
            <ProductStructuredData product={product} />
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
        </>
    );
}

export async function generateStaticParams() {
    const products = await fetchProductsForStatic(100);
    return products.map((p) => ({ id: p.id }));
}
