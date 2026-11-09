/**
 * فیلتر خروجی مرکزی برای فیلدهای محرمانهٔ قیمت‌گذاری (۴.۲.۰)
 *
 * مشکل: سامانهٔ قیمت‌گذاری رقابتی قیمت تمام‌شده (`costPrice`)، کف سود (`hardFloorPrice`) و لیست قیمت همکاران
 * (`supplierQuotes`: نام تامین‌کننده + قیمت خرید) را روی سند محصول ذخیره می‌کند، ولی هیچ لایه‌ای جلوی بازگشتِ آن‌ها
 * در پاسخ‌های عمومی را نمی‌گرفت: GET /api/products، /api/products/:id، /api/products/code/:code (و ?skipDiscount=true)
 * کل سند را برمی‌گرداندند؛ یعنی هر بازدیدکننده یا رقیبی می‌توانست حاشیهٔ سود و تامین‌کنندگان فروشگاه را بخواند.
 *
 * راه‌حل (defense in depth):
 *  1) این میان‌افزار: روی `res.json` تمام مسیرهای /api، کلیدهای محرمانه را در هر عمقی حذف می‌کند (بدون تغییر ورودی).
 *  2) مدل Product: این سه فیلد `select: false` هستند (کوئری‌های Mongoose آن‌ها را به‌صورت پیش‌فرض نمی‌خوانند).
 *  3) پایپ‌لاین لیست محصولات (aggregate) آن‌ها را صریحاً $project می‌کند.
 *
 * فیلدهای غیرمحرمانهٔ pricingMeta (exactFloorPrice، badgeTheme، …) که منطق کف قطعی و نمایش به آن‌ها نیاز دارد دست‌نخورده می‌ماند؛
 * فقط کلید `hardFloorPrice` داخل آن حذف می‌شود (کلید عام در هر عمق).
 */

/** کلیدهایی که هرگز نباید در پاسخ عمومی بیایند (در هر عمقی) */
const SECRET_KEYS = new Set(['costPrice', 'hardFloorPrice', 'supplierQuotes', 'replacementCost', 'effectiveCostPrice'])

const MAX_DEPTH = 24

/**
 * نسخهٔ پاک‌سازی‌شدهٔ مقدار را برمی‌گرداند (ورودی دست نمی‌خورد).
 * - اسناد Mongoose / ObjectId / Date با toJSON خودشان به مقدار ساده تبدیل می‌شوند (همان کاری که JSON.stringify می‌کند).
 * - ساختارهای حلقوی یا بسیار عمیق بدون خطا رها می‌شوند (JSON.stringify خودش خطا می‌دهد).
 */
function stripSecretFields(value, seen = new WeakSet(), depth = 0) {
  if (value === null || typeof value !== 'object') return value
  if (depth > MAX_DEPTH) return value
  if (seen.has(value)) return value
  seen.add(value)

  let v = value
  if (typeof v.toJSON === 'function') {
    try {
      v = v.toJSON()
    } catch {
      v = value
    }
    if (v === null || typeof v !== 'object') {
      seen.delete(value)
      return v
    }
  }

  let out
  if (Array.isArray(v)) {
    out = v.map((item) => stripSecretFields(item, seen, depth + 1))
  } else {
    out = {}
    for (const key of Object.keys(v)) {
      if (SECRET_KEYS.has(key)) continue
      // JSON.stringify هم تابع‌ها را نادیده می‌گیرد؛ تابعِ باقی‌مانده (مثل toJSON خراب) نباید به خروجی برسد
      if (typeof v[key] === 'function') continue
      out[key] = stripSecretFields(v[key], seen, depth + 1)
    }
  }
  seen.delete(value)
  return out
}

/** آیا درخواست از یک تماس داخلی مورد اعتماد است که عمداً فیلدها را می‌خواهد؟ (فعلاً هیچ مسیری نیاز ندارد) */
const isInternalAllowed = (req) => Boolean(req && req.__allowInternalPricingFields === true)

function hideInternalPricingFields(req, res, next) {
  const originalJson = res.json.bind(res)
  res.json = (payload) => {
    if (isInternalAllowed(req)) return originalJson(payload)
    let safe
    try {
      safe = stripSecretFields(payload)
    } catch (err) {
      // هرگز با خطای فیلتر، داده‌ی خام را نفرست
      console.error('[hideInternalPricingFields] sanitize failed:', err && err.message)
      res.status(500)
      return originalJson({ success: false, message: 'خطای سرور' })
    }
    return originalJson(safe)
  }
  next()
}

module.exports = {
  hideInternalPricingFields,
  stripSecretFields,
  SECRET_KEYS,
}
