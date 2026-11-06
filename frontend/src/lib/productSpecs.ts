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

// جدول مترادف‌های برچسب (آینه‌ی BUILTIN_KEY_SYNONYMS در بک‌اند).
// بدون این جدول، «فرکانس ریموت» در specifications و «فرکانس کاری» در properties
// دو ردیف جدا می‌شوند و تب مشخصات به‌جای ۹ ردیف، ۱۳ ردیف نشان می‌دهد.
const SYNONYM_GROUPS: Array<[string, string[]]> = [
  ["نوع محصول", ["نوع کالا", "مدل دستگاه", "نوع تجهیز", "نوع سیستم", "product type"]],
  ["نوع کاربری", ["نوع دستگاه", "نوع محصول", "کاربری", "محیط کاربری", "مناسب برای محیط", "کاربرد"]],
  ["تعداد زون", ["زون ها", "زون‌ها", "تعداد زون باسیم", "تعداد زون باسیم و بیسیم", "ظرفیت زون", "تعداد زون با سیم"]],
  ["پشتیبانی از سیم‌کارت", ["سیم کارت", "سیم‌کارت", "ماژول سیم کارت", "ماژول سیم‌کارت", "تلفن کننده سیم کارتی"]],
  ["فرکانس کاری", ["فرکانس ریموت", "فرکانس گیرنده", "بازه فرکانسی", "فرکانس کاری ریموت", "فرکانس"]],
  ["نوع کددهی", ["نوع کد ریموت", "نوع کدینگ", "فناوری کد", "نحوه کددهی", "نوع کد", "روش کددهی ریموت"]],
  ["تعداد رله", ["تعداد رله خروجی", "رله خروجی", "تعداد خروجی رله", "کانال رله"]],
  ["تعداد کلید", ["تعداد دکمه", "تعداد کلید", "تعداد دکمه کلید", "تعداد دکمه‌ها", "تعداد پل"]],
  ["ظرفیت حافظه رسیور", ["ظرفیت ریموت", "حافظه رسیور", "تعداد ریموت قابل تعریف", "حافظه ثبت ریموت"]],
  ["نحوه کنترل", ["کنترل از راه دور", "روش کنترل", "مدیریت دستگاه"]],
  ["تعداد کانال", ["تعداد کانال ورودی تصویر", "تعداد کانال تصویر", "کانال ها", "کانال‌ها", "تعداد کانال‌ها"]],
  ["رزولوشن تصویر", ["وضوح تصویر", "کیفیت تصویر", "رزولوشن", "resolution", "دقت تصویر"]],
  ["حداکثر رزولوشن ضبط", ["حداکثر رزولوشن پشتیبانی", "رزولوشن ضبط", "کیفیت ضبط", "حداکثر کیفیت ضبط"]],
  ["تکنولوژی تصویر", ["تکنولوژی دوربین", "فناوری تصویر", "نوع تکنولوژی", "سیستم تصویربرداری"]],
  ["نوع بدنه دوربین", ["فرم بدنه", "نوع کیس", "کیس دوربین", "تیپ بدنه"]],
  ["نوع دید در شب", ["دید در شب", "night vision", "فناوری دید در شب", "قابلیت دید در شب"]],
  ["برد دید در شب", ["مسافت دید در شب", "شعاع دید در شب", "برد مادون قرمز", "برد ir"]],
  ["سایز لنز", ["لنز", "نوع لنز", "فاصله کانونی"]],
  ["میکروفون داخلی", ["میکروفن", "میکروفون", "میکروفن داخلی", "میکروفون داخلی", "ضبط صدا"]],
  ["سایز صفحه نمایش", ["اندازه صفحه نمایش", "سایز نمایشگر", "قطر صفحه نمایش", "صفحه نمایش"]],
  ["نوع صفحه نمایش", ["تکنولوژی صفحه نمایش", "نوع نمایشگر", "نوع کلیدهای مانیتور"]],
  ["حافظه داخلی", ["حافظه آیفون", "پشتیبانی از کارت حافظه", "درگاه کارت حافظه", "حافظه ضبط"]],
  ["تعداد واحد پشتیبانی‌شده", ["انتخاب تعداد واحد", "تعداد واحد", "تعداد واحد ساختمان", "حداکثر اتصال واحد تا", "ظرفیت واحد"]],
  ["حداکثر عرض هر لنگه", ["عرض هر لنگه درب", "عرض لنگه درب", "حداکثر عرض درب"]],
  ["ظرفیت هر لنگه", ["حداکثر وزن هر لنگه", "تحمل وزن هر لنگه", "قدرت جابجایی هر لنگه", "وزن هر لنگه", "قدرت هر جک"]],
  ["قدرت لیفت موتور", ["قدرت لیفت", "قدرت لیفت ظرفیت", "قدرت موتور"]],
  ["میزان تردد", ["تردد در ساعت", "ظرفیت تردد", "تعداد تردد مجاز"]],
  ["نحوه شناسایی", ["نوع شناسایی", "روش دسترسی", "نحوه بازگشایی", "مدل دسترسی"]],
  ["پشتیبانی از برق اضطراری", ["قابلیت برق اضطراری", "پشتیبانی از باتری بکاپ", "اتصال به ups", "برق اضطراری"]],
  ["نوع اتصال", ["نوع ارتباط", "اتصال", "رابط ارتباطی", "نحوه اتصال"]],
  ["ولتاژ تغذیه", ["ولتاژ کاری", "ولتاژ ورودی", "منبع تغذیه", "تغذیه", "ولتاژ خروجی"]],
  ["جریان مصرفی", ["جریان خروجی", "شدت جریان", "آمپر خروجی", "جریان", "آمپراژ"]],
  ["استاندارد حفاظتی", ["درجه حفاظت", "درجه حفاظت ip", "کلاس حفاظتی", "استاندارد حفاظت محیطی", "درجه حفاظتی"]],
  ["برد عملکرد", ["برد ریموت", "برد ریموت کنترل", "برد عملیاتی", "برد", "برد مفید"]],
  ["گارانتی", ["مدت گارانتی", "ضمانت", "مدت ضمانت"]],
];

// یکسان‌سازی حروف عربی/فارسی + حذف نیم‌فاصله و فاصله، برای «مقایسه»
const rawCompareKey = (value: unknown) =>
  String(value ?? "")
    .replace(/[يئ]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[آأإ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\u200c\s]+/g, "")
    .trim()
    .toLowerCase();

const SYNONYM_MAP = (() => {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of SYNONYM_GROUPS) {
    const target = rawCompareKey(canonical);
    map.set(target, target);
    for (const alias of aliases) map.set(rawCompareKey(alias), target);
  }
  return map;
})();

const normalizeLabelKey = (value: unknown) => {
  const key = rawCompareKey(value);
  return SYNONYM_MAP.get(key) ?? key;
};

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
