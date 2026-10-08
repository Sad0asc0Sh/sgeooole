import type { Product } from "@/types/product";
import { buildProductUrl } from "@/lib/paths";
import { priceRange } from "@/lib/variants";

type ProductStructuredDataProps = {
    product: Product;
    relatedProducts?: Product[];
};

export default function ProductStructuredData({ product, relatedProducts = [] }: ProductStructuredDataProps) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const productUrl = `${siteUrl ? siteUrl : ""}${buildProductUrl(product)}`;
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "ای‌کا‌جی کالا";

    // Build breadcrumb items based on categoryPath
    const breadcrumbItems = [
        {
            "@type": "ListItem" as const,
            position: 1,
            name: "صفحه اصلی",
            item: siteUrl || "/",
        },
    ];

    if (product.categoryPath && product.categoryPath.length > 0) {
        const lastCategory = product.categoryPath[product.categoryPath.length - 1];
        breadcrumbItems.push({
            "@type": "ListItem" as const,
            position: 2,
            name: lastCategory.name,
            item: `${siteUrl || ""}/products?category=${encodeURIComponent(lastCategory.slug || lastCategory.id)}`,
        });
        breadcrumbItems.push({
            "@type": "ListItem" as const,
            position: 3,
            name: product.title,
            item: productUrl,
        });
    }

    // Build related products schema for SEO (isRelatedTo)
    const relatedProductsSchema = relatedProducts.slice(0, 6).map((relProd) => ({
        "@type": "Product" as const,
        name: relProd.title,
        url: `${siteUrl}${buildProductUrl(relProd)}`,
        image: relProd.images?.[0],
        offers: {
            "@type": "Offer" as const,
            priceCurrency: "IRR",
            price: Math.round((relProd.price || 0) * 10),
            availability: relProd.countInStock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
        },
    }));

    // Build structured data with Product and BreadcrumbList schemas.
    // محصول متغیر: AggregateOffer با کف/سقف بازه‌ی variantها؛ محصول ساده: تک Offer مثل قبل.
    const isVariable = product.productType === "variable" && (product.variants?.length ?? 0) > 0;
    const range = isVariable ? priceRange(product.variants) : null;
    const inStock = product.countInStock > 0;
    const offers =
        isVariable && range && range.max > range.min
            ? {
                "@type": "AggregateOffer" as const,
                priceCurrency: "IRR",
                lowPrice: Math.round(range.min * 10),
                highPrice: Math.round(range.max * 10),
                offerCount: product.variants!.length,
                itemCondition: "https://schema.org/NewCondition",
                availability: inStock
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                seller: {
                    "@type": "Organization",
                    name: siteName,
                },
                url: productUrl,
            }
            : {
                "@type": "Offer" as const,
                priceCurrency: "IRR",
                price: Math.round((product.price || 0) * 10),
                itemCondition: "https://schema.org/NewCondition",
                availability: inStock
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                seller: {
                    "@type": "Organization",
                    name: siteName,
                },
                url: productUrl,
                // Add price validity for rich results
                priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            };
    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Product",
                name: product.title,
                description: product.description || product.title,
                image: product.images,
                brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
                sku: product.sku || product.id,
                mpn: product.sku,
                offers,
                // Only emit aggregateRating with real review data — never fabricate
                // a reviewCount (Google penalizes fake rich-result markup).
                aggregateRating:
                    product.rating > 0 && (product.reviewCount || 0) > 0
                        ? {
                            "@type": "AggregateRating",
                            ratingValue: product.rating,
                            reviewCount: product.reviewCount,
                            bestRating: 5,
                            worstRating: 1,
                        }
                        : undefined,
                // SEO: Add related products for better internal linking signals
                ...(relatedProductsSchema.length > 0 ? { isRelatedTo: relatedProductsSchema } : {}),
            },
            ...(breadcrumbItems.length > 1
                ? [
                    {
                        "@type": "BreadcrumbList",
                        itemListElement: breadcrumbItems,
                    },
                ]
                : []),
        ],
    };

    return (
        <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
    );
}
