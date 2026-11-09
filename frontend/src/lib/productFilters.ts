import { normalizeProductSort } from "@/lib/productSorting";

export type ProductFilterProperties = Record<string, string | string[]>;
export type ProductFilterAttrValues = Record<string, string | string[]>;
export type ProductFilterRange = { min?: number; max?: number };
export type ProductFilterRanges = Record<string, ProductFilterRange>;

export type ProductFilterFacetValue = {
  value: string;
  count: number;
  isSelected?: boolean;
};

export type ProductFilterFacetProperty = {
  name: string;
  key?: string;
  unit?: string;
  /** از قواعد دسته‌بندی آمده است (ترتیب نمایش پایدار) */
  isConfigured?: boolean;
  /** در دسته‌بندی پین شده است (فیلتر سریع) */
  isPinned?: boolean;
  /** امتیاز مفید بودن ویژگی در نتایج فعلی (آنتروپی/پوشش) از `rankAndFormatPropertyFacets` */
  utilityScore?: number;
  defaultOpen?: boolean;
  values: ProductFilterFacetValue[];
};

export type ProductFilterFacetCategory = {
  id?: string;
  slug: string;
  name: string;
  count: number;
  parent?: string | null;
};

export type ProductFilterFacets = {
  brands: Array<{ id: string; slug: string; name: string; count: number }>;
  properties: ProductFilterFacetProperty[];
  categories?: ProductFilterFacetCategory[];
};

const ATTR_KEY_TO_PERSIAN_LABEL: Record<string, string> = {
  product_type: "نوع کاربری",
  brand: "برند سازنده",
  resolution_mp: "رزولوشن تصویر",
  camera_tech: "تکنولوژی دوربین",
  form: "فرم بدنه دوربین",
  lens_type: "نوع لنز",
  lens_mm: "فاصله کانونی لنز",
  ir_range_m: "برد دید در شب",
  color_night: "نوع دید در شب",
  optical_zoom: "بزرگنمایی اپتیکال",
  ip_rating: "استاندارد حفاظتی",
  poe: "پشتیبانی از PoE",
  mic: "میکروفون داخلی",
  two_way_audio: "مکالمه دوطرفه",
  sd_slot: "پشتیبانی از کارت حافظه",
  codec: "فشرده‌سازی تصویر",
  wdr: "فناوری WDR",
  channels: "تعداد کانال",
  hdd_bays: "تعداد درگاه هارد",
  smart_features: "قابلیت‌های هوش مصنوعی",
  screen_inch: "اندازه صفحه نمایش",
  keypad_type: "نوع صفحه‌کلید",
  vdp_memory: "حافظه داخلی",
  intercom: "ارتباط داخلی",
  second_panel: "قابلیت اتصال به دو پنل",
  parking_opener: "قابلیت باز کردن درب پارکینگ",
  elevator_recall: "فراخوان آسانسور",
  unit_capacity: "تعداد واحد پشتیبانی",
  wiring_type: "نوع سیم‌کشی",
  zones: "تعداد زون",
  dialer_type: "نوع تلفن‌کننده",
  frequency_mhz: "فرکانس کاری",
  code_type: "نوع کدینگ",
  leaf_width_m: "حداکثر عرض هر لنگه",
  leaf_weight_kg: "حداکثر وزن هر لنگه",
  jack_mechanism: "نوع عملکرد جک",
  motor_voltage: "ولتاژ موتور",
  traffic_duty: "میزان تردد مجاز",
  boom_length_m: "طول بوم راهبند",
  lock_type: "نوع قفل برقی",
  identification_type: "روش شناسایی",
  user_capacity: "ظرفیت کاربران",
  log_capacity: "ظرفیت ثبت تردد",
  door_weight_kg: "مناسب وزن درب",
  power: "منبع تغذیه",
  power_watts: "توان مصرفی",
  ups_support: "قابلیت برق اضطراری",
  connectivity: "پروتکل و درگاه ارتباطی",
  body_material: "جنس بدنه",
  installation_type: "نوع نصب",
  color: "رنگ",
  warranty_months: "مدت گارانتی",
  country_of_origin: "کشور سازنده",
};

const PERSIAN_LABEL_TO_ATTR_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(ATTR_KEY_TO_PERSIAN_LABEL).map(([key, label]) => [label, key])
);

export function resolveAttrKeyToLabel(key: string): string | undefined {
  const normalized = key.trim().toLowerCase().replace(/-/g, "_");
  return ATTR_KEY_TO_PERSIAN_LABEL[normalized];
}

export function resolveLabelToAttrKey(label: string): string | undefined {
  return PERSIAN_LABEL_TO_ATTR_KEY[label.trim()];
}

function normalizeAsciiNumericText(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[,٬\s]/g, "")
    .replace(/٫/g, ".");
}

export function parsePriceInput(value: string): number | undefined {
  const normalized = normalizeAsciiNumericText(value);
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const result = Number(normalized);
  return Number.isFinite(result) && result <= Number.MAX_SAFE_INTEGER ? result : undefined;
}

export function parseRangeInput(value: string): ProductFilterRange | undefined {
  const normalized = normalizeAsciiNumericText(value);
  if (!normalized) return undefined;
  const match = normalized.match(/^(\d+(?:\.\d+)?)?(?:\.\.|-|:|~)(\d+(?:\.\d+)?)?$/);
  let min: number | undefined;
  let max: number | undefined;
  if (match) {
    if (match[1] === undefined && match[2] === undefined) return undefined;
    min = match[1] !== undefined ? Number(match[1]) : undefined;
    max = match[2] !== undefined ? Number(match[2]) : undefined;
  } else if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    min = Number(normalized);
    max = min;
  } else {
    return undefined;
  }
  if (min !== undefined && (!Number.isFinite(min) || min < 0 || min > Number.MAX_SAFE_INTEGER)) return undefined;
  if (max !== undefined && (!Number.isFinite(max) || max < 0 || max > Number.MAX_SAFE_INTEGER)) return undefined;
  if (min !== undefined && max !== undefined && min > max) {
    [min, max] = [max, min];
  }
  return { min, max };
}

