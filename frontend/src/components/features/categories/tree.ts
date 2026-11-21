import type { Category, CategoryImage } from "@/services/categoryService";
import { categoryProductHref } from "@/lib/categoryNavigation";

/**
 * Snappshop-shaped node model for the categories UI.
 * Three levels exactly like the original mega menu:
 * root (rail) → group (accordion/column title) → leaf (card/link).
 */
export interface CategoryNode {
  id: string;
  title: string;
  href: string;
  image: string | null;
  children?: CategoryNode[];
}

type CategoryVisual = CategoryImage | string | null | undefined;

// Same base handling as lib/categoryNavigation.categoryImageSources: stored
// paths are relative to the API host.
const base = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/api\/?$/, "").replace(/\/$/, "");

const toAbsolute = (url: string): string =>
  /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url) ? url : `${base}/${url.replace(/^\/+/, "")}`;

const firstUrl = (...visuals: CategoryVisual[]): string | null => {
  for (const visual of visuals) {
    if (typeof visual === "string" && visual.trim()) return toAbsolute(visual);
    if (visual && typeof visual === "object") {
      if (visual.cardUrl?.trim()) return toAbsolute(visual.cardUrl);
      if (visual.url?.trim()) return toAbsolute(visual.url);
    }
  }
  return null;
};

/** Small display source — icon variant first, exactly like the snappshop rail. */
export function categoryIconSource(category: Category): string | null {
  return firstUrl(category.icon, category.image);
}

export function toCategoryNode(category: Category): CategoryNode {
  return {
    id: category._id,
    title: category.name,
    href: categoryProductHref(category),
    image: categoryIconSource(category),
    children: category.children?.length
      ? category.children.map(toCategoryNode)
      : undefined,
  };
}

export function toCategoryTree(categories: Category[]): CategoryNode[] {
  return categories.map(toCategoryNode);
}

/** SWR serves the raw backend model; the server passes ready nodes. Accept both. */
export function normalizeCategoryTree(list: (Category | CategoryNode)[]): CategoryNode[] {
  if (!list.length) return [];
  return "_id" in list[0] ? toCategoryTree(list as Category[]) : (list as CategoryNode[]);
}
