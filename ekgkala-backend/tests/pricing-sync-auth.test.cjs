const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const {
  authorizePricingSync,
  isPlaceholderSecret,
  timingSafeEqualString,
} = require('../utils/pricingSyncAuth')

const STRONG = 'k9Qz-Lm3vXp7-Rt2WuYb-8NcHs4Dj1A'

test('۱. fail-closed: بدون کلید پیکربندی‌شده روی سرور، اندپوینت تغییر قیمت باز نیست (۵۰۳)', () => {
  for (const env of [{}, { SGEOOOLE_PRICING_SECRET: '' }, { STORE_WEBHOOK_SECRET: '   ' }, { NODE_ENV: 'production' }]) {
    const r = authorizePricingSync({}, env)
    assert.equal(r.ok, false)
    assert.equal(r.status, 503)
    assert.equal(r.code, 'PRICING_SYNC_NOT_CONFIGURED')
    // حتی اگر مهاجم هدر خالی یا هر مقدار دیگری بفرستد
    const r2 = authorizePricingSync({ 'x-pricing-secret': 'anything' }, env)
    assert.equal(r2.ok, false)
    assert.equal(r2.status, 503)
  }
})

test('۲. مقدار نمونهٔ CHANGE_ME (از .env.example) به‌منزلهٔ «تنظیم‌نشده» است و پذیرفته نمی‌شود', () => {
  for (const v of ['CHANGE_ME', 'change_me', 'ChangeMe', 'secret', 'password']) {
    assert.equal(isPlaceholderSecret(v), true, v)
    const r = authorizePricingSync({ 'x-pricing-secret': v }, { SGEOOOLE_PRICING_SECRET: v })
    assert.equal(r.ok, false)
    assert.equal(r.status, 503)
  }
  assert.equal(isPlaceholderSecret(STRONG), false)
})

test('۳. کلید درست پذیرفته می‌شود؛ کلید غلط/خالی/ناقص/بلند ۴۰۱ است', () => {
  const env = { SGEOOOLE_PRICING_SECRET: STRONG }
  assert.deepEqual(authorizePricingSync({ 'x-pricing-secret': STRONG }, env), { ok: true })

  for (const bad of ['', 'wrong', STRONG + 'x', STRONG.slice(0, -1), STRONG.toUpperCase(), 'x'.repeat(5000), undefined, 123, null]) {
    const r = authorizePricingSync({ 'x-pricing-secret': bad }, env)
    assert.equal(r.ok, false, String(bad).slice(0, 20))
    assert.equal(r.status, 401)
    assert.equal(r.code, 'PRICING_SYNC_UNAUTHORIZED')
  }
  // هدر غایب
  assert.equal(authorizePricingSync({}, env).status, 401)
  assert.equal(authorizePricingSync(undefined, env).status, 401)
})

test('۴. هدر تکراری (آرایه): فقط اولین مقدار بررسی می‌شود و تزریق مقدار دوم کمکی نمی‌کند', () => {
  const env = { SGEOOOLE_PRICING_SECRET: STRONG }
  assert.equal(authorizePricingSync({ 'x-pricing-secret': ['wrong', STRONG] }, env).ok, false)
  assert.equal(authorizePricingSync({ 'x-pricing-secret': [STRONG, 'wrong'] }, env).ok, true)
})

test('۵. جایگزین STORE_WEBHOOK_SECRET هنوز کار می‌کند (سازگاری با پیکربندی قبلی) و SGEOOOLE_PRICING_SECRET مقدم است', () => {
  assert.equal(authorizePricingSync({ 'x-pricing-secret': STRONG }, { STORE_WEBHOOK_SECRET: STRONG }).ok, true)
  const both = { SGEOOOLE_PRICING_SECRET: STRONG, STORE_WEBHOOK_SECRET: 'other-secret-value-0123456789' }
  assert.equal(authorizePricingSync({ 'x-pricing-secret': STRONG }, both).ok, true)
  assert.equal(authorizePricingSync({ 'x-pricing-secret': 'other-secret-value-0123456789' }, both).ok, false)
})

test('۶. تنها راه عبور بدون کلید: NODE_ENV=development|test همراه با PRICING_SYNC_ALLOW_UNAUTHENTICATED=true', () => {
  const flag = { PRICING_SYNC_ALLOW_UNAUTHENTICATED: 'true' }
  assert.deepEqual(authorizePricingSync({}, { ...flag, NODE_ENV: 'development' }), { ok: true, devOpen: true })
  assert.deepEqual(authorizePricingSync({}, { ...flag, NODE_ENV: 'test' }), { ok: true, devOpen: true })
  // production یا تنظیم‌نشدهٔ NODE_ENV هرگز باز نمی‌شود، حتی با فلگ
  assert.equal(authorizePricingSync({}, { ...flag, NODE_ENV: 'production' }).ok, false)
  assert.equal(authorizePricingSync({}, { ...flag }).ok, false)
  // بدون فلگ در development هم بسته است
  assert.equal(authorizePricingSync({}, { NODE_ENV: 'development' }).ok, false)
  // وقتی کلید تنظیم شده، فلگ توسعه اثری ندارد و کلید الزامی است
  assert.equal(authorizePricingSync({}, { ...flag, NODE_ENV: 'development', SGEOOOLE_PRICING_SECRET: STRONG }).ok, false)
})

test('۷. timingSafeEqualString: رفتار درست برای طول‌های متفاوت (بدون استثنا) و یونیکد', () => {
  assert.equal(timingSafeEqualString('a', 'a'), true)
  assert.equal(timingSafeEqualString('a', 'ab'), false)
  assert.equal(timingSafeEqualString('', ''), true)
  assert.equal(timingSafeEqualString('کلید-فارسی', 'کلید-فارسی'), true)
  assert.equal(timingSafeEqualString('کلید-فارسی', 'کلید-فارسه'), false)
})

test('۸. رگرسیون منبع: مسیر pricing-sync از authorizePricingSync استفاده می‌کند و الگوی fail-open قدیمی برنگشته است', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products.js'), 'utf8')
  const start = src.indexOf("router.post('/pricing-sync'")
  assert.ok(start > 0, 'مسیر pricing-sync پیدا نشد')
  const handler = src.slice(start, start + 1500)
  assert.ok(handler.includes('authorizePricingSync(req.headers)'))
  assert.ok(!/expectedSecret\s*&&/.test(handler), 'الگوی fail-open (expectedSecret && …) نباید برگردد')
  assert.ok(!/incomingSecret\s*!==\s*expectedSecret/.test(handler), 'مقایسهٔ غیرزمان‌ثابت نباید برگردد')
})
