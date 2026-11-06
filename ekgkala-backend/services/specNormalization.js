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
  return String(input)
    .replace(/[۰-۹٠-٩]/g, (char) => {
      const p = PERSIAN_DIGITS.indexOf(char)
      if (p !== -1) return String(p)
      const a = ARABIC_DIGITS.indexOf(char)
      if (a !== -1) return String(a)
      return char
    })
    // ممیز فارسی «٫» (U+066B) → «.» و حذف جداکننده هزارگان فارسی «٬» (U+066C) و کامای بین ارقام
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1')
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
const TRUE_TOKENS = /^(?:دارد|دارای|پشتیبانی[\s‌]*می[\s‌]*شود|بله|آری|هست|yes|true|1|موجود|فعال|internal|built[\s-]*in)$/iu
const TRUE_PHRASE_RE = /^(?:دارد|دارای|پشتیبانی[\s‌]*می[\s‌]*شود)(?:\s|$)/iu
const FALSE_TOKENS = /^(?:ندارد|خیر|نه|no|false|0|ناموجود|غیرفعال|none)$/iu

/**
 * تبدیل بولی آگاه به نفی. خروجی: 'دارد' | 'ندارد' | null (تشخیص ممکن نشد)
 */
function normalizeBooleanValue(raw) {
  const text = normalizeText(raw)
  if (!text) return null
  if (FALSE_TOKENS.test(text)) return 'ندارد'
  if (NEGATION_RE.test(text)) return 'ندارد'
  if (TRUE_TOKENS.test(text)) return 'دارد'
  if (!/\d/.test(text) && TRUE_PHRASE_RE.test(text)) return 'دارد'
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
  const raw = normalizeText(input).replace(/\s+/g, ' ')
  if (!raw) return null
  // حذف پیشوندهای جریان (DC/AC) و تلورانس انتهایی (± 10%) پیش از تجزیه‌ی کمیت
  const cleaned = raw
    .replace(/^(?:dc|ac)\s*(?=\d)/iu, '')
    .replace(/\s*(?:±|\+\/-|\+-)\s*\d+(?:[.,]\d+)?\s*%?$/iu, '')
    .trim()
  const match = cleaned.match(QUANTITY_RE) || raw.match(QUANTITY_RE)
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
// ۳.۵) یکسان‌سازی نام ویژگی‌ها (Canonical Labels)
// ------------------------------------------------------------
// هدف: «فرکانس ریموت»، «فرکانس گیرنده» و «بازه فرکانسی» همه به یک فست
// استاندارد «فرکانس کاری» برسند تا سایدبار به‌جای ده‌ها کلید هم‌معنا،
// چند فست تمیز داشته باشد.
//
// اولویت: categoryRules (rule.name + rule.aliases) → دیکشنری سراسری.
const BUILTIN_KEY_SYNONYMS = [
  // ۱. هویت اصلی دستگاه و کاربری (هم‌راستا با فیلتر لنگری دکاشاپ + حفظ سازگاری با تست‌های قبلی)
  { canonical: 'نوع محصول', aliases: ['نوع کالا', 'مدل دستگاه', 'نوع تجهیز', 'نوع سیستم', 'product type'] },
  { canonical: 'نوع کاربری', aliases: ['نوع دستگاه', 'نوع محصول', 'کاربری', 'محیط کاربری', 'مناسب برای محیط', 'کاربرد'] },
  // ۲. دزدگیر اماکن، ریموت و رسیور
  { canonical: 'تعداد زون', aliases: ['زون ها', 'زون‌ها', 'تعداد زون باسیم', 'تعداد زون باسیم و بیسیم', 'ظرفیت زون', 'تعداد زون با سیم'] },
  { canonical: 'پشتیبانی از سیم‌کارت', aliases: ['سیم کارت', 'سیم‌کارت', 'ماژول سیم کارت', 'ماژول سیم‌کارت', 'تلفن کننده سیم کارتی'] },
  { canonical: 'فرکانس کاری', aliases: ['فرکانس ریموت', 'فرکانس گیرنده', 'بازه فرکانسی', 'فرکانس کاری ریموت', 'فرکانس'] },
  { canonical: 'نوع کددهی', aliases: ['نوع کد ریموت', 'نوع کدینگ', 'فناوری کد', 'نحوه کددهی', 'نوع کد', 'روش کددهی ریموت'] },
  { canonical: 'تعداد رله', aliases: ['تعداد رله خروجی', 'رله خروجی', 'تعداد خروجی رله', 'کانال رله'] },
  { canonical: 'تعداد کلید', aliases: ['تعداد دکمه', 'تعداد کلید', 'تعداد دکمه کلید', 'تعداد دکمه‌ها', 'تعداد پل'] },
  { canonical: 'ظرفیت حافظه رسیور', aliases: ['ظرفیت ریموت', 'حافظه رسیور', 'تعداد ریموت قابل تعریف', 'حافظه ثبت ریموت'] },
  { canonical: 'نحوه کنترل', aliases: ['کنترل از راه دور', 'روش کنترل', 'مدیریت دستگاه'] },
  // ۳. دوربین مداربسته و دستگاه ضبط (DVR/NVR)
  { canonical: 'تعداد کانال', aliases: ['تعداد کانال ورودی تصویر', 'تعداد کانال تصویر', 'کانال ها', 'کانال‌ها', 'تعداد کانال‌ها'] },
  { canonical: 'رزولوشن تصویر', aliases: ['وضوح تصویر', 'کیفیت تصویر', 'رزولوشن', 'resolution', 'دقت تصویر'] },
  { canonical: 'حداکثر رزولوشن ضبط', aliases: ['حداکثر رزولوشن پشتیبانی', 'رزولوشن ضبط', 'کیفیت ضبط', 'حداکثر کیفیت ضبط'] },
  { canonical: 'تکنولوژی تصویر', aliases: ['تکنولوژی دوربین', 'فناوری تصویر', 'نوع تکنولوژی', 'سیستم تصویربرداری'] },
  { canonical: 'نوع بدنه دوربین', aliases: ['فرم بدنه', 'نوع کیس', 'کیس دوربین', 'تیپ بدنه'] },
  { canonical: 'نوع دید در شب', aliases: ['دید در شب', 'night vision', 'فناوری دید در شب', 'قابلیت دید در شب'] },
  { canonical: 'برد دید در شب', aliases: ['مسافت دید در شب', 'شعاع دید در شب', 'برد مادون قرمز', 'برد ir'] },
  { canonical: 'سایز لنز', aliases: ['لنز', 'نوع لنز', 'فاصله کانونی'] },
  { canonical: 'میکروفون داخلی', aliases: ['میکروفن', 'میکروفون', 'میکروفن داخلی', 'میکروفون داخلی', 'ضبط صدا'] },
  // ۴. آیفون تصویری و صوتی
  { canonical: 'سایز صفحه نمایش', aliases: ['اندازه صفحه نمایش', 'سایز نمایشگر', 'قطر صفحه نمایش', 'صفحه نمایش'] },
  { canonical: 'نوع صفحه نمایش', aliases: ['تکنولوژی صفحه نمایش', 'نوع نمایشگر', 'نوع کلیدهای مانیتور'] },
  { canonical: 'حافظه داخلی', aliases: ['حافظه آیفون', 'پشتیبانی از کارت حافظه', 'درگاه کارت حافظه', 'حافظه ضبط'] },
  { canonical: 'تعداد واحد پشتیبانی‌شده', aliases: ['انتخاب تعداد واحد', 'تعداد واحد', 'تعداد واحد ساختمان', 'حداکثر اتصال واحد تا', 'ظرفیت واحد'] },
  // ۵. جک درب پارکینگی، قفل برقی، آرام‌بند و اکسس کنترل
  { canonical: 'حداکثر عرض هر لنگه', aliases: ['عرض هر لنگه درب', 'عرض لنگه درب', 'حداکثر عرض درب'] },
  { canonical: 'ظرفیت هر لنگه', aliases: ['حداکثر وزن هر لنگه', 'تحمل وزن هر لنگه', 'قدرت جابجایی هر لنگه', 'وزن هر لنگه', 'قدرت هر جک'] },
  { canonical: 'قدرت لیفت موتور', aliases: ['قدرت لیفت', 'قدرت لیفت ظرفیت', 'قدرت موتور'] },
  { canonical: 'میزان تردد', aliases: ['تردد در ساعت', 'ظرفیت تردد', 'تعداد تردد مجاز'] },
  { canonical: 'نحوه شناسایی', aliases: ['نوع شناسایی', 'روش دسترسی', 'نحوه بازگشایی', 'مدل دسترسی'] },
  { canonical: 'پشتیبانی از برق اضطراری', aliases: ['قابلیت برق اضطراری', 'پشتیبانی از باتری بکاپ', 'اتصال به ups', 'برق اضطراری'] },
  // ۶. برق، تغذیه، بدنه و عمومی
  { canonical: 'نوع اتصال', aliases: ['نوع ارتباط', 'اتصال', 'رابط ارتباطی', 'نحوه اتصال'] },
  { canonical: 'ولتاژ تغذیه', aliases: ['ولتاژ کاری', 'ولتاژ ورودی', 'منبع تغذیه', 'تغذیه', 'ولتاژ خروجی'] },
  { canonical: 'جریان مصرفی', aliases: ['جریان خروجی', 'شدت جریان', 'آمپر خروجی', 'جریان', 'آمپراژ'] },
  { canonical: 'استاندارد حفاظتی', aliases: ['درجه حفاظت', 'درجه حفاظت ip', 'کلاس حفاظتی', 'استاندارد حفاظت محیطی', 'درجه حفاظتی'] },
  { canonical: 'برد عملکرد', aliases: ['برد ریموت', 'برد ریموت کنترل', 'برد عملیاتی', 'برد', 'برد مفید'] },
  { canonical: 'گارانتی', aliases: ['مدت گارانتی', 'ضمانت', 'مدت ضمانت'] },
]

const SYNONYM_LOOKUP = (() => {
  const map = new Map()
  for (const entry of BUILTIN_KEY_SYNONYMS) {
    // تعریف بعدی برنده است: «نوع محصول» در گروه «نوع کاربری» هم alias است و
    // برای سازگاری با داده‌ی ذخیره‌شده‌ی قبلی همچنان به «نوع کاربری» می‌رسد.
    map.set(normCompareKey(entry.canonical), entry.canonical)
    for (const alias of entry.aliases) map.set(normCompareKey(alias), entry.canonical)
  }
  return map
})()

/**
 * نام استاندارد یک ویژگی.
 * @param {string} label برچسب خام
 * @param {Array} categoryRules قواعد دسته‌بندی (rule.name + rule.aliases)
 */
function canonicalizeSpecLabel(label, categoryRules = []) {
  const raw = normalizeText(label)
  if (!raw) return ''
  const key = normCompareKey(raw)

  if (Array.isArray(categoryRules)) {
    for (const rule of categoryRules) {
      if (!rule || !rule.name) continue
      if (normCompareKey(rule.name) === key) return String(rule.name).trim()
      const aliases = Array.isArray(rule.aliases) ? rule.aliases : []
      if (aliases.some((alias) => normCompareKey(alias) === key)) return String(rule.name).trim()
    }
  }

  return SYNONYM_LOOKUP.get(key) || raw
}

// ------------------------------------------------------------
// ۳.۵.۱) ویژگی‌های هویتی کالا (Core Identity)
// ------------------------------------------------------------
// این‌ها «شناسنامه‌ی» یک کالا هستند: حتی اگر دسته فقط یک محصول داشته باشد،
// باید در سایدبار دیده شوند تا کالا قابل پیدا شدن باشد.
const CORE_IDENTITY_LABELS = [
  'نوع محصول',
  'نوع کاربری',
  'تعداد زون',
  'تعداد کانال',
  'رزولوشن تصویر',
  'حداکثر رزولوشن ضبط',
  'تکنولوژی تصویر',
  'نوع بدنه دوربین',
  'فرکانس کاری',
  'نوع کددهی',
  'نوع اتصال',
  'پشتیبانی از سیم‌کارت',
  'تعداد رله',
  'تعداد کلید',
  'ظرفیت حافظه رسیور',
  'سایز صفحه نمایش',
  'نوع صفحه نمایش',
  'حافظه داخلی',
  'تعداد واحد پشتیبانی‌شده',
  'حداکثر عرض هر لنگه',
  'ظرفیت هر لنگه',
  'میزان تردد',
  'نحوه شناسایی',
  'ولتاژ تغذیه',
  'جریان مصرفی',
  'استاندارد حفاظتی',
  'نوع دید در شب',
  'برد دید در شب',
  'سایز لنز',
  'برد عملکرد',
  'جنس بدنه',
]

// تشخیص هوشمند «نوع کاربری / نوع محصول» از نام کالا یا تیتر H1 توضیحات
// وقتی جدول مشخصات فنی فاقد ردیف صریح «نوع دستگاه / نوع کاربری» است
const PRODUCT_TYPE_PATTERNS = [
  { pattern: /(?:پکیج|پک)\s*(?:کامل\s*)?دزدگیر/iu, type: 'پکیج دزدگیر اماکن' },
  { pattern: /(?:پنل|دستگاه\s*مرکزی)\s*دزدگیر\s*اماکن\s*سیم[\s‌]*کارتی/iu, type: 'پنل دزدگیر اماکن سیم‌کارتی' },
  { pattern: /(?:پنل|دستگاه\s*مرکزی)\s*دزدگیر/iu, type: 'پنل دزدگیر اماکن' },
  { pattern: /(?:چشمی|سنسور\s*حرکتی|دتکتور)/iu, type: 'چشمی و سنسور' },
  { pattern: /(?:آژیر|بلندگو|سیرن|فلاشر)/iu, type: 'آژیر و بلندگو' },
  { pattern: /(?:تلفن\s*کننده|تلفن‌کننده)/iu, type: 'تلفن‌کننده دزدگیر' },
  { pattern: /(?:برد\s*گیرنده|رسیور|گیرنده\s*ریموت)/iu, type: 'برد گیرنده و رسیور' },
  { pattern: /(?:ریموت(?:\s*کنترل)?)/iu, type: 'ریموت کنترل' },
  { pattern: /دوربین[\s\S]{0,25}(?:اسپید\s*دام|speed\s*dome|ptz)/iu, type: 'دوربین مداربسته اسپید دام' },
  { pattern: /دوربین[\s\S]{0,25}(?:دام|dome)/iu, type: 'دوربین مداربسته دام' },
  { pattern: /دوربین[\s\S]{0,25}(?:بالت|بولت|bullet)/iu, type: 'دوربین مداربسته بالت' },
  { pattern: /(?:دستگاه\s*)?(?:dvr|nvr|xvr|ضبط\s*کننده\s*تصویر)/iu, type: 'دستگاه ضبط تصویر (DVR/NVR)' },
  { pattern: /(?:مانیتور\s*آیفون|آیفون\s*تصویری)/iu, type: 'مانیتور آیفون تصویری' },
  { pattern: /(?:پنل\s*(?:دم\s*دری|بیرونی|زنگ)|صفحه\s*کلید\s*آیفون)/iu, type: 'پنل دم دری آیفون' },
  { pattern: /(?:جک\s*(?:درب\s*)?پارکینگ|جک\s*بازویی|اپراتور\s*درب)/iu, type: 'جک درب پارکینگی' },
  { pattern: /(?:مدار\s*فرمان\s*جک|برد\s*جک)/iu, type: 'مدار فرمان جک' },
  { pattern: /(?:قفل\s*برقی|قفل\s*حیاطی|قفل\s*کله\s*گاوی|مقابل\s*برقی)/iu, type: 'قفل برقی' },
  { pattern: /(?:آرام\s*بند|آرام‌بند)/iu, type: 'آرام‌بند درب' },
  { pattern: /(?:اکسس\s*کنترل|کنترل\s*تردد|دستگیره\s*دیجیتال)/iu, type: 'اکسس کنترل و دستگیره دیجیتال' },
  { pattern: /(?:منبع\s*تغذیه|آداپتور|سوئیچینگ)/iu, type: 'منبع تغذیه و آداپتور' },
  { pattern: /(?:باتری\s*(?:خشک|سیلد\s*اسید|دزدگیر|یو\s*پی\s*اس))/iu, type: 'باتری بکاپ' },
]

/**
 * نوع دستگاه را از اولین متن غیرخالی که با یکی از الگوها تطبیق دارد برمی‌گرداند.
 * فقط برای فست سایدبار است؛ هرگز در specifications خام نوشته نمی‌شود.
 */
function inferProductTypeFromText(...candidates) {
  for (const raw of candidates) {
    const text = normalizeText(raw)
    if (!text) continue
    for (const { pattern, type } of PRODUCT_TYPE_PATTERNS) {
      if (pattern.test(text)) return type
    }
  }
  return null
}

const CORE_IDENTITY_KEYS = new Set(CORE_IDENTITY_LABELS.map(normCompareKey))

function isCoreIdentityKey(label) {
  const canonical = canonicalizeSpecLabel(label)
  return CORE_IDENTITY_KEYS.has(normCompareKey(canonical)) || CORE_IDENTITY_KEYS.has(normCompareKey(label))
}

// ------------------------------------------------------------
// ۳.۵.۲) فشرده‌ساز هوشمند عمومی مقادیر
// ------------------------------------------------------------
// هدف: حتی کالایی که هیچ قاعده‌ی اختصاصی برایش نوشته نشده، مقدارهای
// توصیفی جدول HTML را به باکت کوتاه و فیلترپذیر تبدیل کند.
const TRAILING_DESCRIPTOR_PATTERNS = [
  /(?:^|\s)(?:قابل\s*برنامه\s*ریزی|قابل\s*برنامه‌ریزی)\s*$/iu,
  /(?:^|\s)کنترلی\s*$/iu,
  /(?:^|\s)در\s*فضای\s*باز\s*$/iu,
  /(?:^|\s)در\s*حالت\s*استندبای\s*$/iu,
  /(?:^|\s)با\s*قابلیت\s+[\s\S]+$/iu,
  /(?:^|\s)پشتیبانی\s*از\s+[\s\S]+$/iu,
  /(?:^|\s)به\s*همراه\s+[\s\S]+$/iu,
]

const stripTrailingDescriptors = (input) => {
  let out = input
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of TRAILING_DESCRIPTOR_PATTERNS) {
      const next = out.replace(pattern, '').trim()
      if (next && next !== out) {
        out = next
        changed = true
      }
    }
  }
  return out
}

