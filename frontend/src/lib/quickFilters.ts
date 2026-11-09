/**
 * فیلترهای سریع بالای لیست محصولات (Quick Filter Pills)
 *
 * چرا این ماژول جدا از کامپوننت است: منطق انتخاب چیپ‌ها باید بدون React تست
 * شود. نسخه‌ی قبلی (Phase 4.2) داخل `ProductsPageClient` بود و چهار ضعف داشت:
 *
 *  ۱) فقط «مقدار» را نشان می‌داد؛ نام ویژگی فقط در `aria-label` بود. مقدارهایی
 *     مثل «ندارد» یا «دارد» بدون نام ویژگی بی‌معنا هستند.
 *  ۲) ویژگی را با «مجموع شمارش‌ها» رتبه می‌داد و دو مقدار پرتکرارش را بی‌قیدوشرط
 *     برمی‌داشت؛ پس مقدار منفی/عمومی، مقداری که همه‌ی نتایج دارند، و دو املای
 *     یک واقعیت («پلاستیک» + «پلاستیک فشرده (ABS)») هم چیپ می‌شدند.
 *  ۳) `utilityScore` ای که بک‌اند برای سایدبار حساب می‌کند را نادیده می‌گرفت.
 *  ۴) برای ویژگی‌های هویتی («نوع کاربری») پیشوند طولانی و زاید اضافه می‌کرد و
 *     مقادیر منفی ترکیبی هم‌نام با ویژگی («بدون ریموت» زیر «ریموت») را حذف نمی‌کرد.
 *
 * قواعد این نسخه‌ی نهایی:
 *  - هر چیپ «نام ویژگی: مقدار» است، مگر اینکه خودِ مقدار نام ویژگی را داشته باشد
 *    یا ویژگی از نوع هویتی («نوع کاربری» / «نوع محصول») باشد که مقدارش ذاتاً گویاست.
 *  - مقدار منفیِ ساده («ندارد»، «خیر»، …) یا منفی هم‌نام با ویژگی («بدون ریموت»
 *    برای ویژگی «ریموت») چیپ نمی‌شود (در سایدبار هست)، مگر کاربر خودش آن را انتخاب کرده باشد.
 *    عبارت‌های مثبت مثل «بدون سیم» (= بی‌سیم) برای «نوع اتصال» حفظ می‌شوند.
 *  - مقداری که همه‌ی نتایج دارند (count ≥ total) فیلتر نیست و چیپ نمی‌شود.
 *  - دو مقدارِ هم‌شمارش که یکی زیرمجموعه‌ی کلمات دیگری است یک واقعیت‌اند؛ فقط
 *    کوتاه‌ترشان می‌ماند.
 *  - ویژگی‌ها: انتخاب‌شده‌ها ← پین‌شده‌ها ← هویتی («نوع کاربری») ← `utilityScore` (بک‌اند) ← پوشش.
 */

export interface QuickFilterSourceValue {
  value: string;
  count?: number;
  isSelected?: boolean;
}

export interface QuickFilterSourceProperty {
  name: string;
  isPinned?: boolean;
  /** امتیاز آنتروپی/پوشش از بک‌اند (`rankAndFormatPropertyFacets`) */
  utilityScore?: number;
  values: QuickFilterSourceValue[];
}

export interface QuickFilterPill {
  property: string;
  value: string;
  /** نام ویژگی برای نمایش پیش از مقدار؛ `null` یعنی خود مقدار گویاست */
  prefix: string | null;
  /** «ویژگی: مقدار» یا فقط مقدار (برای تست و متن جایگزین) */
  label: string;
  count: number;
  selected: boolean;
}

