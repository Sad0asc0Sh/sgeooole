import type { Metadata } from "next";
import CategoriesBrowser from "@/components/features/categories/CategoriesBrowser";
import { toCategoryTree } from "@/components/features/categories/tree";
import { categoryService } from "@/services/categoryService";

export const metadata: Metadata = {
  title: "دسته‌بندی محصولات",
  description:
    "مرور همه دسته‌بندی‌های فروشگاه: موبایل، دیجیتال، زیبایی و سلامت، خانه و آشپزخانه، مد و پوشاک و ده‌ها زیرشاخه دیگر با دسترسی سریع به محصولات هر دسته.",
  alternates: { canonical: "/categories" },
};

// Same TTL as the category listing pages; the tree changes rarely.
export const revalidate = 600;

export default async function CategoriesPage() {
  let initialTree: ReturnType<typeof toCategoryTree> = [];
  let initialError = false;
  try {
    initialTree = toCategoryTree(await categoryService.getTree());
  } catch {
    // Backend unreachable (e.g. during a cold build) — the client SWR hook retries.
    initialError = true;
  }

  return <CategoriesBrowser initialTree={initialTree} initialError={initialError} />;
}
