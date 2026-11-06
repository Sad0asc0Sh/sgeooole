import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import ProductDetailClient from "./ProductDetailClient";
import ProductStructuredData from "./ProductStructuredData";
import RelatedProducts from "./RelatedProducts";
import { fetchProductById, fetchProductByCode, fetchProductBySlug } from "@/lib/productData";
import { buildProductUrl, encodeRedirectPath } from "@/lib/paths";
import { buildProductMetaDescription, buildProductSeoTitle } from "@/lib/seo";

// Phase 2 SEO #13 (edge caching): ISR revalidate drives the Cache-Control
// header Next.js emits for prerendered PDPs:
//   Cache-Control: s-maxage=30, stale-while-revalidate
// 30s keeps PDP price/discount fresh: when a promotion timer ends or an admin
// deactivates a sale/coupon, the discounted price disappears within ~30 seconds
// instead of lingering in the cached page for minutes. nginx (in front of PM2)
// honors s-maxage for its shared cache; browsers revalidate in the background
// via stale-while-revalidate.
//
// NOTE: a dynamic route ([...segments]) only enters ISR/full-route-cache mode
// when it exports generateStaticParams() — without it Next.js keeps the route
// fully dynamic (Cache-Control: private, no-cache) and the revalidate export
// has no effect on the response header. Returning [] keeps build-time
// prerendering off (catalog too large) while dynamicParams=true still renders
// every product on demand; the first render is then cached for 30s.
export const revalidate = 30;
export const dynamicParams = true;

export async function generateStaticParams() {
    return [];
}

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
    } catch {
        // Not a valid ID, continue
    }

    // Try by slug as last resort
    try {
        const productBySlug = await fetchProductBySlug(firstSegment);
        if (productBySlug) {
            return { product: productBySlug, isNewFormat: false };
        }
    } catch {
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
    // Collect all real absolute product + variant photos for OG/Twitter metadata
    const validImages = Array.from(
        new Set([
            ...(product.images ?? []),
            ...((product.variants ?? []).flatMap((v) => v?.images ?? [])),
        ])
    ).filter((img) => /^https?:\/\//i.test(img) && !img.toLowerCase().includes("placeholder"));
    // Phase 1 SEO: sanitized Persian meta description (no raw HTML/entities)
    // and no «بدون برند» fallback in the title.
    const description = buildProductMetaDescription(product);

    const keywords = [product.title, product.brand, product.category].filter(Boolean) as string[];
    const seoTitle = buildProductSeoTitle(product);
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
            images: validImages.length > 0 ? validImages.map((url) => ({ url, alt: seoTitle })) : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: seoTitle,
            description,
            images: validImages.length > 0 ? validImages : undefined,
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

    // If user accessed via old URL format and product has productCode, permanently
    // redirect (308) to the new SEO-friendly URL so ranking signals consolidate.
    if (!isNewFormat && (product as any).productCode) {
        const newUrl = buildProductUrl(product);
        // The slug is raw (e.g. Persian) at this point; a Location header
        // must be ASCII-only or Node throws ERR_INVALID_CHAR and the whole
        // request dies as a plain-text 500 instead of redirecting.
        permanentRedirect(encodeRedirectPath(newUrl));
    }

    // Get product code - use stored productCode or generate from SKU/ID
    const productCode = (product as any).productCode ||
        `KY-${(product.sku?.replace(/\D/g, '').slice(-7) || product.id.slice(-7)).padStart(7, '0')}`;

    const categoryPath = product.categoryPath || [];
    const primaryImage = product.images?.find(
        (img) => /^https?:\/\//i.test(img) && !img.toLowerCase().includes("placeholder")
    );

    return (
        <>
            {primaryImage && (
                <link
                    rel="preload"
                    as="image"
                    href={primaryImage}
                    fetchPriority="high"
                />
            )}
            <ProductStructuredData product={product} relatedProducts={[]} />
            <ProductDetailClient product={product} />

            {categoryPath.length > 0 && (
                <Suspense fallback={
                    <div className="pb-4 px-4">
                        <div className="h-8 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
                        <div className="flex gap-4 overflow-hidden">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-40 h-64 bg-gray-100 rounded-xl flex-shrink-0 animate-pulse" />
                            ))}
                        </div>
                    </div>
                }>
                    <RelatedProducts categoryPath={categoryPath} productId={product.id} />
                </Suspense>
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
