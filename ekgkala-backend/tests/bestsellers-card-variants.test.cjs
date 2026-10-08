// تست مدل‌های قیمت‌گذاری‌شده‌ی کارت پرفروش‌ترین‌ها — آفلاین، بدون MongoDB
// پوشش: priceVariantsForCard (آینه‌ی شاخه‌ی variants در pipeline لیست):
// مدل مستثنی قیمت پایه می‌ماند، بقیه همان درصد سطح محصول را می‌گیرند،
// ورودی خراب نادیده گرفته می‌شود و خروجی با resolvePricing فرانت idempotent است.
const assert = require('node:assert/strict')
const test = require('node:test')

const { priceVariantsForCard, resolveBasePrice } = require('../services/pricingService')

const future = '2099-01-01T00:00:00.000Z'

// ---------------------------------------------------------------- مدل مستثنی
test('priceVariantsForCard: مدل مستثنی قیمت پایه می‌ماند و compare ندارد', () => {
  const [cheap] = priceVariantsForCard(
    [{ _id: 'c', price: 700000, compareAtPrice: 700000, stock: 5, excludeFromPromotion: true }],
    { discountPct: 20, storedDiscount: 20 },
  )
  assert.equal(cheap.price, 700000)
  assert.equal(cheap.compareAtPrice, undefined)
  assert.equal(cheap.excludeFromPromotion, true)
  assert.equal(cheap.stock, 5)
})

// ---------------------------------------------------------------- مدل تخفیف‌دار
test('priceVariantsForCard: مدل عادی همان درصد سطح محصول را روی مبنا می‌گیرد', () => {
  const [a] = priceVariantsForCard(
    [{ _id: 'a', price: 800000, compareAtPrice: 1000000, stock: 5 }],
    { discountPct: 20, storedDiscount: 20 },
  )
  // داده‌ی قدیمیِ از قبل تخفیف‌خورده: مبنا compareAtPrice است
  assert.equal(a.price, 800000)
  assert.equal(a.compareAtPrice, 1000000)
})

test('priceVariantsForCard: بدون تخفیف زنده، قیمت پایه برمی‌گردد', () => {
  const [a] = priceVariantsForCard(
    [{ _id: 'a', price: 800000, compareAtPrice: 1000000, stock: 5 }],
    { discountPct: 0, storedDiscount: 0 },
  )
  assert.equal(a.price, 800000)
  assert.equal(a.compareAtPrice, undefined)
})

// ---------------------------------------------------------------- ورودی خراب
test('priceVariantsForCard: ورودی خراب کرش نمی‌کند', () => {
  assert.deepEqual(priceVariantsForCard(null, { discountPct: 20 }), [])
  assert.deepEqual(priceVariantsForCard(undefined, { discountPct: 20 }), [])
  const out = priceVariantsForCard(
    [null, 'x', 42, { _id: 'v', price: 200000, stock: 1 }],
    { discountPct: 10, storedDiscount: 0 },
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].price, 180000)
  assert.equal(out[0].compareAtPrice, 200000)
})

// ---------------------------------------------------------------- همسانی با فرانت
test('priceVariantsForCard: خروجی با resolvePricing فرانت idempotent است', () => {
  // شبیه‌سازی resolvePricing فرانت برای مدل تخفیف‌دارِ خروجی بالا
  const [a] = priceVariantsForCard(
    [{ _id: 'a', price: 800000, compareAtPrice: 1000000, stock: 5 }],
    { discountPct: 20, storedDiscount: 20 },
  )
  const base = resolveBasePrice(a.price, a.compareAtPrice, 20)
  assert.equal(base, 1000000)
  assert.equal(Math.round(base * (1 - 20 / 100)), a.price)
})
