/**
 * ============================================================
 * Spec Normalization Core  (Phase 2.3)
 * ============================================================
 * یک لایه‌ی نرمال‌سازی «عمومی و دوطرفه» برای تمام دسته‌بندی‌های کالا.
 *
 * اصل طراحی:
 *   هر مقداری که ذخیره می‌شود و هر مقداری که در کوئری/گزینه‌ی دسته
 *   تعریف می‌شود، از همین تابع‌ها عبور می‌کند. پس «۲ مگاپیکسل»، «2MP»
 *   و «2 مگا پیکسل» همه به یک باکت یکتا می‌رسند و mismatch صفر-نتیجه
 *   بین گزینه‌ی ادمین و مقدار ذخیره‌شده رخ نمی‌دهد.
 *
 * هیچ‌گاه برای مقدار معتبر `null` برنمی‌گردانیم؛ فقط ورودی خالی null است.
 * ============================================================
 */

// ------------------------------------------------------------
// ۱) ارقام و حروف
// ------------------------------------------------------------
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function normalizeDigits(input) {
  if (input === null || input === undefined) return ''
  return String(input).replace(/[۰-۹٠-٩]/g, (char) => {
    const p = PERSIAN_DIGITS.indexOf(char)
    if (p !== -1) return String(p)
    const a = ARABIC_DIGITS.indexOf(char)
    if (a !== -1) return String(a)
    return char
  })
}

// U+200C (نیم‌فاصله) → فاصله، تا «می‌کند» و «می کند» یکسان شوند
const ZWNJ = String.fromCharCode(0x200c)
const ZWNJ_RE = new RegExp(ZWNJ, 'g')

/**
 * یکسان‌سازی حروف عربی/فارسی + فاصله‌ها.
 * عمداً حساس به حروف کوچک/بزرگ نیست؛ آن کار را normCompareKey انجام می‌دهد.
 */
