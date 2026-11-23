// ۴.۲.۱ — pricing-sync: اولویت شناسه‌ها (جلوگیری از نوشتن قیمت روی محصول دیگر)، رد صریح محصول متغیر،
// و «قیمت مؤثر» برای تأیید حلقه‌بسته. بدون دیتابیس: مدل جعلی با رابط find/findOne/select/lean/limit.
const assert = require('node:assert/strict')
const test = require('node:test')

const {
  resolvePricingSyncProduct,
  describeEffectivePrice,
  validatePricingSyncPayload,
} = require('../services/competitivePricingSyncService')
const { getPricing, getCanonicalVariant } = require('../utils/torobMapper')

const ID_A = '507f1f77bcf86cd799439011'
const ID_B = '507f1f77bcf86cd799439012'

function makeQuery(result) {
  const q = {
    select: () => q,
    lean: () => q,
    limit: (n) => makeQuery(Array.isArray(result) ? result.slice(0, n) : result),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  }
  return q
}
function fakeModel(docs) {
  const match = (d, f) => Object.entries(f).every(([k, v]) => String(d[k]) === String(v))
  return {
    findOne: (f) => makeQuery(docs.find((d) => match(d, f)) || null),
    find: (f) => makeQuery(docs.filter((d) => match(d, f))),
  }
}
const apply = (q) => q.select('+costPrice').lean()

const A = { _id: ID_A, productCode: 'KY-0000001', sku: 'DH-2MP', name: 'A' }
const B = { _id: ID_B, productCode: 'KY-0000002', sku: 'DH-2MP', name: 'B' } // sku تکراری (مدل sku را یکتا نمی‌کند)
const C = { _id: '507f1f77bcf86cd799439013', productCode: 'KY-0000003', sku: 'UNIQ-1', name: 'C' }

test('R1. productId معتبر ← همان محصول', async () => {
  const r = await resolvePricingSyncProduct(fakeModel([A, B, C]), { productId: ID_B, sku: 'DH-2MP' }, apply)
  assert.equal(r.product.name, 'B')
  assert.equal(r.matchedBy, 'productId')
})

test('R2. productCode (حروف کوچک هم) ← حتی اگر sku بین دو محصول مشترک باشد، محصول درست پیدا می‌شود', async () => {
  const r = await resolvePricingSyncProduct(fakeModel([B, A, C]), { productCode: 'ky-0000001', sku: 'DH-2MP' }, apply)
  assert.equal(r.product.name, 'A')
  assert.equal(r.matchedBy, 'productCode')
})

test('R3. فقط sku و sku تکراری ⇒ ۴۰۹ AMBIGUOUS_SKU (قبلاً اولین سند $or می‌گرفت و قیمت می‌توانست روی محصول دیگر بنشیند)', async () => {
  const r = await resolvePricingSyncProduct(fakeModel([B, A, C]), { sku: 'DH-2MP' }, apply)
  assert.equal(r.product, undefined)
  assert.equal(r.status, 409)
  assert.equal(r.code, 'AMBIGUOUS_SKU')
})

test('R4. productId و productCode به دو محصول متفاوت ⇒ ۴۰۹ IDENTIFIER_MISMATCH', async () => {
  const r = await resolvePricingSyncProduct(fakeModel([A, B]), { productId: ID_A, productCode: 'KY-0000002' }, apply)
  assert.equal(r.status, 409)
  assert.equal(r.code, 'IDENTIFIER_MISMATCH')
})

test('R5. سازگاری: شناسهٔ قوی پیدا نشود ولی sku یکتا باشد ⇒ با sku پیدا می‌شود', async () => {
  const r = await resolvePricingSyncProduct(fakeModel([A, B, C]), { productCode: 'KY-9999999', sku: 'UNIQ-1' }, apply)
  assert.equal(r.product.name, 'C')
  assert.equal(r.matchedBy, 'sku')
})

test('R6. بدون شناسه ⇒ ۴۰۰؛ ناشناس ⇒ ۴۰۴؛ productId غیر-ObjectId نادیده گرفته می‌شود', async () => {
  const m = fakeModel([A, B, C])
  const none = await resolvePricingSyncProduct(m, {}, apply)
  assert.equal(none.status, 400)
  assert.equal(none.code, 'MISSING_PRODUCT_IDENTIFIER', 'کد خطا باید با قرارداد قبلی اندپوینت یکی بماند (موتور روی code شاخه می‌زند)')
  assert.equal((await resolvePricingSyncProduct(m, { sku: 'NOPE' }, apply)).status, 404)
  assert.equal((await resolvePricingSyncProduct(m, { productCode: 'KY-404' }, apply)).status, 404)
  const r = await resolvePricingSyncProduct(m, { productId: 'KY-0000003', sku: 'UNIQ-1' }, apply)
  assert.equal(r.product.name, 'C')
})

