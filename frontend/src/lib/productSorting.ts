export const PRODUCT_SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین" },
  { value: "bestSelling", label: "پرفروش‌ترین" },
  { value: "priceAsc", label: "ارزان‌ترین" },
  { value: "priceDesc", label: "گران‌ترین" },
  { value: "popularity", label: "محبوب‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
] as const;

export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number]["value"];

const aliases: Record<string, ProductSort> = {
  bestseller: "bestSelling",
  bestSellers: "bestSelling",
  flash: "discount",
  special: "discount",
  popularity: "popularity",
  mostVisited: "popularity",
  price: "priceAsc",
  "-price": "priceDesc",
  "-createdAt": "newest",
  createdAt: "newest",
  "-salesCount": "bestSelling",
  "-views": "popularity",
  "-discount": "discount",
};

export function normalizeProductSort(value: string | null | undefined): ProductSort {
  if (!value) return "newest";
  const mapped = aliases[value] || value;
  return PRODUCT_SORT_OPTIONS.some((option) => option.value === mapped)
    ? (mapped as ProductSort)
    : "newest";
}
