import { Product } from "@/services/productService";
import { buildProductUrl } from "@/lib/paths";

type ProductStructuredDataProps = {
    product: Product;
    relatedProducts?: Product[];
};

export default function ProductStructuredData({ product, relatedProducts = [] }: ProductStructuredDataProps) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const productUrl = `${siteUrl ? siteUrl : ""}${buildProductUrl(product)}`;
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "فروشگاه";

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
            price: relProd.price,
            availability: relProd.countInStock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
        },
    }));

    // Build structured data with Product and BreadcrumbList schemas
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
                offers: {
                    "@type": "Offer",
                    priceCurrency: "IRR",
                    price: product.price,
                    itemCondition: "https://schema.org/NewCondition",
                    availability: product.countInStock > 0
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                    seller: {
                        "@type": "Organization",
                        name: siteName,
                    },
                    url: productUrl,
                    // Add price validity for rich results
                    priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                },
                aggregateRating:
                    product.rating > 0
                        ? {
                            "@type": "AggregateRating",
                            ratingValue: product.rating,
                            reviewCount: product.reviewCount || 1,
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
