// تست «متغیر مستثنی از تخفیف» برای هر سه نوع پروموشن (Sale / لحظه‌ای / شگفت‌انگیز) — آفلاین، بدون MongoDB
// پوشش: ۱) helper مشترک ۲) جزئیات محصول (applyPromotionOverlay) ۳) pipeline لیست (با mingo)
// قاعده: محصولِ متغیر که «همه‌ی» متغیرهایش مستثنی‌اند هیچ لیبل/تایمر/درصد/عضویت در onSale و منتخب‌ها ندارد؛
// محصولی که حتی یک متغیر مشمول دارد دقیقاً مثل قبل است.
const assert = require('node:assert/strict')
const test = require('node:test')
const mongoose = require('mongoose')
require('mingo/init/system')
const { aggregate } = require('mingo')

const { areAllVariantsExcluded, applyPromotionOverlay } = require('../services/pricingService')
const { parseListingQuery, buildListingPipeline } = require('../services/productListingService')

const now = new Date('2026-10-12T12:00:00.000Z')
const future = new Date('2026-10-20T12:00:00.000Z')
const oid = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'))
const V = (n, price, excluded) => ({ _id: oid(900 + n), price, stock: 5, options: [{ name: 'رنگ', value: `v${n}` }], ...(excluded === undefined ? {} : { excludeFromPromotion: excluded }) })
const sale = { name: 'فروش ویژه عید', discountPercentage: 20, badgeTheme: 'red-purple', endDate: future }

// ---------------------------------------------------------------- helper
test('areAllVariantsExcluded: فقط وقتی همه‌ی متغیرها مستثنی‌اند true است', () => {
  assert.equal(areAllVariantsExcluded({ variants: [V(1, 1, true), V(2, 1, true)] }), true)
  assert.equal(areAllVariantsExcluded({ variants: [V(1, 1, true), V(2, 1, false)] }), false)
  assert.equal(areAllVariantsExcluded({ variants: [V(1, 1, true), V(2, 1)] }), false)
})

test('areAllVariantsExcluded: محصول ساده/خالی/ورودی خراب => false و کرش نمی‌کند', () => {
  for (const input of [null, undefined, {}, { variants: [] }, { variants: null }, { variants: [null, 'x', 5] }]) {
    assert.equal(areAllVariantsExcluded(input), false)
  }
})

// ---------------------------------------------------------------- جزئیات محصول
const detail = (extra) => ({ _id: 'p', name: 'x', productType: 'variable', price: 100000, discount: 0, ...extra })

test('جزئیات: Sale + همه مستثنی => بدون لیبل/تم/تایمر/درصد و قیمت پایه', () => {
  const p = detail({ variants: [V(1, 100000, true), V(2, 120000, true)] })
  const out = applyPromotionOverlay(p, { activeSale: sale, now })
  assert.equal(p.discount, 0)
  assert.equal(p.campaignLabel, undefined)
  assert.equal(p.campaignTheme, undefined)
  assert.equal(p.isSpecialOffer, false)
  assert.equal(p.isFromActiveSale, undefined)
  assert.equal(p.price, 100000)
  assert.deepEqual(p.variants.map((v) => v.price), [100000, 120000])
  assert.equal(out.promotionEndsAt, null)
})

test('جزئیات: لحظه‌ای + همه مستثنی => پرچم‌ها خاموش و بدون درصد', () => {
  const p = detail({ discount: 30, isFlashDeal: true, flashDealEndTime: future, variants: [V(1, 70000, true), V(2, 80000, true)] })
  applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.discount, 0)
  assert.equal(p.isFlashDeal, false)
  assert.equal(p.campaignLabel, undefined)
})

test('جزئیات: Sale + یک متغیر مشمول => رفتار قبلی (درصد و لیبل می‌ماند، مستثنی قیمت پایه)', () => {
  const p = detail({ variants: [V(1, 100000, false), V(2, 120000, true)] })
  applyPromotionOverlay(p, { activeSale: sale, now })
  assert.equal(p.discount, 20)
  assert.equal(p.campaignLabel, 'فروش ویژه عید')
  assert.equal(p.isSpecialOffer, true)
  assert.equal(p.variants[0].price, 80000)
  assert.equal(p.variants[0].compareAtPrice, 100000)
  assert.equal(p.variants[1].price, 120000)
  assert.equal(p.variants[1].compareAtPrice, undefined)
})

