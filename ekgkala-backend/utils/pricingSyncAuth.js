/**
 * احراز هویت اندپوینت POST /api/products/pricing-sync (سامانهٔ قیمت‌گذاری رقابتی → فروشگاه)
 *
 * مشکل نسخهٔ قبلی:
 *   if (expectedSecret && incomingSecret !== expectedSecret) → 401
 * یعنی اگر متغیر محیطی SGEOOOLE_PRICING_SECRET / STORE_WEBHOOK_SECRET تنظیم نشده بود، شرط اصلاً بررسی نمی‌شد و
 * اندپوینتی که قیمت فروش و کمپین‌های تخفیف را تغییر می‌دهد «برای همهٔ اینترنت باز» بود (fail-open).
 * مقایسهٔ رشته‌ای معمولی (!==) هم زمان‌ثابت نبود.
 *
 * رفتار جدید:
 *  1) fail-closed: بدون کلید معتبر پیکربندی‌شده (یا با مقدار نمونهٔ CHANGE_ME) پاسخ 503 داده می‌شود.
 *  2) مقایسهٔ زمان‌ثابت (SHA-256 هر دو طرف + crypto.timingSafeEqual) تا طول/محتوای کلید از زمان پاسخ لو نرود.
 *  3) تنها راه عبور بدون کلید: NODE_ENV برابر development یا test و PRICING_SYNC_ALLOW_UNAUTHENTICATED=true
 *     (برای توسعهٔ محلی)؛ در production هرگز.
 *
 * این فایل عمداً بدون وابستگی به Express/Mongoose است تا واحد‌آزمون‌پذیر باشد.
 */

const crypto = require('crypto')

const PLACEHOLDER_SECRETS = new Set(['', 'change_me', 'changeme', 'change-me', 'secret', 'password', 'your_secret_here'])
const MIN_RECOMMENDED_LENGTH = 24

function getExpectedSecret(env = process.env) {
  return String(env.SGEOOOLE_PRICING_SECRET || env.STORE_WEBHOOK_SECRET || '').trim()
}

function isPlaceholderSecret(secret) {
  return PLACEHOLDER_SECRETS.has(String(secret || '').trim().toLowerCase())
}

function timingSafeEqualString(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest()
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest()
  return crypto.timingSafeEqual(ha, hb)
}

function devOpenAllowed(env) {
  const flag = String(env.PRICING_SYNC_ALLOW_UNAUTHENTICATED || '').trim().toLowerCase()
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase()
  return (flag === 'true' || flag === '1') && (nodeEnv === 'development' || nodeEnv === 'test')
}

let warnedWeak = false

/**
 * @param {Record<string, string | string[] | undefined>} headers  req.headers
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ ok: true, devOpen?: boolean } | { ok: false, status: number, code: string, message: string }}
 */
function authorizePricingSync(headers, env = process.env) {
  const expected = getExpectedSecret(env)

  if (!expected || isPlaceholderSecret(expected)) {
    if (devOpenAllowed(env)) return { ok: true, devOpen: true }
    return {
      ok: false,
      status: 503,
      code: 'PRICING_SYNC_NOT_CONFIGURED',
      message:
        'همگام‌سازی قیمت غیرفعال است: کلید امنیتی (SGEOOOLE_PRICING_SECRET) روی سرور فروشگاه تنظیم نشده یا هنوز مقدار نمونه (CHANGE_ME) است',
    }
  }

  if (!warnedWeak && expected.length < MIN_RECOMMENDED_LENGTH) {
    warnedWeak = true
    console.warn(
      `[pricing-sync] کلید همگام‌سازی کوتاه است (${expected.length} نویسه)؛ حداقل ${MIN_RECOMMENDED_LENGTH} نویسهٔ تصادفی توصیه می‌شود`,
    )
  }

  const raw = headers ? headers['x-pricing-secret'] : undefined
  const incoming = Array.isArray(raw) ? raw[0] : raw
  if (typeof incoming !== 'string' || incoming.length === 0 || incoming.length > 512) {
    return { ok: false, status: 401, code: 'PRICING_SYNC_UNAUTHORIZED', message: 'کلید امنیتی همگام‌سازی قیمت (X-Pricing-Secret) نامعتبر است' }
  }

  if (!timingSafeEqualString(incoming, expected)) {
    return { ok: false, status: 401, code: 'PRICING_SYNC_UNAUTHORIZED', message: 'کلید امنیتی همگام‌سازی قیمت (X-Pricing-Secret) نامعتبر است' }
  }

  return { ok: true }
}

module.exports = {
  authorizePricingSync,
  getExpectedSecret,
  isPlaceholderSecret,
  timingSafeEqualString,
}
