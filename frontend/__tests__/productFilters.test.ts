import {
  parsePriceInput,
  parseRangeInput,
  parseProductFilters,
  appendPropertyFilters,
  appendStableAttrAndRangeFilters,
  resolveAttrKeyToLabel,
  resolveLabelToAttrKey,
} from "@/lib/productFilters";
import { normalizeProductSort } from "@/lib/productSorting";

describe("normalizeProductSort", () => {
  it("defaults to newest when undefined or invalid", () => {
    expect(normalizeProductSort(undefined)).toBe("newest");
    expect(normalizeProductSort(null)).toBe("newest");
    expect(normalizeProductSort("banana")).toBe("newest");
  });

  it("normalizes legacy home rail aliases and valid values", () => {
    expect(normalizeProductSort("bestseller")).toBe("popularity");
    expect(normalizeProductSort("popularity")).toBe("popularity");
    expect(normalizeProductSort("mostVisited")).toBe("popularity");
    // «پرفروش‌ترین» دیگر به popularity نگاشت نمی‌شود؛ ترتیب واقعی salesCount
    expect(normalizeProductSort("bestSelling")).toBe("bestSelling");
    expect(normalizeProductSort("-salesCount")).toBe("bestSelling");
    expect(normalizeProductSort("priceAsc")).toBe("priceAsc");
    expect(normalizeProductSort("discount")).toBe("discount");
  });
});

describe("parsePriceInput", () => {
  it("parses Persian and Arabic digits with separators", () => {
    expect(parsePriceInput("۱٬۲۳۴٬۵۶۷")).toBe(1234567);
    expect(parsePriceInput("١٢٣")).toBe(123);
    expect(parsePriceInput("۱٫۵")).toBe(1.5);
    expect(parsePriceInput("1,250,000")).toBe(1250000);
    expect(parsePriceInput(" 500 ")).toBe(500);
  });

  it("returns undefined for invalid input", () => {
    expect(parsePriceInput("")).toBeUndefined();
    expect(parsePriceInput("abc")).toBeUndefined();
    expect(parsePriceInput("-5")).toBeUndefined();
    expect(parsePriceInput("۱۲x")).toBeUndefined();
  });
});

describe("parseProductFilters", () => {
  it("normalizes sort aliases and defaults", () => {
    expect(parseProductFilters(new URLSearchParams("sort=bestseller")).sort).toBe("popularity");
    expect(parseProductFilters(new URLSearchParams("sort=flash")).sort).toBe("discount");
    expect(parseProductFilters(new URLSearchParams("sort=banana")).sort).toBe("newest");
    expect(parseProductFilters(new URLSearchParams()).sort).toBe("newest");
  });

  it("collects repeated prop_ keys into arrays with OR semantics", () => {
    const filters = parseProductFilters(new URLSearchParams("prop_رنگ=آبی&prop_رنگ=قرمز&prop_گارانتی=۱۸ماه"));
    expect(filters.properties["رنگ"]).toEqual(["آبی", "قرمز"]);
    expect(filters.properties["گارانتی"]).toEqual(["۱۸ماه"]);
  });

  it("deduplicates multi-brand values", () => {
    const filters = parseProductFilters(new URLSearchParams("brand=apple,samsung&brand=apple"));
    expect(filters.brand).toBe("apple,samsung");
  });

  it("swaps reversed price bounds and drops invalid ones", () => {
    const swapped = parseProductFilters(new URLSearchParams("minPrice=500&maxPrice=100"));
    expect(swapped.minPrice).toBe(100);
    expect(swapped.maxPrice).toBe(500);

    const invalid = parseProductFilters(new URLSearchParams("minPrice=abc&maxPrice=300"));
    expect(invalid.minPrice).toBeUndefined();
    expect(invalid.maxPrice).toBe(300);
  });

  it("clamps page and validates rating", () => {
    expect(parseProductFilters(new URLSearchParams("page=0")).page).toBe(1);
    expect(parseProductFilters(new URLSearchParams("page=999999")).page).toBe(100000);
    expect(parseProductFilters(new URLSearchParams("minRating=7")).minRating).toBeUndefined();
    expect(parseProductFilters(new URLSearchParams("minRating=4")).minRating).toBe(4);
  });

  it("ignores prototype-polluting property names", () => {
    const filters = parseProductFilters(new URLSearchParams("prop___proto__=x&prop_رنگ=آبی"));
    expect(filters.properties["__proto__"]).toBeUndefined();
    expect(filters.properties["رنگ"]).toEqual(["آبی"]);
  });

  it("treats missing includeChildren as true", () => {
    expect(parseProductFilters(new URLSearchParams()).includeChildren).toBe(true);
    expect(parseProductFilters(new URLSearchParams("includeChildren=false")).includeChildren).toBe(false);
  });
});

describe("appendPropertyFilters", () => {
  it("appends repeated values per property name", () => {
    const params = new URLSearchParams("page=2");
    appendPropertyFilters(params, { رنگ: ["قرمز", "آبی"], گارانتی: "۱۸ ماهه" });
    expect(params.getAll("properties[رنگ]")).toEqual(["آبی", "قرمز"]);
    expect(params.getAll("properties[گارانتی]")).toEqual(["۱۸ ماهه"]);
    expect(params.get("page")).toBe("2");
  });

  it("supports prop_ prefix for cache keys", () => {
    const params = new URLSearchParams();
    appendPropertyFilters(params, { رنگ: ["آبی", "قرمز"] }, "prop_");
    expect(params.getAll("prop_رنگ")).toEqual(["آبی", "قرمز"]);
  });

  it("skips empty values", () => {
    const params = new URLSearchParams();
    appendPropertyFilters(params, { رنگ: ["", "آبی"], خالی: [] });
    expect(params.getAll("properties[رنگ]")).toEqual(["آبی"]);
    expect(params.has("properties[خالی]")).toBe(false);
  });

  it("parses and serializes stable f.<key> and r.<key> parameters alongside legacy prop_ filters", () => {
    const query = new URLSearchParams(
      "category=ip-camera&f.brand=dahua,hikvision&f.resolution_mp=4,8&r.ir_range_m=۳۰-۶۰&prop_رنگ=سفید"
    );
    const parsed = parseProductFilters(query);
    expect(parsed.brand).toBe("dahua,hikvision");
    expect(parsed.attrFilters["resolution_mp"]).toEqual(["4", "8"]);
    expect(parsed.ranges["ir_range_m"]).toEqual({ min: 30, max: 60 });
    expect(parsed.properties["رنگ"]).toEqual(["سفید"]);

    const out = new URLSearchParams();
    appendStableAttrAndRangeFilters(out, parsed.attrFilters, parsed.ranges);
    expect(out.get("f.resolution_mp")).toBe("4,8");
    expect(out.get("r.ir_range_m")).toBe("30-60");

    expect(parseRangeInput("60-20")).toEqual({ min: 20, max: 60 });
    expect(resolveAttrKeyToLabel("resolution_mp")).toBe("رزولوشن تصویر");
    expect(resolveLabelToAttrKey("رزولوشن تصویر")).toBe("resolution_mp");
  });
});
