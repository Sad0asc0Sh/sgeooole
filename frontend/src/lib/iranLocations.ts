import rawCities from "@/data/iran-cities.json";
import rawProvinces from "@/data/iran-provinces.json";

/**
 * دادهٔ پایهٔ استان و شهر ایران.
 * Source: jd1378/iran-cities-json (MIT), copied into this project for offline use.
 * Canonical names below only improve typography; source identifiers are retained.
 */
export interface IranProvince {
  id: number;
  name: string;
}

export interface IranCity {
  id: number;
  name: string;
  provinceId: number;
}

const provinceNameOverrides: Record<number, string> = {
  9: "چهارمحال و بختیاری",
  16: "سیستان و بلوچستان",
  23: "کهگیلویه و بویراحمد",
};

const locationAliases: Record<string, string> = {
  "چهارمحال وبختیاری": "چهارمحال و بختیاری",
  "سیستان وبلوچستان": "سیستان و بلوچستان",
  "کهگیلویه وبویراحمد": "کهگیلویه و بویراحمد",
};

export const normalizeIranLocationText = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");

const applyCanonicalAlias = (value: string): string =>
  locationAliases[normalizeIranLocationText(value)] ?? value;

export const iranProvinces: IranProvince[] = (rawProvinces as Array<{ id: number; name: string }>)
  .map((province) => ({
    id: province.id,
    name: provinceNameOverrides[province.id] ?? province.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fa"));

export const iranCities: IranCity[] = (rawCities as Array<{ id: number; name: string; ostan: number }>)
  .map((city) => ({
    id: city.id,
    name: city.name,
    provinceId: city.ostan,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fa"));

const provinceById = new Map(iranProvinces.map((province) => [province.id, province]));
const citiesById = new Map(iranCities.map((city) => [city.id, city]));

export const getProvinceById = (id: number | null | undefined): IranProvince | undefined =>
  typeof id === "number" ? provinceById.get(id) : undefined;

export const getProvinceByName = (name: string | null | undefined): IranProvince | undefined => {
  const normalizedName = normalizeIranLocationText(name);
  if (!normalizedName) return undefined;

  return iranProvinces.find(
    (province) => normalizeIranLocationText(province.name) === normalizedName,
  );
};

export const getCitiesForProvince = (provinceId: number | null | undefined): IranCity[] =>
  typeof provinceId === "number"
    ? iranCities.filter((city) => city.provinceId === provinceId)
    : [];

export const getCityById = (id: number | null | undefined): IranCity | undefined =>
  typeof id === "number" ? citiesById.get(id) : undefined;

export const getCityByName = (
  name: string | null | undefined,
  provinceId: number | null | undefined,
): IranCity | undefined => {
  const normalizedName = normalizeIranLocationText(name);
  if (!normalizedName || typeof provinceId !== "number") return undefined;

  return getCitiesForProvince(provinceId).find(
    (city) => normalizeIranLocationText(city.name) === normalizedName,
  );
};

/**
 * Normalizes only known aliases. Unknown legacy values are deliberately left intact.
 * This preserves previously saved addresses and prevents purchases from being blocked.
 */
export const canonicalizeProvinceName = (name: string): string => {
  const aliased = applyCanonicalAlias(name);
  return getProvinceByName(aliased)?.name ?? name.trim();
};

export const provinceOptions = iranProvinces.map((province) => ({
  value: String(province.id),
  label: province.name,
}));

export const cityOptionsForProvince = (provinceId: number | null | undefined) =>
  getCitiesForProvince(provinceId).map((city) => ({
    value: String(city.id),
    label: city.name,
  }));
