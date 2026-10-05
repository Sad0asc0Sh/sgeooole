// تست‌های قرارداد مرکزی قیمت (price contract) — آفلاین، بدون MongoDB واقعی
// پوشش: resolveBasePrice، computeItemPricing، applyDiscountToObject،
// sanitizeCompareAtPrice و همسانی resolveBasePrice با pipeline مونگو (mingo)
const assert = require('node:assert/strict')
const test = require('node:test')
const mongoose = require('mongoose')
require('mingo/init/system')
const { aggregate } = require('mingo')

const {
  resolveBasePrice,
  applyDiscountToObject,
  sanitizeCompareAtPrice,
  sanitizeVariantsCompareAtPrice,
  computeItemPricing,
} = require('../services/pricingService')
const { parseListingQuery, buildListingPipeline } = require('../services/productListingService')

const now = new Date('2026-09-17T12:00:00Z')
const id = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'))

// ---------------------------------------------------------------- resolveBasePrice
test('resolveBasePrice: مبنای تخفیف همیشه price است؛ compare کهنه مبنا نیست', () => {
  // مثال اصلی: دو رله سیم کارتی بتا — ۴٬۸۰۰٬۰۰۰ / ۳۰٬۰۰۰٬۰۰۰
  assert.equal(resolveBasePrice(4800000, 30000000, 0), 4800000)
  // تخفیف کمپین برای تشخیص داده‌ی قدیمی استفاده نمی‌شود
  assert.equal(resolveBasePrice(4800000, 30000000, 6), 4800000)
})

test('resolveBasePrice: داده‌ی قدیمیِ از قبل تخفیف‌خورده (legacy)', () => {
  // price=800 دقیقاً همان 1000 × (1 − 20/100) است
  assert.equal(resolveBasePrice(800, 1000, 20), 1000)
  // بدون تخفیف ثبت‌شده، رابطه قابل بررسی نیست
  assert.equal(resolveBasePrice(800, 1000, 0), 800)
  // تخفیف ۱۰٪ با رابطه سازگار نیست
  assert.equal(resolveBasePrice(800, 1000, 10), 800)
})

test('resolveBasePrice: تلرانس رُند شدن (±۱ تومان)', () => {
  // 1000000 × 0.8 = 800000 → اختلاف ۱ قابل قبول
  assert.equal(resolveBasePrice(799999, 1000000, 20), 1000000)
  // اختلاف ۲ دیگر legacy نیست
  assert.equal(resolveBasePrice(799998, 1000000, 20), 799998)
})

test('resolveBasePrice: حالت‌های مرزی', () => {
  // price صفر/نامعتبر: رفتار قبلی max حفظ می‌شود
  assert.equal(resolveBasePrice(0, 5000, 0), 5000)
  assert.equal(resolveBasePrice(-100, 5000, 0), 5000)
  // compareAtPrice کمتر یا مساوی قیمت: نادیده گرفته می‌شود
  assert.equal(resolveBasePrice(5000, 3000, 0), 5000)
  assert.equal(resolveBasePrice(5000, 5000, 0), 5000)
  // مقادیر نامعتبر
  assert.equal(resolveBasePrice(undefined, 30000000, 0), 30000000)
  assert.equal(resolveBasePrice(4800000, undefined, 0), 4800000)
})

// ---------------------------------------------------------------- computeItemPricing
const campaignCtx = (productId, discount, name = 'تخفیفات پاییزه') => ({
  campaignMap: new Map([[String(productId), { name, discount, theme: 'green-orange', endDate: new Date('2026-10-01') }]]),
  categoryDiscountMap: new Map(),
})

test('computeItemPricing: مثال اصلی با کمپین ۶٪ → ۴٬۵۱۲٬۰۰۰', () => {
  const pid = id(1)
  const item = { product: { _id: pid, productType: 'simple', price: 4800000, compareAtPrice: 30000000, discount: 0 } }
  const pricing = computeItemPricing(item, now, campaignCtx(pid, 6))
  assert.equal(pricing.basePrice, 4800000)
  assert.equal(pricing.finalPrice, 4512000)
  assert.equal(pricing.discount, 6)
  assert.equal(pricing.campaignLabel, 'تخفیفات پاییزه')
})

