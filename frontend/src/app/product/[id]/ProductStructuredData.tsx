import { Product } from "@/services/productService";

type ProductStructuredDataProps = {
    product: Product;
};

export default function ProductStructuredData({ product }: ProductStructuredDataProps) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const productUrl = `${siteUrl ? siteUrl : ""}/product/${product.slug || product.id}`;
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
                sku: product.id,
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
                },
                aggregateRating:
                    product.rating > 0
                        ? {
                            "@type": "AggregateRating",
                            ratingValue: product.rating,
                            reviewCount: product.reviewCount,
                        }
                        : undefined,
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
