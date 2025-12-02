import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";
import ProductStructuredData from "./ProductStructuredData";
import { fetchProductById, fetchProductsForStatic, PRODUCT_REVALIDATE } from "@/lib/productData";
import { buildProductUrl } from "@/lib/paths";

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
    const product = await fetchProductById(id);

    if (!product) {
        notFound();
    }

    return (
        <>
            <ProductStructuredData product={product} />
            <ProductDetailClient product={product} />
        </>
    );
}

export async function generateStaticParams() {
    const products = await fetchProductsForStatic(100);
    return products.map((p) => ({ id: p.id }));
}
