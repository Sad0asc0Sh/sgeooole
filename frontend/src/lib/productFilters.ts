export type ProductFilterProperties = Record<string, string | string[]>;

export type ProductFilterFacets = {
  brands: Array<{ id: string; slug: string; name: string; count: number }>;
  properties: Array<{ name: string; values: Array<{ value: string; count: number }> }>;
};

export function parsePriceInput(value: string): number | undefined {
  const normalized = value.trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[,٬\s]/g, "")
    .replace(/٫/g, ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const result = Number(normalized);
  return Number.isFinite(result) && result <= Number.MAX_SAFE_INTEGER ? result : undefined;
}

const SORT_ALIASES: Record<string, string> = {
  bestseller: "bestSelling", bestSellers: "bestSelling", flash: "discount", special: "discount",
  "-createdAt": "newest", price: "priceAsc", "-price": "priceDesc",
};
const SORTS = new Set(["newest", "oldest", "bestSelling", "priceAsc", "priceDesc", "popularity", "mostVisited", "discount", "rating"]);

export function parseProductFilters(params: URLSearchParams) {
  const rawSort = params.get("sort") || "newest";
  const sort = SORT_ALIASES[rawSort] || rawSort;
  const rawPage = Number(params.get("page") || 1);
  const properties: Record<string, string[]> = Object.create(null);
  params.forEach((value, key) => {
    if (!key.startsWith("prop_") || !value.trim()) return;
    const name = key.slice(5).trim();
    if (!name || name.length > 100 || ["__proto__", "constructor", "prototype"].includes(name)) return;
    if (!(name in properties) && Object.keys(properties).length >= 30) return;
    properties[name] = [...new Set([...(properties[name] || []), value.trim().slice(0, 200)])].slice(0, 30);
  });
  const brands = [...new Set(params.getAll("brand").flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean))].sort().slice(0, 30);
  let minPrice = parsePriceInput(params.get("minPrice") || "");
  let maxPrice = parsePriceInput(params.get("maxPrice") || "");
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const minRating = Number(params.get("minRating"));
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1,
    sort: SORTS.has(sort) ? sort : "newest",
    category: params.get("category")?.trim() || undefined,
    brand: brands.join(",") || undefined,
    search: params.get("search")?.trim().slice(0, 200) || undefined,
    minPrice,
    maxPrice,
    includeChildren: params.get("includeChildren") !== "false",
    inStock: params.get("inStock") === "true",
    onSale: params.get("onSale") === "true",
    minRating: minRating > 0 && minRating <= 5 ? minRating : undefined,
    properties,
  };
}

export function appendPropertyFilters(params: URLSearchParams, properties?: ProductFilterProperties, prefix = "properties") {
  if (!properties) return;
  Object.entries(properties).sort(([a], [b]) => a.localeCompare(b)).forEach(([name, raw]) => {
    const values = [...new Set(Array.isArray(raw) ? raw : [raw])].filter(Boolean).sort();
    values.forEach((value) => params.append(prefix === "prop_" ? `prop_${name}` : `${prefix}[${name}]`, value));
  });
}