// «عدد + واحد» در ابتدای متن (نه لزوماً کل متن)
const LEADING_QUANTITY_RE =
  /^(\d+(?:[.,]\d+)?)\s*(ولت|آمپر|میلی[\s-]*آمپر|وات|کیلووات|متر|میلی[\s-]*متر|سانتی[\s-]*متر|مگاهرتز|گیگاهرتز|گیگابایت|ترابایت|مگابایت|کیلوبایت|مگاپیکسل|پیکسل|اینچ|دسی[\s-]*بل|دسیبل|آمپرساعت|میلی[\s-]*آمپرساعت|کیلوگرم|گرم|ساعت|دقیقه|ثانیه|روز|ماه|سال)/iu

/**
 * تبدیل عبارت توصیفی به باکت کوتاه.
 *
 * ترتیب:
 *  ۱) حذف پسوندهای توصیفی رایج («قابل برنامه‌ریزی»، «کنترلی»، «در فضای باز»، …)
 *  ۲) حذف پرانتز توضیحی انتهایی اگر بخش قبلش ۲..۳۰ کاراکتر باشد
 *  ۳) برای کلیدهای «تعداد …»: استخراج «<عدد> <واحد بعدی>»
 *  ۴) بازگرداندن «<عدد> <واحد استاندارد>» از ابتدای متن
 *
 * همیشه رشته برمی‌گرداند (در بدترین حالت، ورودیِ پاک‌سازی‌شده).
 */
