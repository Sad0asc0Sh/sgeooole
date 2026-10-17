// ۴.۱.۱ — قیمت پرداختی (سبد/پرداخت/فید ترب) باید با قیمت نمایش‌داده‌شده یکی باشد.
// پوشش: computeItemPricing برای محصول ساده و واریانت، پروموشن زنده/منقضی، Sale فعال،
// اعتبار ۱۴ روزه exactFloorPrice و سازگاری کامل با applyPromotionOverlay.
const assert = require('node:assert/strict')
const test = require('node:test')

const { computeItemPricing, applyPromotionOverlay, managedExactFloorPrice } = require('../services/pricingService')

const now = new Date('2026-10-17T10:00:00.000Z')
const future = new Date('2026-10-20T10:00:00.000Z')
const past = new Date('2026-10-10T10:00:00.000Z')
const freshMeta = { exactFloorPrice: 832000, exactFloorPriceAt: new Date('2026-10-16T10:00:00.000Z') }

const managedProduct = (extra = {}) => ({
  _id: 'p1',
  name: 'کارت مدیریت‌شده',
  productType: 'simple',
  price: 990476,
  discount: 16,
  isFlashDeal: false,
  flashDealEndTime: null,
  isSpecialOffer: false,
  specialOfferEndTime: null,
  pricingMeta: { ...freshMeta },
  ...extra,
})

test('چک‌اوت با تایمر منقضی: basePrice = finalPrice = exactFloorPrice (نه سقف معیار ۹۹۰٬۴۷۶)', () => {
  const product = managedProduct({
    isFlashDeal: true,
    flashDealEndTime: past,
    isSpecialOffer: true,
    specialOfferEndTime: past,
  })
  const pricing = computeItemPricing({ product }, now)
  assert.equal(pricing.basePrice, 832000)
  assert.equal(pricing.finalPrice, 832000)
  assert.equal(pricing.discount, 0)
  assert.equal(pricing.campaignLabel, null)
})

test('چک‌اوت بدون پروموشن زنده (حتی با discount باقی‌مانده) به کف قطعی برمی‌گردد', () => {
  const pricing = computeItemPricing({ product: managedProduct() }, now)
  assert.equal(pricing.finalPrice, 832000)
  assert.equal(pricing.basePrice, 832000)
  assert.equal(pricing.discount, 0)
})

test('پروموشن زنده: تخفیف دقیقاً روی سقف اعمال می‌شود و هرگز زیر کف قطعی نمی‌رود', () => {
  const exact = managedProduct({
    discount: 16,
    isSpecialOffer: true,
    specialOfferEndTime: future,
  })
  const p1 = computeItemPricing({ product: exact }, now)
  assert.equal(p1.discount, 16)
  assert.equal(p1.finalPrice, 832000)
  assert.equal(p1.finalPrice, Math.max(832000, Math.round(990476 * 0.84)))

  const deep = managedProduct({
    discount: 30,
    isSpecialOffer: true,
    specialOfferEndTime: future,
  })
  const p2 = computeItemPricing({ product: deep }, now)
  assert.equal(p2.discount, 30)
  assert.equal(p2.finalPrice, 832000, 'تخفیف عمیق Sale نباید قیمت پرداختی را زیر کف قطعی ببرد')
})

test('Sale فعال (campaignContext): قیمت پرداختی همان کف قطعی نمایشی است', () => {
  const product = managedProduct({ discount: 0 })
  const campaignContext = {
    campaignMap: new Map([['p1', { name: 'کمپین پاییزه', discount: 25, endDate: future }]]),
    categoryDiscountMap: new Map(),
  }
  const pricing = computeItemPricing({ product }, now, campaignContext)
  assert.equal(pricing.discount, 25)
  assert.equal(pricing.finalPrice, 832000)
  assert.equal(pricing.campaignLabel, 'کمپین پاییزه')
})