function normalizeText(input) {
  if (input === null || input === undefined) return ''
  return normalizeDigits(String(input))
    .replace(/[يئ]/g, 'ی')
    .replace(/ك/g, 'ک')
    // «آ» یک حرف مستقل فارسی است و نباید به «ا» تبدیل شود، وگرنه
    // «آلومینیوم» به «الومینیوم» تخریب می‌شود. فقط شکل‌های همزه‌دار عربی
    // (أ، إ) یکسان می‌شوند. یکسان‌سازی آ/ا فقط در normCompareKey انجام می‌شود.
    .replace(/[أإ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/[\u064B-\u065F\u0670]/g, '') // اعراب
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // کاراکترهای جهت
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * کلید مقایسه‌ای: فقط حروف/ارقام، بدون فاصله و نشانه.
 * «ظرفیت حافظه» و «ظرفيت حافظه» → «ظرفیتحافظه»
 */
function normCompareKey(input) {
  return normalizeText(input)
    .toLowerCase()
    // برای «مقایسه» آ/ا یکی است (آب == اب)، برخلاف نمایش.
    .replace(/آ/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * کلید مقایسه‌ای «مقدار» یک مشخصه.
 * برخلاف normCompareKey نقطه‌ی اعشار و فاصله‌ی بین عدد و واحد را نگه می‌دارد
 * تا «6.1 اینچ» با «61 اینچ» اشتباه نشود.
 *
 * حروف کوچک/بزرگ عمداً تغییر نمی‌کند: همین رشته هم برای تطبیق و هم برای
 * نمایش گزینه‌ی فست استفاده می‌شود، پس باید شکل خوانا («ABS»، «4G») بماند.
 * تطبیق درست است چون هر دو طرف از normalizeBucketValue عبور می‌کنند.
 */
function toValueKey(input) {
  return normalizeText(input)
    // نیم‌فاصله در «مقایسه» حذف می‌شود (می‌کند == میکند) ولی در «نمایش»
    // دست‌نخورده می‌ماند تا «ژله‌ای» به «ژله ای» تخریب نشود.
    .replace(ZWNJ_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ------------------------------------------------------------
// ۲) نگهبان نفی  (Phase 2.3.2)
// ------------------------------------------------------------
// پیش از هر تطبیق مثبت، نفی بررسی می‌شود تا «فاقد میکروفون داخلی»
// هرگز به «دارد» و «بدون دید در شب رنگی» هرگز به «رنگی» تبدیل نشود.
//
// نکته‌ی مهم: `\b` در جاوااسکریپت فقط بر پایه‌ی \w اسکی‌یست، پس کنار حروف
// فارسی هرگز مرز کلمه نمی‌سازد. به‌جای آن از lookaround یونیکد استفاده می‌کنیم.
const NEGATION_PATTERNS = [
  /(?<!\p{L})(?:فاقد|ندارد|بدون|غیر\s*فعال|غیرفعال|خیر|نیست|هیچ|عدم)(?!\p{L})/iu,
  /(?<!\p{L})(?:no|not|without|none|n\/a|na)(?!\p{L})/iu,
]
const NEGATION_RE = new RegExp(NEGATION_PATTERNS.map((re) => re.source).join('|'), 'iu')

// «بدون آینه» / «دارای» را هم بگیرد: نفی فارسی اغلب به‌صورت پیشوندی است
const NEGATION_PREFIX_RE = /^(?:بدون|فاقد|عدم|غیر)[\s_\-]*/iu

function isNegated(raw) {
  if (raw === null || raw === undefined) return false
  const text = normalizeText(raw)
  if (!text) return false
  if (NEGATION_RE.test(text)) return true
  return NEGATION_PREFIX_RE.test(text)
}

// مقادیر بولی استاندارد با نفی
const TRUE_TOKENS = /^(?:دارد|دارد\b|بله|آری|هست|yes|true|1|موجود|فعال|internal|built[\s-]*in)/iu
const FALSE_TOKENS = /^(?:ندارد|خیر|نه|no|false|0|ناموجود|غیرفعال|none)/iu

/**
 * تبدیل بولی آگاه به نفی. خروجی: 'دارد' | 'ندارد' | null (تشخیص ممکن نشد)
 */
function normalizeBooleanValue(raw) {
  const text = normalizeText(raw)
  if (!text) return null
  if (FALSE_TOKENS.test(text)) return 'ندارد'
  if (NEGATION_RE.test(text)) return 'ندارد'
  if (TRUE_TOKENS.test(text)) return 'دارد'
  return null
}

// ------------------------------------------------------------
// ۳) نرمال‌ساز عمومی واحدها  (Phase 2.3.3)
// ------------------------------------------------------------
// هر واحد به یک نام استاندارد فارسی نگاشت می‌شود. هم LATIN و هم فارسی.
// ترتیب مهم است: توکن‌های بلندتر اول بررسی می‌شوند.
const UNIT_TABLE = [
  // حافظه و ذخیره‌سازی
  { unit: 'ترابایت', tokens: ['tb', 'tbyte', 'terabyte', 'ترابایت', 'ترا'], kind: 'storage' },
  { unit: 'گیگابایت', tokens: ['gb', 'gbyte', 'gigabyte', 'گیگابایت', 'گیگا', 'گیگ'], kind: 'storage' },
  { unit: 'مگابایت', tokens: ['mb', 'mbyte', 'megabyte', 'مگابایت'], kind: 'storage' },
  { unit: 'کیلوبایت', tokens: ['kb', 'kbyte', 'kilobyte', 'کیلوبایت'], kind: 'storage' },
  // فرکانس
  { unit: 'گیگاهرتز', tokens: ['ghz', 'ghertz', 'گیگاهرتز'], kind: 'frequency' },
  { unit: 'مگاهرتز', tokens: ['mhz', 'mhertz', 'مگاهرتز'], kind: 'frequency' },
  { unit: 'کیلوهرتز', tokens: ['khz', 'کیلوهرتز'], kind: 'frequency' },
  // توان / جریان / ولتاژ
  { unit: 'وات', tokens: ['watt', 'watts', 'w', 'وات'], kind: 'power' },
  { unit: 'کیلووات', tokens: ['kw', 'کیلووات'], kind: 'power' },
  { unit: 'آمپر', tokens: ['amper', 'ampere', 'amps', 'amp', 'a', 'امپر', 'آمپر'], kind: 'current' },
  { unit: 'میلی‌آمپر', tokens: ['mah', 'میلی‌آمپر', 'میلی امپر'], kind: 'current' },
  { unit: 'ولت', tokens: ['volt', 'volts', 'v', 'ولت'], kind: 'voltage' },
  // طول
  { unit: 'میلی‌متر', tokens: ['mm', 'millimeter', 'millimetre', 'میلی‌متر', 'میلی متر'], kind: 'length' },
  { unit: 'سانتی‌متر', tokens: ['cm', 'centimeter', 'centimetre', 'سانتی‌متر', 'سانتی متر'], kind: 'length' },
  { unit: 'کیلومتر', tokens: ['km', 'kilometer', 'kilometre', 'کیلومتر'], kind: 'length' },
  { unit: 'متر', tokens: ['m', 'meter', 'metre', 'meters', 'متر'], kind: 'length' },
  // جرم
  { unit: 'کیلوگرم', tokens: ['kg', 'kilogram', 'کیلوگرم', 'کیلو'], kind: 'mass' },
  { unit: 'گرم', tokens: ['gram', 'grams', 'g', 'گرم'], kind: 'mass' },
  // تصویر
  { unit: 'مگاپیکسل', tokens: ['mp', 'megapixel', 'megapixels', 'مگاپیکسل', 'مگا پیکسل'], kind: 'pixel' },
  { unit: 'پیکسل', tokens: ['px', 'pixel', 'پیکسل'], kind: 'pixel' },
  // اینچ
  { unit: 'اینچ', tokens: ['inch', 'inches', 'in', 'اینچ'], kind: 'inch' },
  // زمان
  { unit: 'ساعت', tokens: ['hour', 'hours', 'hr', 'h', 'ساعت'], kind: 'time' },
  { unit: 'دقیقه', tokens: ['minute', 'minutes', 'min', 'دقیقه'], kind: 'time' },
  { unit: 'روز', tokens: ['day', 'days', 'روز'], kind: 'time' },
  { unit: 'ماه', tokens: ['month', 'months', 'ماه'], kind: 'time' },
  { unit: 'سال', tokens: ['year', 'years', 'سال'], kind: 'time' },
  // دما / زاویه / صدا (برای دوربین و ابزار)
  { unit: 'درجه', tokens: ['deg', 'degree', 'degrees', 'درجه'], kind: 'angle' },
  { unit: 'دسی‌بل', tokens: ['db', 'decibel', 'دسی‌بل'], kind: 'sound' },
  // شبکه
  { unit: 'مگابیت', tokens: ['mbps', 'mbit', 'مگابیت'], kind: 'bandwidth' },
  { unit: 'گیگابیت', tokens: ['gbps', 'gbit', 'گیگابیت'], kind: 'bandwidth' },
]

const UNIT_LOOKUP = (() => {
  const map = new Map()
  for (const entry of UNIT_TABLE) {
    for (const token of entry.tokens) map.set(token.toLowerCase(), entry)
  }
  return map
})()

/** توکن واحد → نام استاندارد فارسی (یا null) */
function canonicalUnit(token) {
  if (!token) return null
  const entry = UNIT_LOOKUP.get(normalizeText(token).toLowerCase())
  return entry ? entry.unit : null
}

// عدد + واحد: «128 گیگابایت»، «4MP»، «۱۲۸GB»، «50 متر»، «2.4GHz»
const QUANTITY_RE = new RegExp(
  '^(-?\\d+(?:[.,]\\d+)?)\\s*(' +
  UNIT_TABLE.flatMap((entry) => entry.tokens)
    .sort((a, b) => b.length - a.length)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|') +
  ')?$',
  'iu',
)

/**
 * تجزیه‌ی «عدد + واحد». برای مقادیر بدون واحد، unit = null.
 * @returns {{value:number, unit:string|null, rawUnit:string|null} | null}
 */
function parseQuantity(input) {
  const text = normalizeText(input).replace(/\s+/g, ' ')
  if (!text) return null
  const match = text.match(QUANTITY_RE)
  if (!match) return null
  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value)) return null
  const rawUnit = match[2] ? match[2] : null
  return { value, unit: rawUnit ? canonicalUnit(rawUnit) : null, rawUnit }
}

/** عدد را بدون اعشار اضافی چاپ می‌کند: 128 نه 128.0 */
function formatNumber(value) {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}

/** {value, unit} → «128 گیگابایت» */
function formatQuantity({ value, unit }) {
  const number = formatNumber(value)
  return unit ? `${number} ${unit}` : number
}

// ------------------------------------------------------------
// ۴) قواعد کلید-محور (Rule-Based) + نرمال‌ساز عمومی (Generic)
// ------------------------------------------------------------
/**
 * هر قاعده: { match: RegExp روی کلید، map: (متن نرمال‌شده) => string|null }
 * اگر map مقدار null برگرداند، به نرمال‌ساز عمومی می‌افتیم (هرگز حذف نمی‌شود).
 */
const KEY_RULES = [
  {
    name: 'نوع باتری',
    match: /(نوع\s*باتری|باتری|battery)/iu,
    map: (text) => {
      if (isNegated(text)) return null
      if (/(لیتیوم[\s-]*یون|li[\s-]*ion|lithium)/iu.test(text)) return 'لیتیوم-یون'
      if (/(لیتیوم[\s-]*پلیمر|li[\s-]*polymer|lipo)/iu.test(text)) return 'لیتیوم-پلیمر'
      if (/(سیلد[\s-]*اسید|sealed[\s-]*lead|sla|سرب[\s-]*اسید)/iu.test(text)) return 'سیلد اسید'
      if (/(نیکل[\s-]*کادمیوم|ni[\s-]*cd|nicd)/iu.test(text)) return 'نیکل-کادمیوم'
      if (/(نیکل[\s-]*متال|ni[\s-]*mh|nimh)/iu.test(text)) return 'نیکل-متال هیدرید'
      if (/(قلیایی|alkaline)/iu.test(text)) return 'قلیایی'
      if (/(الکتریکی|electric|برق\s*شهر)/iu.test(text)) return 'الکتریکی'
      return null // ← به نرمال‌ساز عمومی می‌رود (حذف نمی‌شود)
    },
  },
  {
    name: 'جنس بدنه',
    match: /(جنس\s*(بدنه|بدن)|متریال|material|body)/iu,
    map: (text) => {
      if (isNegated(text)) return null
      if (/(پلی[\s-]*کربنات|polycarbonate|pc)/iu.test(text)) return 'پلی‌کربنات'
      if (/(abs)/iu.test(text)) return 'ABS'
      if (/(آلومینیوم|aluminum|aluminium)/iu.test(text)) return 'آلومینیوم'
      if (/(استیل|فولاد|steel|stainless)/iu.test(text)) return 'استیل'
      if (/(فلز|metal|metallic)/iu.test(text)) return 'فلز'
      if (/(شیشه|glass)/iu.test(text)) return 'شیشه'
      if (/(پلاستیک|plastic)/iu.test(text)) return 'پلاستیک'
      if (/(چرم|leather)/iu.test(text)) return 'چرم'
      if (/(سیلیکون|silicone)/iu.test(text)) return 'سیلیکون'
      return null
    },
  },
  {
    name: 'برد عملکرد',
    match: /(برد\s*(عملکرد|کاری|حرکت|تشخیص)|range|coverage)/iu,
    map: (text) => {
      if (isNegated(text)) return null
      if (/(حرکت|motion|pir)/iu.test(text)) return 'تشخیص حرکت'
      if (/(نور|light|photocell)/iu.test(text)) return 'تشخیص نور'
      if (/(صدا|sound|audio|acoustic)/iu.test(text)) return 'تشخیص صدا'
      if (/(لرزش|vibration|shock)/iu.test(text)) return 'تشخیص لرزش'
      if (/(دود|smoke)/iu.test(text)) return 'تشخیص دود'
      if (/(حرارت|گرما|heat|thermal)/iu.test(text)) return 'تشخیص حرارت'
      if (/(مغناطیس|magnetic|reed)/iu.test(text)) return 'تشخیص مغناطیسی'
      return null
    },
  },
  {
    name: 'نوع دید در شب',
    match: /(دید\s*در\s*شب|night\s*vision|شبانه)/iu,
    map: (text) => {
      if (isNegated(text)) return 'ندارد'
      if (/(رنگی|color|colour)/iu.test(text) && !/(سیاه|black|b\/w|mono)/iu.test(text)) return 'رنگی'
      if (/(سیاه\s*و\s*سفید|سیاه[\s-]*سفید|black\s*(and|&)\s*white|b\/w|monochrome)/iu.test(text)) return 'سیاه و سفید'
      if (/(هیبرید|hybrid|dual)/iu.test(text)) return 'هیبرید'
      if (/((infrared)|(^|\s)ir(\s|$)|مادون\s*قرمز|ir[\s-]*led)/iu.test(text)) return 'مادون قرمز'
      if (/(دارد|yes|true|built)/iu.test(text)) return 'دارد'
      return null
    },
  },
  {
    name: 'گارانتی',
    match: /(گارانتی|گارانتی|warranty)/iu,
    map: (text) => {
      if (isNegated(text)) return 'ندارد'
      if (/(اصالت|original|authentic)/iu.test(text) && !/\d/u.test(text)) return 'اصالت کالا'
      return null // «۱۸ ماه گارانتی» را نرمال‌ساز عددی می‌گیرد
    },
  },
]

const NON_FILTERABLE_KEYS_BASE = new Set(
  [
    'description', 'توضیحات', 'تصویر', 'تصاویر', 'image', 'images', 'عکس',
    'بارکد', 'barcode', 'کد کالا', 'sku', 'شناسه', 'id', 'لینک', 'url',
    'نام', 'name', 'قیمت', 'price', 'موجودی', 'stock', 'وزن بسته‌بندی',
    'کد انبار', 'warehouse',
  ].map(normCompareKey),
)

// کلیدهایی که در نسخه‌ی قبلی به‌اشتباه مسدود می‌شدند و اکنون آزادند (Phase 2.3.4)
const PREVIOUSLY_BLOCKED_KEYS = [
  'ظرفیت حافظه', 'درگاه های ارتباطی', 'نوع کاربری', 'سازگاری', 'مناسب برای', 'توان مصرفی',
]

/**
 * آیا این کلید «به‌طور کلی» غیرقابل‌فیلتر است؟
 * توجه: تصمیم نهایی با ادمین است (isFilterable در category.properties).
 */
function isNonFilterableKey(label) {
  return NON_FILTERABLE_KEYS_BASE.has(normCompareKey(label))
}

// ------------------------------------------------------------
// ۵) هسته‌ی باکت‌بندی  (Phase 2.3)
// ------------------------------------------------------------
/**
 * مقدار خام یک مشخصه را به «باکت استاندارد» تبدیل می‌کند.
 *
 * قرارداد:
 *  - ورودی خالی → null (تنها حالت null)
 *  - نفی → باکت «ندارد»
 *  - قاعده‌ی کلید-محور → باکت قاعده
 *  - عدد + واحد → «<عدد> <واحد استاندارد>»
 *  - بولی → «دارد» / «ندارد»
 *  - در غیر این صورت → متن نرمال‌شده (هرگز حذف نمی‌شود)
 */
function normalizeBucketValue(label, rawValue) {
  const text = normalizeText(rawValue)
  if (!text) return null

  // نفی همیشه اول
  if (isNegated(text)) return 'ندارد'

  // قاعده‌ی کلید-محور
  for (const rule of KEY_RULES) {
    if (!rule.match.test(label || '')) continue
    const mapped = rule.map(text)
    if (mapped) return mapped
    break // قاعده‌ی این کلید اعمال شد؛ اگر null داد به نرمال‌ساز عمومی برو
  }

  // عدد + واحد
  const quantity = parseQuantity(text)
  if (quantity) return formatQuantity(quantity)

  // بولی
  const boolean = normalizeBooleanValue(text)
  if (boolean) return boolean

  // «تا 40 متر» و بازه‌ها: واحد داخل متن را استاندارد کن
  const range = text.match(/^(تا|حداکثر|حداقل|بیش\s*از|کمتر\s*از)\s*(.+)$/iu)
  if (range) {
    const inner = parseQuantity(range[2])
    if (inner) return `${normalizeText(range[1])} ${formatQuantity(inner)}`
  }

  // نرمال‌ساز عمومی نهایی: واحدهای داخل متن را استاندارد می‌کند ولی چیزی را حذف نمی‌کند
  return normalizeText(text)
}

/**
 * هسته‌ی عددی برای بازه‌بندی‌های عددی (آینه‌ی باگ `dist <= 50` که بازه‌ی ۴۰ متر را می‌بلعید).
 * بازه‌ی درست: هر کران بالا شامل خودش است و کران‌های تودرتو نیستند.
 */
function bucketizeByThresholds(value, buckets) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const sorted = [...buckets].sort((a, b) => a.max - b.max)
  for (const bucket of sorted) {
    if (numeric <= bucket.max) return bucket.label
  }
  return sorted.length ? `بیش از ${formatNumber(sorted[sorted.length - 1].max)}` : null
}

module.exports = {
  normalizeDigits,
  normalizeText,
  normCompareKey,
  toValueKey,
  isNegated,
  normalizeBooleanValue,
  canonicalUnit,
  parseQuantity,
  formatQuantity,
  formatNumber,
  normalizeBucketValue,
  bucketizeByThresholds,
  isNonFilterableKey,
  NON_FILTERABLE_KEYS_BASE,
  PREVIOUSLY_BLOCKED_KEYS,
  UNIT_TABLE,
  KEY_RULES,
}