function condenseDescriptiveValueToBucket(canonicalLabel, rawText) {
  let text = normalizeText(rawText)
  if (!text) return ''

  // ۱) پسوندهای توصیفی
  text = stripTrailingDescriptors(text)

  // ۲) پرانتز توضیحی انتهایی
  const paren = text.match(/^([\s\S]{2,30}?)\s*\([^)]*\)\s*$/u)
  if (paren && paren[1].trim()) text = paren[1].trim()

  // ۳) الگوی «تعداد …» با واحدِ بعد از عدد
  if (/^تعداد\s/u.test(canonicalLabel || '')) {
    const countMatch = text.match(/(\d{1,4})\s+([\p{L}\u200c]{2,})/u)
    if (countMatch) return `${Number(countMatch[1])} ${countMatch[2]}`
  }

  // ۴) کمیت در ابتدای متن
  const quantity = text.match(LEADING_QUANTITY_RE)
  if (quantity) {
    const unit = canonicalUnit(quantity[2])
    const value = Number(quantity[1].replace(',', '.'))
    if (unit && Number.isFinite(value)) return `${formatNumber(value)} ${unit}`
  }

  return text
}

// ------------------------------------------------------------
// ۳.۶) قواعد باکت‌سازی مقدار به ازای ویژگی‌های استاندارد
// ------------------------------------------------------------
// هر قاعده فقط روی ویژگیِ *همان نام استاندارد* اثر می‌گذارد. اگر هیچ قاعده‌ای
// تطبیق نداد، در نهایت normalizeBucketValue عمومی اجرا می‌شود (هرگز حذف).
const countBucketRule = (suffix) => (text) => {
  const match = text.match(/(\d{1,4})/)
  return match ? `${Number(match[1])} ${suffix}` : null
}