const VALID_ASCII_ATTR_KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function parseProductFilters(params: URLSearchParams) {
  const rawPage = Number(params.get("page") || 1);
  const properties: Record<string, string[]> = Object.create(null);
  const attrFilters: Record<string, string[]> = Object.create(null);
  const ranges: ProductFilterRanges = Object.create(null);
  const extraBrands: string[] = [];
  let priceFromRange: ProductFilterRange | undefined;

  const addPropEntry = (rawName: string, rawVal: string) => {
    const name = rawName.trim();
    const val = rawVal.trim();
    if (!name || !val || name.length > 100 || FORBIDDEN_KEYS.has(name)) return;
    if (!(name in properties) && Object.keys(properties).length >= 30) return;
    properties[name] = [...new Set([...(properties[name] || []), val.slice(0, 200)])].slice(0, 30);
  };

  params.forEach((value, key) => {
    if (!value.trim()) return;

    // ۱) سازگاری برگشتی با prop_<نام فارسی> و properties[<نام فارسی>]
    if (key.startsWith("prop_")) {
      addPropEntry(key.slice(5), value);
      return;
    }
    const bracketMatch = key.match(/^properties\[([^\[\]]+)\](?:\[\])?$/);
    if (bracketMatch) {
      addPropEntry(bracketMatch[1], value);
      return;
    }

    // ۲) کلیدهای پایدار f.<key> (تک‌مقداری یا چندمقداری با ویرگول)
    if (key.startsWith("f.")) {
      const attrKey = key.slice(2).trim();
      if (!VALID_ASCII_ATTR_KEY.test(attrKey) || FORBIDDEN_KEYS.has(attrKey)) return;
      const lowerKey = attrKey.toLowerCase().replace(/-/g, "_");
      const tokens = value
        .split(",")
        .map((item) => item.trim().slice(0, 200))
        .filter(Boolean);
      if (!tokens.length) return;
      if (lowerKey === "brand" || lowerKey === "manufacturer_brand") {
        extraBrands.push(...tokens);
        return;
      }
      if (!(lowerKey in attrFilters) && Object.keys(attrFilters).length >= 30) return;
      attrFilters[lowerKey] = [...new Set([...(attrFilters[lowerKey] || []), ...tokens])].slice(0, 30);
      return;
    }

    // ۳) کلیدهای بازه‌ی عددی r.<key> (مثل r.ir_range_m=30-60)
    if (key.startsWith("r.")) {
      const attrKey = key.slice(2).trim();
      if (!VALID_ASCII_ATTR_KEY.test(attrKey) || FORBIDDEN_KEYS.has(attrKey)) return;
      const parsedRange = parseRangeInput(value);
      if (!parsedRange) return;
      const lowerKey = attrKey.toLowerCase().replace(/-/g, "_");
      if (lowerKey === "price") {
        priceFromRange = parsedRange;
        return;
      }
      if (!(lowerKey in ranges) && Object.keys(ranges).length >= 15) return;
      ranges[lowerKey] = parsedRange;
    }
  });

  const brands = [
    ...new Set(
      [...params.getAll("brand").flatMap((value) => value.split(",")), ...extraBrands]
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]
    .sort()
    .slice(0, 30);

  let minPrice = parsePriceInput(params.get("minPrice") || "") ?? priceFromRange?.min;
  let maxPrice = parsePriceInput(params.get("maxPrice") || "") ?? priceFromRange?.max;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const minRating = Number(params.get("minRating"));
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1,
    sort: normalizeProductSort(params.get("sort")),
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
    attrFilters,
    ranges,
  };
}

export function appendPropertyFilters(params: URLSearchParams, properties?: ProductFilterProperties, prefix = "properties") {
  if (!properties) return;
  Object.entries(properties).sort(([a], [b]) => a.localeCompare(b)).forEach(([name, raw]) => {
    const values = [...new Set(Array.isArray(raw) ? raw : [raw])].filter(Boolean).sort();
    if (!values.length) return;
    if (prefix === "f.") {
      params.set(`f.${name}`, values.join(","));
      return;
    }
    values.forEach((value) => params.append(prefix === "prop_" ? `prop_${name}` : `${prefix}[${name}]`, value));
  });
}

export function appendStableAttrAndRangeFilters(
  params: URLSearchParams,
  attrFilters?: ProductFilterAttrValues,
  ranges?: ProductFilterRanges
) {
  if (attrFilters) {
    Object.entries(attrFilters)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([attrKey, raw]) => {
        if (!VALID_ASCII_ATTR_KEY.test(attrKey) || FORBIDDEN_KEYS.has(attrKey)) return;
        const values = [...new Set(Array.isArray(raw) ? raw : [raw])].map((v) => v.trim()).filter(Boolean).sort();
        if (values.length) params.set(`f.${attrKey}`, values.join(","));
      });
  }
  if (ranges) {
    Object.entries(ranges)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([attrKey, range]) => {
        if (!VALID_ASCII_ATTR_KEY.test(attrKey) || FORBIDDEN_KEYS.has(attrKey) || !range) return;
        const { min, max } = range;
        if (min === undefined && max === undefined) return;
        const serialized = min !== undefined && max !== undefined
          ? `${min}-${max}`
          : min !== undefined
            ? `${min}-`
            : `-${max}`;
        params.set(`r.${attrKey}`, serialized);
      });
  }
}