test('V1. محصول متغیر در pricing-sync صریحاً رد می‌شود؛ محصول ساده دست‌نخورده می‌ماند', () => {
  const payload = { finalPrice: 2435000, basePrice: 2435000, costPrice: 2320000, hardFloorPrice: 2402000 }
  const v = validatePricingSyncPayload(payload, { productType: 'variable', variants: [{ price: 3000000, stock: 1 }] })
  assert.equal(v.valid, false)
  assert.equal(v.code, 'VARIABLE_PRODUCT_UNSUPPORTED')
  const s = validatePricingSyncPayload(payload, { productType: 'simple' })
  assert.equal(s.valid, true)
  const n = validatePricingSyncPayload(payload, null)
  assert.equal(n.valid, true)
})

const DEPS = { getPricing, getCanonicalVariant }
const NOW = new Date('2026-10-14T08:00:00Z')
const noCampaign = { campaignMap: new Map(), categoryDiscountMap: new Map() }

test('E1. محصول ساده: قیمت مؤثر = قیمتِ اعمال‌شده', () => {
  const p = { _id: ID_A, productType: 'simple', isActive: true, price: 2435000, stock: 3, pricingMeta: { exactFloorPrice: 2435000, exactFloorPriceAt: NOW } }
  const e = describeEffectivePrice(p, noCampaign, DEPS, NOW)
  assert.equal(e.currentPrice, 2435000)
  assert.equal(e.source, 'product')
})

test('E2. محصول متغیر: قیمتِ Product.price روی قیمت مشتری/ترب اثری ندارد (قیمت از تنوع کانونیکال می‌آید)', () => {
  const p = {
    _id: ID_A, productType: 'variable', isActive: true,
    price: 2435000, // چیزی که موتور می‌فرستاد
    variants: [
      { _id: ID_A, price: 3100000, stock: 2, options: [{ name: 'رنگ', value: 'آبی' }] },
      { _id: ID_B, price: 3300000, stock: 5, options: [{ name: 'رنگ', value: 'قرمز' }] },
    ],
  }
  const e = describeEffectivePrice(p, noCampaign, DEPS, NOW)
  assert.equal(e.source, 'canonical_variant')
  assert.equal(e.currentPrice, 3100000)
  assert.notEqual(e.currentPrice, p.price, 'قیمت مؤثر با قیمت ارسالی موتور فرق دارد ⇒ بدون اصلاح «اعمال‌شده ولی بی‌اثر» بود')
})

test('E3. کمپین فعال دستی (Sale) روی محصول ساده: قیمت مؤثر نباید زیر کف قطعی موتور برود', () => {
  const p = { _id: ID_A, productType: 'simple', isActive: true, price: 2435000, stock: 3, category: 'cat1', pricingMeta: { exactFloorPrice: 2435000, exactFloorPriceAt: NOW } }
  const ctx = { campaignMap: new Map(), categoryDiscountMap: new Map([['cat1', { name: 'حراج دستی', discount: 15, theme: 'red-purple', endDate: new Date(NOW.getTime() + 86400000) }]]) }
  const e = describeEffectivePrice(p, ctx, DEPS, NOW)
  assert.ok(e.currentPrice >= 2435000, `قیمت مؤثر ${e.currentPrice} زیر کف قطعی رفته است`)
})

// ----- قرارداد مسیر (route) — بدون mongoose قابل بارگذاری نیست؛ پس «سرتاسر» را با خواندن منبع نگه می‌داریم تا یک merge
// آینده بی‌صدا اصلاحات ۴.۲.۱ را حذف نکند. رفتار واقعی بالا (R*/V*/E*) آزموده شده است.
const fs = require('node:fs')
const path = require('node:path')
const routeSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products.js'), 'utf8')
const syncRoute = routeSrc.slice(routeSrc.indexOf("router.post('/pricing-sync'"))

test('S1. مسیر pricing-sync از resolver با اولویت شناسه استفاده می‌کند، نه $or خام', () => {
  assert.ok(syncRoute.includes('resolvePricingSyncProduct('), 'resolver باید فراخوانی شود')
  assert.ok(!/findOne\(\s*\{\s*\$or\s*:/.test(syncRoute), 'جست‌وجوی $or بدون اولویت نباید برگردد')
})

test('S2. پاسخ موفقِ اعمال effective و effectiveMismatch را برمی‌گرداند', () => {
  const tail = syncRoute.slice(syncRoute.indexOf('const effective = await computeEffective(updated)'))
  assert.ok(tail.length > 0, 'محاسبهٔ effective پس از به‌روزرسانی باید وجود داشته باشد')
  assert.ok(/\beffective,\s*\n\s*effectiveMismatch,/.test(tail), 'اعمال تازه: effective و effectiveMismatch')
})

test('S3. پاسخ pricing-sync هیچ فیلد حساس (قیمت خرید/کف/تأمین‌کننده) برنمی‌گرداند', () => {
  const successShape = syncRoute.slice(syncRoute.indexOf('const effective = await computeEffective(updated)'))
  for (const forbidden of ['costPrice', 'hardFloorPrice', 'supplierQuotes']) {
    assert.ok(!new RegExp('data:\\s*\\{[^}]*' + forbidden).test(successShape), `${forbidden} نباید در data پاسخ باشد`)
  }
})
