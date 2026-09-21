import { permanentRedirect } from "next/navigation";

export const revalidate = 600;
export const dynamicParams = true;

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  // Permanent consolidation: /categories/[slug] → canonical listing URL (308),
  // so Google drops the stub URL and consolidates ranking signals.
  permanentRedirect(`/products?category=${encodeURIComponent(slug)}&includeChildren=true`);
}