export interface QuickFilterOptions {
  /** تعداد کل محصولات نتیجه (برای حذف چیپ‌های بی‌اثر) */
  total?: number;
  maxProperties?: number;
  perProperty?: number;
  maxPills?: number;
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** مقدارهایی که تنها یک «نه» هستند و بدون نام ویژگی هیچ معنایی ندارند */
const BARE_NEGATIVES = new Set([
  "ندارد",
  "ندارند",
  "خیر",
  "نه",
  "فاقد",
  "هیچ",
  "نامشخص",
  "غیرفعال",
  "غیر فعال",
  "none",
  "no",
  "false",
  "na",
]);

/** ویژگی‌های هویتی که مقادیرشان ذاتاً خودتوضیح است و نیاز به تکرار نام ویژگی ندارند */
const SELF_DESCRIPTIVE_PROPERTIES = new Set([
  "نوع کاربری",
  "نوع محصول",
  "کاربری",
  "نوع دستگاه",
]);

/** کلید مقایسه: ارقام و حروف یکسان، بدون نیم‌فاصله، پرانتز و نشانه‌گذاری */
export function quickFilterKey(input: string): string {
  return String(input ?? "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** «ندارد»، «خیر»، … یا مقدارِ تهی/فقط نشانه‌گذاری (مثل «-») یا «بدون <نام ویژگی>» */
export function isBareNegativeValue(value: string, propertyName?: string): boolean {
  const key = quickFilterKey(value);
  if (key === "" || BARE_NEGATIVES.has(key)) return true;
  if (propertyName) {
    const propKey = quickFilterKey(propertyName);
    if (propKey && (key === `بدون ${propKey}` || key === `فاقد ${propKey}`)) {
      return true;
    }
  }
  return false;
}

export function isSelfDescriptiveProperty(propertyName: string): boolean {
  return SELF_DESCRIPTIVE_PROPERTIES.has(quickFilterKey(propertyName));
}

function tokens(value: string): string[] {
  return quickFilterKey(value).split(" ").filter(Boolean);
}

function isSubset(small: string[], large: string[]): boolean {
  if (!small.length) return false;
  const pool = new Set(large);
  return small.every((token) => pool.has(token));
}

/** دو مقدارِ یک ویژگی که کلمات یکی زیرمجموعه‌ی کلمات دیگری است */
function sharesAllWords(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  return isSubset(ta, tb) || isSubset(tb, ta);
}

/** آیا خودِ مقدار نام ویژگی را دارد؟ («ریموت» در «یک ریموت») */
function valueMentionsProperty(value: string, property: string): boolean {
  const propertyKey = quickFilterKey(property);
  if (!propertyKey) return false;
  return ` ${quickFilterKey(value)} `.includes(` ${propertyKey} `);
}

function liveCount(item: QuickFilterSourceValue): number {
  return Number.isFinite(item.count) ? Number(item.count) : 0;
}

function coverageOf(property: QuickFilterSourceProperty, total: number): number {
  const sum = property.values.reduce((acc, item) => acc + liveCount(item), 0);
  return total > 0 ? Math.min(1, sum / total) : sum;
}

function scoreOf(property: QuickFilterSourceProperty, total: number): number {
  return Number.isFinite(property.utilityScore) ? Number(property.utilityScore) : coverageOf(property, total);
}

/** مقدارهای قابل‌نمایش یک ویژگی به ترتیب اولویت */
function pickValues(
  property: QuickFilterSourceProperty,
  selectedValues: readonly string[],
  total: number,
  perProperty: number,
): QuickFilterSourceValue[] {
  const isChosen = (item: QuickFilterSourceValue) =>
    Boolean(item.isSelected) || selectedValues.includes(item.value);

  const candidates = property.values.filter((item) => {
    if (isChosen(item)) return true;
    if (liveCount(item) <= 0) return false;
    if (isBareNegativeValue(item.value, property.name)) return false;
    if (total > 0 && liveCount(item) >= total) return false;
    return true;
  });

  // پایدار: شمارش بیشتر جلوتر؛ در تساوی، ترتیب اصلیِ بک‌اند حفظ می‌شود
  const ordered = candidates
    .map((item, index) => ({ item, index }))
    .sort((a, b) => liveCount(b.item) - liveCount(a.item) || a.index - b.index)
    .map(({ item }) => item);

  const kept: QuickFilterSourceValue[] = [];
  for (const item of ordered) {
    const twin = kept.findIndex(
      (other) => liveCount(other) === liveCount(item) && sharesAllWords(other.value, item.value),
    );
    if (twin === -1) {
      kept.push(item);
      continue;
    }
    // یک واقعیت با دو املا: کوتاه‌ترین (همان باکت نرمال‌شده) می‌ماند؛ انتخاب‌شده هرگز حذف نمی‌شود
    const existing = kept[twin];
    if (isChosen(existing)) continue;
    if (isChosen(item) || item.value.length < existing.value.length) kept[twin] = item;
  }
  // سقف فقط برای مقدارهای معمولی است؛ مقدار انتخاب‌شده هرگز از چیپ‌ها حذف نمی‌شود
  return kept.filter((item, index) => index < perProperty || isChosen(item));
}

export function buildQuickFilters(
  properties: readonly QuickFilterSourceProperty[],
  selectedProperties: Readonly<Record<string, readonly string[]>> = {},
  options: QuickFilterOptions = {},
): QuickFilterPill[] {
  const total = Number.isFinite(options.total) ? Number(options.total) : 0;
  const maxProperties = options.maxProperties ?? 4;
  const perProperty = options.perProperty ?? 2;
  const maxPills = options.maxPills ?? 8;

  const ranked = properties
    .map((property, index) => {
      const selectedValues = selectedProperties[property.name] ?? [];
      const values = pickValues(property, selectedValues, total, perProperty);
      return {
        property,
        values,
        selectedValues,
        index,
        hasSelection: selectedValues.length > 0 || property.values.some((item) => item.isSelected),
        isIdentity: isSelfDescriptiveProperty(property.name),
      };
    })
    .filter((entry) => entry.values.length > 0)
    .sort((a, b) => {
      if (a.hasSelection !== b.hasSelection) return a.hasSelection ? -1 : 1;
      if (Boolean(a.property.isPinned) !== Boolean(b.property.isPinned)) return a.property.isPinned ? -1 : 1;
      if (a.isIdentity !== b.isIdentity) return a.isIdentity ? -1 : 1;
      const byScore = scoreOf(b.property, total) - scoreOf(a.property, total);
      return byScore || a.index - b.index;
    })
    .slice(0, maxProperties);

  const pills: QuickFilterPill[] = [];
  for (const { property, values, selectedValues, isIdentity } of ranked) {
    for (const item of values) {
      const omitPrefix = isIdentity || valueMentionsProperty(item.value, property.name);
      const prefix = omitPrefix ? null : property.name;
      pills.push({
        property: property.name,
        value: item.value,
        prefix,
        label: prefix ? `${prefix}: ${item.value}` : item.value,
        count: liveCount(item),
        // همان منبعی که کلیک چیپ (`handlePropertyFilter`) روی آن تاگل می‌کند
        selected: selectedValues.includes(item.value),
      });
    }
  }
  return pills.slice(0, maxPills);
}