test('بدون pricingMeta: رفتار قبلی دقیقاً حفظ می‌شود', () => {
  const plain = { productType: 'simple', price: 1001, discount: 10 }
  assert.equal(computeItemPricing({ product: plain }, now).finalPrice, 1001)

  const special = {
    productType: 'simple',
    price: 1001,
    discount: 10,
    isSpecialOffer: true,
    specialOfferEndTime: future,
  }
  assert.equal(computeItemPricing({ product: special }, now).finalPrice, 901)
})

test('اعتبار exactFloorPrice: بعد از ۱۴ روز بی‌sync کف قدیمی دیگر معتبر نیست', () => {
  const staleMeta = {
    exactFloorPrice: 832000,
    exactFloorPriceAt: new Date(now.getTime() - 15 * 86_400_000),
  }
  assert.equal(managedExactFloorPrice({ pricingMeta: staleMeta }, now), 0)
  const pricing = computeItemPricing({ product: managedProduct({ pricingMeta: staleMeta }) }, now)
  assert.equal(pricing.finalPrice, 990476, 'بدون کف معتبر، قیمت ثبت‌شده/سقف مبنا است')

  // timestamp نامعتبر = fail-closed (کف قدیمی استفاده نمی‌شود)
  assert.equal(
    managedExactFloorPrice({ pricingMeta: { exactFloorPrice: 832000, exactFloorPriceAt: 'not-a-date' } }, now),
    0,
  )
})

test('واریانت: قیمت خودش مبناست؛ تخفیف زنده هرگز زیر کف قطعی نرود', () => {
  const variable = {
    _id: 'p2',
    productType: 'variable',
    price: 1200000,
    discount: 0,
    pricingMeta: { ...freshMeta },
    variants: [
      { _id: 'v1', price: 900000, options: [{ name: 'رنگ', value: 'مشکی' }] },
      { _id: 'v2', price: 900000, options: [{ name: 'رنگ', value: 'سفید' }], excludeFromPromotion: true },
    ],
  }
  const item = { product: variable, variantOptions: [{ name: 'رنگ', value: 'مشکی' }] }
  const noPromo = computeItemPricing(item, now)
  assert.equal(noPromo.basePrice, 900000)
  assert.equal(noPromo.finalPrice, 900000)

  const live = {
    ...variable,
    discount: 10,
    isSpecialOffer: true,
    specialOfferEndTime: future,
  }
  const promo = computeItemPricing({ ...item, product: live }, now)
  assert.equal(promo.finalPrice, 832000, '810000 زیر کف است و به کف قطعی clamp می‌شود')

  const excluded = computeItemPricing(
    { product: { ...live, discount: 20 }, variantOptions: [{ name: 'رنگ', value: 'سفید' }] },
    now,
  )
  assert.equal(excluded.discount, 0)
  assert.equal(excluded.finalPrice, 900000, 'واریانت مستثنی بدون تخفیف می‌ماند')
})

test('پاریتی نمایش و چک‌اوت: applyPromotionOverlay و computeItemPricing یک قیمت می‌دهند', () => {
  const expired = managedProduct({
    isFlashDeal: true,
    flashDealEndTime: past,
  })
  const detail = JSON.parse(JSON.stringify(expired))
  detail.pricingMeta.exactFloorPriceAt = freshMeta.exactFloorPriceAt.toISOString()
  applyPromotionOverlay(detail, { activeSale: null, now })
  const checkout = computeItemPricing({ product: expired }, now)
  assert.equal(checkout.finalPrice, detail.price, 'قیمت منقضی در سبد = قیمت نمایش')

  const active = managedProduct({
    discount: 16,
    isSpecialOffer: true,
    specialOfferEndTime: future,
  })
  const detail2 = JSON.parse(JSON.stringify(active))
  detail2.pricingMeta.exactFloorPriceAt = freshMeta.exactFloorPriceAt.toISOString()
  applyPromotionOverlay(detail2, { activeSale: null, now })
  const checkout2 = computeItemPricing({ product: active }, now)
  assert.equal(checkout2.finalPrice, detail2.price, 'قیمت پروموشن زنده در سبد = قیمت نمایش')
})
