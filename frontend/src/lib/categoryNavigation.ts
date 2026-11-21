import type { Category, CategoryImage } from "@/services/categoryService";

export const CATEGORY_FILTER_HASH = "#category-filters";
export const CATEGORY_FILTER_HREF = `/products${CATEGORY_FILTER_HASH}`;

export function categoryProductHref(category: Pick<Category, "slug" | "_id">) {
  return `/products?category=${encodeURIComponent(category.slug || category._id)}&includeChildren=true`;
}

type CategoryVisual = CategoryImage | string | null;

export function categoryImageSources(category: { image?: CategoryVisual; icon?: CategoryVisual }) {
  const base = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/api\/?$/, "").replace(/\/$/, "");
  const sources = new Set<string>();
  for (const media of [category.image, category.icon]) {
    const variants = typeof media === "string" ? [media] : [media?.cardUrl, media?.url];
    for (const variant of variants) {
      const url = typeof variant === "string" ? variant.trim() : "";
      if (!url) continue;
      const external = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url);
      sources.add(external ? url : `${base}/${url.replace(/^\/+/, "")}`);
    }
  }
  return Array.from(sources);
}
