import { redirect } from "next/navigation";
import { brandService } from "@/services/brandService";
import { Metadata } from "next";

export const revalidate = 600;
export const dynamicParams = true;

type Props = {
    params: Promise<{ slug: string }>;
};

const encodeQueryValue = (value: string) => {
    if (/%[0-9A-Fa-f]{2}/.test(value)) return value;
    return encodeURIComponent(value);
};

// Generate static params for all brands
export async function generateStaticParams() {
    try {
        const brands = await brandService.getAll({ limit: 1000 });
        return brands.map((brand) => ({ slug: brand.slug || brand._id }));
    } catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[brands] failed to build params", error);
        } else {
            console.warn("[brands] failed to build params");
        }
        return [];
    }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;

    try {
        const brand = await brandService.getBySlug(slug);
        return {
            title: `محصولات ${brand.name} | ولفویتا`,
            description: brand.description || `مشاهده تمام محصولات برند ${brand.name} در فروشگاه ولفویتا`,
            openGraph: {
                title: `محصولات ${brand.name}`,
                description: brand.description || `مشاهده تمام محصولات برند ${brand.name}`,
                images: brand.logo?.url ? [{ url: brand.logo.url }] : [],
            },
        };
    } catch {
        return {
            title: "محصولات برند | ولفویتا",
            description: "مشاهده محصولات برند در فروشگاه ولفویتا",
        };
    }
}

// Brand page - redirects to products page with brand filter
export default async function BrandPage({ params }: Props) {
    const { slug } = await params;
    redirect(`/products?brand=${encodeQueryValue(slug)}`);
}
