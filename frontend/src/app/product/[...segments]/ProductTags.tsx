import Link from "next/link";
import type { Product } from "@/services/productService";

type ProductTagsProps = {
    product: Product;
};

/**
 * Related-tag chips (mobile140 PDP style). Derived from the product data
 * already on the page — brand plus the category path — so no backend
 * change is needed. Hidden when nothing can be derived.
 */
export default function ProductTags({ product }: ProductTagsProps) {
    const tags: Array<{ label: string; href: string }> = [];

    if (product.brand) {
        tags.push({
            label: product.brand,
            href: `/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`,
        });
    }

    for (const cat of product.categoryPath ?? []) {
        if (cat.name && !tags.some((t) => t.label === cat.name)) {
            tags.push({
                label: cat.name,
                href: `/products?category=${encodeURIComponent(cat.slug ?? cat.id)}&includeChildren=true`,
            });
        }
    }

    if (tags.length === 0) {
        return null;
    }

    return (
        <section aria-label="تگ‌های مرتبط" className="mt-6">
            <h2 className="text-base font-bold text-gray-900 leading-7">تگ‌های‌ مرتبط</h2>
            <div className="mt-2 w-[70px] h-[2px] bg-kala-500 rounded-full" />
            <div className="flex flex-wrap items-center gap-2 pt-3 pb-1">
                {tags.map((tag) => (
                    <Link
                        key={`${tag.label}-${tag.href}`}
                        href={tag.href}
                        className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-kala-300 hover:text-kala-700 hover:bg-kala-50 transition-colors"
                    >
                        {tag.label}
                    </Link>
                ))}
            </div>
        </section>
    );
}