test('computeItemPricing: همان محصول بدون تخفیف → ۴٬۸۰۰٬۰۰۰ بدون oldPrice جعلی', () => {
  const item = { product: { productType: 'simple', price: 4800000, compareAtPrice: 30000000, discount: 0 } }
  const pricing = computeItemPricing(item, now)
  assert.equal(pricing.finalPrice, 4800000)
  assert.equal(pricing.basePrice, 4800000)
  assert.equal(pricing.discount, 0)
})

test('computeItemPricing: legacy با پیشنهاد لحظه‌ای فعال → ۸۰۰ با مبنای ۱۰۰۰ (بدون پیشنهاد → ۱۰۰۰ و تخفیف ۰)', () => {
  const future = new Date('2026-09-18T00:00:00Z')
  const itemActive = { product: { productType: 'simple', price: 800, compareAtPrice: 1000, discount: 20, isFlashDeal: true, flashDealEndTime: future } }
  const pricingActive = computeItemPricing(itemActive, now)
  assert.equal(pricingActive.basePrice, 1000)
  assert.equal(pricingActive.finalPrice, 800)
  assert.equal(pricingActive.discount, 20)

  // بدون پیشنهاد لحظه‌ای/شگفت‌انگیز: تخفیف اعمال نمی‌شود و قیمت پایه حفظ می‌شود
  const itemInactive = { product: { productType: 'simple', price: 800, compareAtPrice: 1000, discount: 20 } }
  const pricingInactive = computeItemPricing(itemInactive, now)
  assert.equal(pricingInactive.basePrice, 1000)
  assert.equal(pricingInactive.finalPrice, 1000)
  assert.equal(pricingInactive.discount, 0)
})

test('computeItemPricing: legacy با کمپین ۱۰٪ → ۹۰۰ با مبنای ۱۰۰۰', () => {
  const pid = id(2)
  const item = { product: { _id: pid, productType: 'simple', price: 800, compareAtPrice: 1000, discount: 20 } }
  const pricing = computeItemPricing(item, now, campaignCtx(pid, 10))
  assert.equal(pricing.basePrice, 1000)
  assert.equal(pricing.finalPrice, 900)
  assert.equal(pricing.discount, 10)
})

test('computeItemPricing: تخفیف زمان‌دار منقضی + compare کهنه → برگشت به price', () => {
  const item = {
    product: {
      productType: 'simple', price: 4800000, compareAtPrice: 30000000, discount: 6,
      isSpecialOffer: true, specialOfferEndTime: new Date('2026-09-01T00:00:00Z'),
    },
  }
  const pricing = computeItemPricing(item, now)
  assert.equal(pricing.finalPrice, 4800000)
  assert.equal(pricing.discount, 0)
})

test('computeItemPricing: واریانت با compare کهنه — مبنا price همان واریانت', () => {
  const pid = id(3)
  const variantOptions = [{ name: 'رنگ', value: 'مشکی' }]
  const item = {
    product: {
      _id: pid, productType: 'variable', price: 0, compareAtPrice: 0, discount: 0,
      variants: [{ price: 4800000, compareAtPrice: 30000000, stock: 5, options: variantOptions }],
    },
    variantOptions,
  }
  const pricing = computeItemPricing(item, now, campaignCtx(pid, 6))
  assert.equal(pricing.basePrice, 4800000)
  assert.equal(pricing.finalPrice, 4512000)
})

test('computeItemPricing: price=0 و تخفیف ۱۰۰٪ با پیشنهاد فعال', () => {
  const future = new Date('2026-09-18T00:00:00Z')
  const item = { product: { productType: 'simple', price: 0, compareAtPrice: 5000, discount: 100, isFlashDeal: true, flashDealEndTime: future } }
  const pricing = computeItemPricing(item, now)
  assert.equal(pricing.basePrice, 5000)
  assert.equal(pricing.finalPrice, 0)
})

