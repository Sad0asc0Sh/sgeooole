import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";
import ProductStructuredData from "./ProductStructuredData";
import { fetchProductById, fetchProductByCode, fetchProductBySlug, fetchProductsForStatic, fetchRelatedProducts } from "@/lib/productData";
import { buildProductUrl } from "@/lib/paths";
import ProductRail from "@/components/home/ProductRail";

// Force dynamic rendering - no caching, always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

type PageParams = {
    segments: string[];  // Catch-all: can be ["ky-1234567", "slug"] or just ["old-id"]
};

/**
 * Smart product resolver that handles both URL formats:
 * - New format: /product/ky-1234567/slug-here
 * - Old format: /product/mongodb-object-id
 * - Slug format: /product/product-name-slug
 */
async function resolveProduct(segments: string[]) {
    const firstSegment = segments[0];

    if (!firstSegment) {
        return { product: null, isNewFormat: false };
    }

    // Check if first segment looks like a product code (KY-XXXXXXX)
    if (/^ky-/i.test(firstSegment)) {
        // New URL format: /product/ky-1234567/slug
        const product = await fetchProductByCode(firstSegment);
        if (product) {
            return { product, isNewFormat: true };
        }
    }

    // Try as MongoDB ObjectId (old format)
    try {
        const product = await fetchProductById(firstSegment);
        if (product) {
            return { product, isNewFormat: false };
        }
    } catch (e) {
        // Not a valid ID, continue
    }

    // Try by slug as last resort
    try {
        const productBySlug = await fetchProductBySlug(firstSegment);
        if (productBySlug) {
            return { product: productBySlug, isNewFormat: false };
        }
    } catch (e) {
        // Not found by slug either
    }

    return { product: null, isNewFormat: false };
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
    const { segments } = await params;
    const { product } = await resolveProduct(segments);

    if (!product) {
        return {
            title: "محصول یافت نشد",
            description: "محصول مورد نظر پیدا نشد.",
            robots: { index: false, follow: false },
        };
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
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

export default async function ProductPage({ params }: { params: Promise<PageParams> }) {
    const { segments } = await params;
    const { product, isNewFormat } = await resolveProduct(segments);

    if (!product) {
        notFound();
    }

    // If user accessed via old URL format and product has productCode, redirect to new SEO-friendly URL
    if (!isNewFormat && (product as any).productCode) {
        const newUrl = buildProductUrl(product);
        redirect(newUrl);
    }

    // Fetch related products using the product's category
    let relatedProducts: Awaited<ReturnType<typeof fetchRelatedProducts>> = [];

    try {
        const categoryId = product.categoryPath?.[product.categoryPath.length - 1]?.id;
        if (categoryId) {
            relatedProducts = await fetchRelatedProducts(categoryId, product.id, 10);
        }
    } catch (error) {
        console.error('[ProductPage] Error fetching related products:', error);
    }

    // Get product code - use stored productCode or generate from SKU/ID
    const productCode = (product as any).productCode ||
        `KY-${(product.sku?.replace(/\D/g, '').slice(-7) || product.id.slice(-7)).padStart(7, '0')}`;

    return (
        <>
            <ProductStructuredData product={product} relatedProducts={relatedProducts} />
            <ProductDetailClient product={product} />

            {relatedProducts.length > 0 && (
                <div className="pb-4">
                    <ProductRail
                        title="محصولات مشابه"
                        products={relatedProducts}
                    />
                </div>
            )}

            <div className="bg-gray-50 py-6 px-4 pb-28 border-t border-gray-100">
                <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-xs text-gray-400">کد محصول</span>
                    <span className="text-lg font-mono font-bold bg-white text-gray-800 px-4 py-2 rounded-lg border border-gray-200 tracking-widest shadow-sm">
                        {productCode}
                    </span>
                </div>
            </div>
        </>
    );
}

export async function generateStaticParams() {
    const products = await fetchProductsForStatic(100);
    return products.map((p) => {
        const code = (p as any).productCode?.toLowerCase() || p.id;
        const slug = p.slug || p.id;
        return { segments: [code, slug] };
    });
}
