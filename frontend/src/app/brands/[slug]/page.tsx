import { redirect } from "next/navigation";

export const revalidate = 600;
export const dynamicParams = true;

const encodeQueryValue = (value: string) => {
    if (/%[0-9A-Fa-f]{2}/.test(value)) return value;
    return encodeURIComponent(value);
};

export default function BrandPage({ params }: { params: { slug: string } }) {
    redirect(`/products?brand=${encodeQueryValue(params.slug)}`);
}