const FACET_VALUE_RULES = [
  { labels: ['تعداد زون'], map: countBucketRule('زون') },
  { labels: ['تعداد رله'], map: countBucketRule('رله') },
  { labels: ['تعداد کانال'], map: countBucketRule('کانال') },
  { labels: ['تعداد کلید'], map: countBucketRule('کلید') },
  {
    labels: ['فرکانس کاری'],
    map: (text) => {
      if (/(مولتی|multi|250\s*تا\s*450)/iu.test(text)) return 'مولتی‌فرکانس'
      const ghz = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ghz|گیگاهرتز)/iu)
      if (ghz) return `${formatNumber(Number(ghz[1].replace(',', '.')))} گیگاهرتز`
      const mhz = text.match(/(\d+(?:[.,]\d+)?)\s*(?:mhz|مگاهرتز)/iu)
      // 433.92 MHz ⇒ 433 مگاهرتز (برش، نه گرد کردن — قرارداد فست‌های ترب)
      if (mhz) return `${formatNumber(Math.floor(Number(mhz[1].replace(',', '.'))))} مگاهرتز`
      return null
    },
  },
  {
    labels: ['نوع کددهی'],
    map: (text) => {
      if (/(هاپینگ|hopping|rolling|کد\s*متغیر)/iu.test(text)) return 'هاپینگ کد (Hopping)'
      if (/(learning|لرن|ev\s*1527|کد\s*آموزش)/iu.test(text)) return 'کد لرن (Learning)'
      if (/(بلوتوث|bluetooth|کپی|clone)/iu.test(text)) return 'بلوتوثی (کپی‌شونده)'
      return null
    },
  },
  {
    labels: ['رزولوشن تصویر', 'حداکثر رزولوشن ضبط'],
    map: (text) => {
      if (/(8\s*mp|4k|2160p)/iu.test(text)) return '8 مگاپیکسل (4K)'
      if (/(5\s*mp)/iu.test(text)) return '5 مگاپیکسل'
      if (/(4\s*mp|1440p|2k)/iu.test(text)) return '4 مگاپیکسل'
      if (/(2\s*mp|1080p|full\s*hd|2\s*مگاپیکسل)/iu.test(text)) return '2 مگاپیکسل'
      return null
    },
  },
  {
    labels: ['استاندارد حفاظتی'],
    map: (text) => {
      const match = text.match(/ip\s*(\d{2})/iu)
      return match ? `IP${match[1]}` : null
    },
  },
]

