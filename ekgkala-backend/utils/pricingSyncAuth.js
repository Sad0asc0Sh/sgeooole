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
const DEFAULT_SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000

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

function getHeaderString(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined
  const raw = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(raw) ? raw[0] : raw
}

function canonicalizePricingSyncPayload(payload = {}) {
  let obj = payload
  if (typeof payload === 'string') {
    try {
      obj = JSON.parse(payload)
    } catch {
      return String(payload)
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return ''
  }
  const decisionId = obj.decisionId ?? obj.pricingMeta?.decisionId ?? null
  const idempotencyKey = obj.idempotencyKey ?? obj.pricingMeta?.idempotencyKey ?? null
  const canonical = {
    sku: String(obj.sku ?? '').trim(),
    productCode: String(obj.productCode ?? '').trim().toUpperCase(),
    productId: String(obj.productId ?? '').trim(),
    finalPrice: Number(obj.finalPrice ?? obj.price ?? 0),
    basePrice: Number(obj.basePrice ?? obj.compareAtPrice ?? obj.finalPrice ?? obj.price ?? 0),
    costPrice: Number(obj.costPrice ?? 0),
    hardFloorPrice: Number(obj.hardFloorPrice ?? 0),
    campaignType: String(obj.campaignType ?? 'none'),
    discount: Number(obj.discount ?? obj.timedSale?.discountPercentage ?? 0),
    decisionId: decisionId != null ? String(decisionId) : '',
    idempotencyKey: idempotencyKey != null ? String(idempotencyKey) : '',
  }
  return JSON.stringify(canonical)
}

function computePricingSyncSignature(secret, timestamp, payload = {}) {
  const ts = String(timestamp ?? '').trim()
  const canonical = canonicalizePricingSyncPayload(payload)
  return crypto.createHmac('sha256', String(secret)).update(`${ts}.${canonical}`, 'utf8').digest('hex')
}

function computeRawBodySignature(secret, timestamp, rawBody = '') {
  const ts = String(timestamp ?? '').trim()
  const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {})
  return crypto.createHmac('sha256', String(secret)).update(`${ts}.${bodyStr}`, 'utf8').digest('hex')
}

function parseTimestampMs(rawTs) {
  if (rawTs === undefined || rawTs === null || rawTs === '') return NaN
  const str = String(rawTs).trim()
  if (/^\d+$/.test(str)) {
    const num = Number(str)
    // اگر ثانیه یونیکس (۱۰ رقمی) ارسال شده بود به میلی‌ثانیه تبدیل شود
    return num < 1e12 ? num * 1000 : num
  }
  return Date.parse(str)
}

function verifyPricingSyncSignature(headers, body = {}, env = process.env, nowMs = Date.now()) {
  const expected = getExpectedSecret(env)
  if (!expected || isPlaceholderSecret(expected)) {
    if (devOpenAllowed(env)) return { ok: true, devOpen: true }
    return {
      ok: false,
      status: 503,
      code: 'PRICING_SYNC_NOT_CONFIGURED',
      message: 'کلید امنیتی همگام‌سازی قیمت روی سرور تنظیم نشده است',
    }
  }

  const requireHmac = ['true', '1'].includes(String(env.PRICING_SYNC_REQUIRE_HMAC || '').trim().toLowerCase())
  const rawSig = getHeaderString(headers, 'x-pricing-signature')
  const rawTs = getHeaderString(headers, 'x-pricing-timestamp')

  if (!rawSig && !requireHmac) {
    return { ok: true }
  }

  if (typeof rawSig !== 'string' || rawSig.trim().length === 0) {
    return {
      ok: false,
      status: 401,
      code: 'PRICING_SYNC_SIGNATURE_REQUIRED',
      message: 'امضای دیجیتال همگام‌سازی قیمت (X-Pricing-Signature) الزامی است',
    }
  }

  const tsMs = parseTimestampMs(rawTs)
  const maxSkewMs = Number(env.PRICING_SYNC_MAX_SKEW_MS) > 0 ? Number(env.PRICING_SYNC_MAX_SKEW_MS) : DEFAULT_SIGNATURE_MAX_SKEW_MS
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > maxSkewMs) {
    return {
      ok: false,
      status: 401,
      code: 'PRICING_SYNC_TIMESTAMP_EXPIRED',
      message: 'برچسب زمان درخواست همگام‌سازی قیمت (X-Pricing-Timestamp) نامعتبر یا منقضی شده است',
    }
  }

  const cleanedSig = rawSig.trim().replace(/^sha256=/i, '').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(cleanedSig)) {
    return {
      ok: false,
      status: 401,
      code: 'PRICING_SYNC_INVALID_SIGNATURE',
      message: 'فرمت امضای دیجیتال همگام‌سازی قیمت (X-Pricing-Signature) نامعتبر است',
    }
  }

  const expectedCanonicalSig = computePricingSyncSignature(expected, String(rawTs).trim(), body)
  const expectedRawSig = computeRawBodySignature(expected, String(rawTs).trim(), body)

  if (!timingSafeEqualString(cleanedSig, expectedCanonicalSig) && !timingSafeEqualString(cleanedSig, expectedRawSig)) {
    return {
      ok: false,
      status: 401,
      code: 'PRICING_SYNC_INVALID_SIGNATURE',
      message: 'امضای دیجیتال همگام‌سازی قیمت (X-Pricing-Signature) با محتوای درخواست مطابقت ندارد',
    }
  }

  return { ok: true, hmacVerified: true }
}

let warnedWeak = false

/**
 * @param {Record<string, string | string[] | undefined>} headers  req.headers
 * @param {Record<string, string | undefined>} [env]
 * @param {unknown} [body]
 * @returns {{ ok: true, devOpen?: boolean, hmacVerified?: boolean } | { ok: false, status: number, code: string, message: string }}
 */
function authorizePricingSync(headers, env = process.env, body = undefined) {
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

  if (body !== undefined || getHeaderString(headers, 'x-pricing-signature') !== undefined || ['true', '1'].includes(String(env.PRICING_SYNC_REQUIRE_HMAC || '').trim().toLowerCase())) {
    const sigCheck = verifyPricingSyncSignature(headers, body ?? {}, env)
    if (!sigCheck.ok) return sigCheck
    if (sigCheck.hmacVerified) return { ok: true, hmacVerified: true }
  }

  return { ok: true }
}

module.exports = {
  authorizePricingSync,
  verifyPricingSyncSignature,
  computePricingSyncSignature,
  computeRawBodySignature,
  canonicalizePricingSyncPayload,
  getExpectedSecret,
  isPlaceholderSecret,
  timingSafeEqualString,
}
