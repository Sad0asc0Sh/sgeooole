export const PRODUCT_SORT_OPTIONS = [
  { value: "relevance", label: "مرتبط‌ترین", description: "تطابق کد محصول، نام کامل و سپس ابتدای نام", searchOnly: true },
  { value: "newest", label: "جدیدترین", description: "جدیدترین زمان ثبت محصول" },
  { value: "oldest", label: "قدیمی‌ترین", description: "قدیمی‌ترین زمان ثبت محصول" },
  { value: "bestSelling", label: "پرفروش‌ترین", description: "بیشترین تعداد فروش ثبت‌شده" },
  { value: "priceAsc", label: "ارزان‌ترین", description: "قیمت نهایی پس از تخفیف، از کم به زیاد" },
  { value: "priceDesc", label: "گران‌ترین", description: "قیمت نهایی پس از تخفیف، از زیاد به کم" },
  { value: "mostVisited", label: "پربازدیدترین", description: "بیشترین تعداد بازدید ثبت‌شده" },
  { value: "discount", label: "بیشترین تخفیف", description: "بیشترین درصد کاهش واقعی نسبت به قیمت قبلی" },
  { value: "rating", label: "بالاترین امتیاز", description: "امتیاز بالاتر؛ در امتیاز برابر، تعداد نظر بیشتر" },
  { value: "nameAsc", label: "نام: الف تا ی", description: "ترتیب نام فارسی و ترتیب طبیعی اعداد" },
  { value: "nameDesc", label: "نام: ی تا الف", description: "ترتیب معکوس نام فارسی و اعداد" },
] as const;

export type ProductSort = typeof PRODUCT_SORT_OPTIONS[number]["value"];
const aliases: Record<string, ProductSort> = {
  bestseller: "bestSelling", bestSellers: "bestSelling", flash: "discount", special: "discount",
  popularity: "mostVisited", "-createdAt": "newest", createdAt: "oldest",
  price: "priceAsc", "-price": "priceDesc", "-salesCount": "bestSelling", "-views": "mostVisited",
  "-discount": "discount", "-rating": "rating", name: "nameAsc", "-name": "nameDesc",
};

export function normalizeProductSort(value: string | null | undefined, hasSearch = false): ProductSort {
  const fallback = hasSearch ? "relevance" : "newest";
  if (!value) return fallback;
  const normalized = Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] : value;
  if (normalized === "relevance" && !hasSearch) return "newest";
  return PRODUCT_SORT_OPTIONS.some((option) => option.value === normalized) ? normalized as ProductSort : fallback;
}

export function getProductSortOptions(hasSearch: boolean) {
  return PRODUCT_SORT_OPTIONS.filter((option) => option.value !== "relevance" || hasSearch);
}