test('computeItemPricing: قیمت نهایی تخفیف‌دار رُند می‌شود (Math.round)', () => {
  const future = new Date('2026-09-18T00:00:00Z')
  const item = { product: { productType: 'simple', price: 1001, discount: 10, isSpecialOffer: true, specialOfferEndTime: future } }
  assert.equal(computeItemPricing(item, now).finalPrice, 901)
  const item2 = { product: { productType: 'simple', price: 1003, discount: 10, isFlashDeal: true, flashDealEndTime: future } }
  assert.equal(computeItemPricing(item2, now).finalPrice, 903)

  // بدون پیشنهاد فعال: تخفیف اعمال نمی‌شود
  const itemInactive = { product: { productType: 'simple', price: 1001, discount: 10 } }
  assert.equal(computeItemPricing(itemInactive, now).finalPrice, 1001)
  assert.equal(computeItemPricing(itemInactive, now).discount, 0)
})

// ---------------------------------------------------------------- applyDiscountToObject
test('applyDiscountToObject: مسیر جزئیات محصول', () => {
  const obj = { price: 4800000, compareAtPrice: 30000000 }
  applyDiscountToObject(obj, 6, 0)
  assert.equal(obj.price, 4512000)
  assert.equal(obj.compareAtPrice, 4800000)
})

test('applyDiscountToObject: legacy در مسیر جزئیات', () => {
  const obj = { price: 800, compareAtPrice: 1000 }
  applyDiscountToObject(obj, 10, 20)
  assert.equal(obj.price, 900)
  assert.equal(obj.compareAtPrice, 1000)
})

test('applyDiscountToObject: واریانت‌ها با قرارداد یکسان', () => {
  const obj = { price: 4800000, variants: [{ price: 4800000, compareAtPrice: 30000000 }] }
  applyDiscountToObject(obj, 6, 0)
  assert.equal(obj.variants[0].price, 4512000)
  assert.equal(obj.variants[0].compareAtPrice, 4800000)
})

test('applyDiscountToObject: قرارداد API عوض نمی‌شود', () => {
  const obj = { price: 4800000, compareAtPrice: 30000000, discount: 6, campaignLabel: 'تخفیفات پاییزه' }
  applyDiscountToObject(obj, 6, 0)
  assert.ok('price' in obj && 'compareAtPrice' in obj && 'discount' in obj && 'campaignLabel' in obj)
})

// ---------------------------------------------------------------- sanitizeCompareAtPrice
test('sanitizeCompareAtPrice: قوانین ورودی', () => {
  // بیش از ۱۰ برابر: پذیرفته ولی هشدار (۵۰٬۰۰۰٬۰۰۰ > ۱۰ × ۴٬۸۰۰٬۰۰۰)
  const over = sanitizeCompareAtPrice(4800000, 50000000)
  assert.equal(over.value, 50000000)
  assert.ok(over.warning, 'باید هشدار فارسی بدهد')
  // در بازه‌ی عادی: بدون هشدار (۳۰٬۰۰۰٬۰۰۰ فقط ۶٫۲۵ برابر است)
  const high = sanitizeCompareAtPrice(4800000, 30000000)
  assert.equal(high.value, 30000000)
  assert.equal(high.warning, null)
  // در بازه‌ی عادی: بدون هشدار
  const ok = sanitizeCompareAtPrice(4800000, 5000000)
  assert.equal(ok.value, 5000000)
  assert.equal(ok.warning, null)
  // کمتر یا مساوی قیمت: نادیده گرفته می‌شود
  assert.equal(sanitizeCompareAtPrice(4800000, 4000000).value, null)
  assert.equal(sanitizeCompareAtPrice(4800000, 4800000).value, null)
  // ورودی خالی/نامعتبر
  assert.equal(sanitizeCompareAtPrice(4800000, null).value, null)
  assert.equal(sanitizeCompareAtPrice(4800000, '').value, null)
  assert.equal(sanitizeCompareAtPrice(4800000, 'abc').value, null)
})