test('جزئیات: محصول ساده با Sale => بدون تغییر نسبت به قبل', () => {
  const p = { _id: 's', name: 's', productType: 'simple', price: 100000, discount: 0 }
  applyPromotionOverlay(p, { activeSale: sale, now })
  assert.equal(p.discount, 20)
  assert.equal(p.price, 80000)
  assert.equal(p.campaignLabel, 'فروش ویژه عید')
})

// ---------------------------------------------------------------- pipeline لیست
const product = (n, extra) => ({ _id: oid(n), name: `P${n}`, isActive: true, productType: 'variable', price: 1, stock: 0, rating: 4, discount: 0, createdAt: now, ...extra })
const run = (products, query = {}, campaigns = []) => aggregate(products, buildListingPipeline(parseListingQuery(query), { campaigns }, now))[0]
const byName = (r, name) => r.data.find((p) => p.name === name)

const campaign = { products: [oid(1), oid(2), oid(3)], categories: [], name: sale.name, discountPercentage: 20, endDate: future, badgeTheme: 'red-purple', showInFeatured: true }
const mixed = () => product(1, { variants: [V(1, 100000, false), V(2, 120000, true)] })
const allEx = () => product(2, { variants: [V(1, 100000, true), V(2, 120000, true)] })
const simple = () => product(3, { productType: 'simple', price: 50000, stock: 4 })

test('لیست: Sale — همه مستثنی خنثی؛ ترکیبی و ساده مثل قبل', () => {
  const r = run([mixed(), allEx(), simple()], {}, [campaign])
  const m = byName(r, 'P1'), a = byName(r, 'P2'), s = byName(r, 'P3')
  assert.equal(m.discount, 20); assert.equal(m.campaignLabel, sale.name); assert.equal(m.isSpecialOffer, true)
  assert.deepEqual(m.variants.map((v) => v.price), [80000, 120000])
  assert.equal(a.discount, 0); assert.equal(a.campaignLabel, undefined); assert.equal(a.campaignTheme, undefined)
  assert.equal(a.isSpecialOffer, false); assert.equal(a.specialOfferEndTime, undefined)
  assert.equal(a.compareAtPrice, undefined); assert.equal(a.price, 100000)
  assert.equal(s.discount, 20); assert.equal(s.price, 40000)
})

test('لیست: Sale — فیلتر تخفیف‌دار و منتخب‌ها محصول با همه مستثنی را شامل نمی‌شود', () => {
  const ids = (q) => run([mixed(), allEx(), simple()], q, [campaign]).data.map((p) => p.name).sort()
  assert.deepEqual(ids({ onSale: 'true' }), ['P1', 'P3'])
  assert.deepEqual(ids({ featured: 'true' }), ['P1', 'P3'])
})

test('لیست: لحظه‌ای — همه مستثنی خنثی، ترکیبی مثل قبل', () => {
  const flash = (n, vars) => product(n, { discount: 20, isFlashDeal: true, flashDealEndTime: future, variants: vars })
  const r = run([flash(1, [V(1, 100000, false), V(2, 120000, true)]), flash(2, [V(1, 100000, true), V(2, 120000, true)])])
  assert.equal(byName(r, 'P1').discount, 20)
  assert.equal(byName(r, 'P1').isFlashDeal, true)
  const a = byName(r, 'P2')
  assert.equal(a.discount, 0); assert.equal(a.isFlashDeal, false); assert.equal(a.flashDealEndTime, undefined); assert.equal(a.campaignLabel, undefined)
  assert.deepEqual(run([flash(2, [V(1, 100000, true)])], { onSale: 'true' }).data, [])
})

test('لیست: شگفت‌انگیز دستی — همه مستثنی از منتخب‌ها خارج می‌شود', () => {
  const special = (n, vars) => product(n, { discount: 20, isSpecialOffer: true, specialOfferEndTime: future, variants: vars })
  const r = run([special(1, [V(1, 100000, false)]), special(2, [V(1, 100000, true), V(2, 90000, true)])], { featured: 'true' })
  assert.deepEqual(r.data.map((p) => p.name), ['P1'])
})

test('لیست: متغیر بدون فیلد excludeFromPromotion (داده‌ی قدیمی) مشمول تخفیف است', () => {
  const legacy = product(1, { variants: [V(1, 100000), V(2, 120000)] })
  const r = run([legacy], {}, [campaign])
  assert.equal(byName(r, 'P1').discount, 20)
  assert.deepEqual(byName(r, 'P1').variants.map((v) => v.price), [80000, 96000])
})
