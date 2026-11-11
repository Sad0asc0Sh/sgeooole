import Link from "next/link";
import type { Product } from "@/services/productService";

type ProductBreadcrumbProps = {
    product: Product;
};

/**
 * Single-row slash trail (mobile140 PDP style).
 *
 * فروشگاه / <category-path> / <brand> <leaf-category> / <product title short>
 *
 * All links reuse the existing /products?category=…&includeChildren=true
 * contract so category navigation keeps working unchanged.
 */
export default function ProductBreadcrumb({ product }: ProductBreadcrumbProps) {
    const categoryPath = product.categoryPath ?? [];
    if (categoryPath.length === 0 && !product.brand) {
        return null;
    }

    return (
        <nav aria-label="breadcrumb" className="min-w-0">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs text-gray-500">
                <Link href="/" className="shrink-0 hover:text-kala-700 hover:underline transition-colors">
                    فروشگاه اینترنتی
                </Link>

                {categoryPath.map((cat, index) => {
                    const isLastParent = index === categoryPath.length - 1;
                    const href = `/products?category=${encodeURIComponent(cat.slug ?? cat.id)}${!isLastParent ? "&includeChildren=true" : ""}`;
                    return (
                        <span key={cat.id} className="flex shrink-0 items-center gap-1.5">
                            <span aria-hidden className="text-gray-300">/</span>
                            <Link href={href} className="hover:text-kala-700 hover:underline transition-colors">
                                {cat.name}
                            </Link>
                        </span>
                    );
                })}

                {product.brand && categoryPath.length > 0 && (
                    <span className="flex shrink-0 items-center gap-1.5">
                        <span aria-hidden className="text-gray-300">/</span>
                        <Link
                            href={`/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`}
                            className="hover:text-kala-700 hover:underline transition-colors"
                        >
                            {product.brand}
                        </Link>
                        <span aria-hidden className="text-gray-300">/</span>
                        <span className="max-w-[180px] sm:max-w-none truncate text-gray-700 font-bold">
                            {categoryPath[categoryPath.length - 1].name} {product.brand}
                        </span>
                    </span>
                )}
            </div>
        </nav>
    );
}
