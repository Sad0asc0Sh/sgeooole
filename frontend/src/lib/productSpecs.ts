/**
 * ساخت آرایه‌ی «مشخصات فنی» برای تب PDP از داده‌ی خام بک‌اند.
 *
 * بک‌اند دو لایه دارد:
 *  - `specifications`: جدول کامل (متن کامل هر ردیف) — منبع اصلی نمایش
 *  - `properties`: فست‌های کوتاه سایدبار — مکمل
 *
 * ترتیب ادغام: specifications → specs (سازگاری با داده‌ی قدیمی) → properties → guarantee
 * و هر کلید فقط یک‌بار (بر اساس شکل نرمال‌شده‌ی برچسب) اضافه می‌شود.
 */

export type ProductSpecRow = { label: string; value: string };

export type BackendSpecRow = {
  key?: string;
  label?: string;
  name?: string;
  value?: unknown;
};

export type BackendSpecifications = Record<string, unknown> | BackendSpecRow[];

const normalizeLabelKey = (value: unknown) =>
  String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

// برچسب‌هایی که همان «گارانتی» محسوب می‌شوند (تا با فیلد اختصاصی تکرار نشود)
const GUARANTEE_ALIAS_KEYS = ["گارانتی", "مدت گارانتی", "ضمانت", "مدت ضمانت"].map(normalizeLabelKey);

export function buildProductSpecs(input: {
  specifications?: BackendSpecifications;
  specs?: ProductSpecRow[] | undefined;
  properties?: Array<{ label?: string; value?: unknown }> | undefined;
  guarantee?: string | undefined;
}): ProductSpecRow[] {
  const result: ProductSpecRow[] = [];
  const seen = new Set<string>();

  const push = (label: unknown, value: unknown) => {
    const key = normalizeLabelKey(label);
    if (!key) return;
    if (value === null || value === undefined) return;
    if (typeof value === "object") return;
    const text = String(value).trim();
    if (!text || seen.has(key)) return;
    seen.add(key);
    result.push({ label: String(label).trim(), value: text });
  };

  const specifications = input.specifications;
  if (Array.isArray(specifications)) {
    for (const row of specifications) {
      if (!row || typeof row !== "object") continue;
      push(row.label ?? row.name ?? row.key, row.value);
    }
  } else if (specifications && typeof specifications === "object") {
    for (const [label, value] of Object.entries(specifications)) push(label, value);
  }

  for (const row of input.specs ?? []) push(row?.label, row?.value);
  for (const row of input.properties ?? []) push(row?.label, row?.value);
  if (input.guarantee && !GUARANTEE_ALIAS_KEYS.some((key) => seen.has(key))) {
    push("گارانتی", input.guarantee);
  }

  return result;
}