const findFacetRule = (label) => {
  const key = normCompareKey(label)
  return FACET_VALUE_RULES.find((rule) => rule.labels.some((candidate) => normCompareKey(candidate) === key)) || null
}

// جمله‌های توضیحی طولانی برای سایدبار مناسب نیستند (چیپ ۳ خطی می‌سازند)
const MAX_FACET_VALUE_CHARS = 45
const MAX_FACET_VALUE_WORDS = 7

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

// کلیدهایی که فقط مخصوص «جدول مشخصات فنی» صفحه محصول‌اند و نباید سایدبار
// فیلترها را شلوغ کنند. این‌ها در `specifications` ذخیره می‌شوند ولی وارد
// `properties` نمی‌شوند — مگر ادمین صراحتاً آن‌ها را در category.properties
// با isFilterable !== false تعریف کند (آن‌گاه isExplicitlyEnabledByAdmin
// بر این لیست مقدم است).
const SPEC_TABLE_ONLY_KEYS = [
  'مدت ضبط پیام', 'تعداد مدیران سیستم', 'حالت های قابل تعریف برای زون',
  'حالت‌های قابل تعریف برای زون', 'اقلام همراه', 'محتویات بسته', 'متعلقات نصب',
  'نکات نصب', 'دمای کاری', 'محدوده دمای کاری', 'رطوبت کاری', 'ابعاد', 'وزن',
  'وزن بسته بندی', 'وزن بسته‌بندی', 'گارانتی', 'مدت گارانتی', 'ضمانت', 'مدت ضمانت',
  'وضعیت کالا', 'اصالت کالا', 'مدل', 'نام محصول', 'تست سیستم', 'ثبت رویداد',
  'نام گذاری اجزا', 'نام‌گذاری اجزا', 'روش ریست خام سازی', 'روش ریست خام‌سازی',
  'روش کددهی', 'نشانگر وضعیت', 'طراحی خروجی صدا', 'حفاظت tamper', 'سیستم ضد دستکاری',
]