test('sanitizeVariantsCompareAtPrice: قاعده‌ی یکسان برای واریانت‌ها', () => {
  const { variants, warnings } = sanitizeVariantsCompareAtPrice([
    { price: 100, compareAtPrice: 50 },   // ≤ قیمت → حذف
    { price: 200, compareAtPrice: 5000 }, // >۱۰ برابر → نگه‌داشته + هشدار
    { price: 300 },                        // بدون compare → دست‌نخورده
  ])
  assert.ok(!('compareAtPrice' in variants[0]))
  assert.equal(variants[1].compareAtPrice, 5000)
  assert.equal(variants[2].price, 300)
  assert.equal(warnings.length, 1)
})

// ---------------------------------------------------------------- همسانی با pipeline مونگو
const listingRun = (products, query = {}, campaigns = []) =>
  aggregate(products, buildListingPipeline(parseListingQuery(query), { campaigns }, now))[0]

test('همسانی resolveBasePrice با pipeline مونگو روی مجموعه داده', () => {
  const campaign = { _id: id(900), name: 'تخفیفات پاییزه', discountPercentage: 6, products: [id(11)], startDate: new Date('2026-09-01'), endDate: new Date('2026-10-01'), isActive: true }
  const fixtures = [
    // [price, compareAtPrice, storedDiscount]
    [4800000, 30000000, 0],
    [4800000, 30000000, 6],
    [800, 1000, 20],
    [800, 1000, 0],
    [800, 1000, 10],
    [5000, 3000, 0],
    [10000, 0, 15],
    [0, 5000, 0],
    [799999, 1000000, 20],
    [2500000, 2500000, 0],
  ]
  const future = new Date('2026-10-05T00:00:00Z')
  const products = fixtures.map(([price, compareAtPrice, discount], i) => ({
    _id: id(11 + i), name: `P${i}`, isActive: true, price, compareAtPrice, discount,
    isFlashDeal: discount > 0, flashDealEndTime: discount > 0 ? future : null,
    stock: 2, rating: 4, createdAt: now, variants: [], productType: 'simple',
  }))
  const result = listingRun(products, { sort: 'priceAsc' }, [campaign])
  assert.equal(result.data.length, fixtures.length)

  for (const doc of result.data) {
    const orig = fixtures.find(([,,], i) => String(id(11 + i)) === String(doc._id))
    const [price, compareAtPrice, storedDiscount] = orig
    const expectedBase = resolveBasePrice(price, compareAtPrice, storedDiscount)
    const isCamp = String(doc._id) === String(id(11))
    const appliedDiscount = isCamp ? 6 : (storedDiscount > 0 ? storedDiscount : 0)

    if (appliedDiscount > 0) {
      // با تخفیف فعال: خروجی باید مبنای resolved و قیمت نهایی رُندشده باشد
      assert.equal(doc.compareAtPrice, expectedBase, `base mismatch for ${doc.name}`)
      assert.equal(doc.price, Math.round(expectedBase * (1 - appliedDiscount / 100)), `final mismatch for ${doc.name}`)
      assert.equal(doc.discount, appliedDiscount)
    } else {
      // بدون تخفیف: قیمت نهایی همان price و compareAtPrice حذف شده
      assert.equal(doc.price, price, `price mismatch for ${doc.name}`)
      assert.ok(!('compareAtPrice' in doc) || doc.compareAtPrice === undefined, `stale compare leaked for ${doc.name}`)
    }
  }

  // ادعای اصلی سناریو: محصول کمپین‌دار
  const campDoc = result.data.find((d) => String(d._id) === String(id(11)))
  assert.equal(campDoc.price, 4512000)
  assert.equal(campDoc.compareAtPrice, 4800000)
  assert.equal(campDoc.discount, 6)
})
