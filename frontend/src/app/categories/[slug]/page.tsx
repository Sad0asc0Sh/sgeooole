import { redirect } from "next/navigation";

export const revalidate = 600;
export const dynamicParams = true;

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  redirect(`/products?category=${encodeURIComponent(slug)}&includeChildren=true`);
}