const NON_FILTERABLE_KEYS_BASE = new Set(
  [
    'description', 'توضیحات', 'تصویر', 'تصاویر', 'image', 'images', 'عکس',
    'بارکد', 'barcode', 'کد کالا', 'sku', 'شناسه', 'id', 'لینک', 'url',
    'نام', 'name', 'قیمت', 'price', 'موجودی', 'stock', 'وزن بسته‌بندی',
    'کد انبار', 'warehouse',
    ...SPEC_TABLE_ONLY_KEYS,
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
 * باکت‌سازی مخصوص فست‌ها (لایه‌ی دوم) با در نظر گرفتن طول جمله.
 *
 * خروجی:
 *  - `bucket`     : مقدار کوتاه و خوانا برای چیپ سایدبار (نیم‌فاصله حفظ می‌شود)
 *  - `filterable` : آیا این مقدار برای فست مناسب است؟
 *  - `ruleMatched`: آیا یک قاعده‌ی اختصاصی آن را باکت کرد؟
 *
 * قاعده‌ی طول: جمله‌ی توضیحی بیش از ۴۵ کاراکتر یا بیش از ۷ کلمه که با هیچ
 * قاعده‌ای باکت نشود، فقط در `specifications` می‌ماند و وارد سایدبار نمی‌شود.
 */
function normalizeFacetValue(label, rawValue) {
  const text = normalizeText(rawValue)
  if (!text) return { bucket: null, filterable: false, ruleMatched: false }

  const canonicalLabel = canonicalizeSpecLabel(label)

  // ۱) قاعده‌ی اختصاصی همان ویژگی
  const rule = findFacetRule(canonicalLabel)
  if (rule) {
    const mapped = rule.map(text)
    if (mapped) return { bucket: mapped, filterable: true, ruleMatched: true }
  }

  // ۲) فشرده‌ساز عمومی (پسوندهای توصیفی، پرانتز، تعداد/کمیت) سپس نرمال‌ساز
  const condensed = condenseDescriptiveValueToBucket(canonicalLabel, text)
  const bucket = normalizeBucketValue(canonicalLabel, condensed)
  if (!bucket) return { bucket: null, filterable: false, ruleMatched: false }

  const words = bucket.split(/\s+/).filter(Boolean).length
  const tooLong = bucket.length > MAX_FACET_VALUE_CHARS || words > MAX_FACET_VALUE_WORDS

  return { bucket, filterable: !tooLong && !isNonFilterableKey(canonicalLabel), ruleMatched: false }
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
  normalizeFacetValue,
  canonicalizeSpecLabel,
  condenseDescriptiveValueToBucket,
  isCoreIdentityKey,
  inferProductTypeFromText,
  PRODUCT_TYPE_PATTERNS,
  CORE_IDENTITY_LABELS,
  CORE_IDENTITY_KEYS,
  BUILTIN_KEY_SYNONYMS,
  SPEC_TABLE_ONLY_KEYS,
  MAX_FACET_VALUE_CHARS,
  MAX_FACET_VALUE_WORDS,
  bucketizeByThresholds,
  isNonFilterableKey,
  NON_FILTERABLE_KEYS_BASE,
  PREVIOUSLY_BLOCKED_KEYS,
  UNIT_TABLE,
  KEY_RULES,
}
