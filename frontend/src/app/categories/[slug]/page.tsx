import { redirect } from "next/navigation";
import { categoryService } from "@/services/categoryService";

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const categories = await categoryService.getAll({ limit: 1000 });
    return categories.map((cat) => ({ slug: cat.slug || cat._id }));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[categories] failed to build params", error);
    } else {
      console.warn("[categories] failed to build params");
    }
    return [];
  }
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  redirect(`/products?category=${encodeURIComponent(slug)}&includeChildren=true`);
}
