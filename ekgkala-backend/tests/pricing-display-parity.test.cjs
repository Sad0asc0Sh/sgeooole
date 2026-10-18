// ۴.۱.۲ — پاریتی قیمت «همه‌ی» مسیرهای نمایش و پرداخت.
// این تست همان سناریوی ممیزی N1 را بازتولید می‌کند: پروموشن منقضی، price دیتابیس روی
// سقف ۹۹۰٬۴۷۶ و exactFloorPrice=۸۳۲٬۰۰۰. صفحه/سبد/پرداخت قبلاً ۸۳۲٬۰۰۰ می‌دادند،
// ولی چت‌بات و علاقه‌مندی‌ها ۹۹۰٬۴۷۶. حالا هر چهار مسیر باید یک عدد بدهند.
const assert = require('node:assert/strict')
const test = require('node:test')

const {
  resolveProductDisplay,
  findActiveSaleForProduct,
  computeItemPricing,
} = require('../services/pricingService')
const { finalPriceOf, toCardPayload } = require('../utils/chatRetrieval')

const NOW = new Date('2026-10-17T10:00:00.000Z')
const FRESH = new Date('2026-10-16T10:00:00.000Z')
const PAST = new Date('2026-10-10T10:00:00.000Z')
const FUTURE = new Date('2026-10-20T10:00:00.000Z')

const expiredManaged = () => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'کارت مدیریت‌شده',
  slug: 'card',
  productCode: 'P-1',
  productType: 'simple',
  price: 990476,
  compareAtPrice: 990476,
  discount: 16,
  isFlashDeal: true,
  flashDealEndTime: PAST,
  isSpecialOffer: false,
  specialOfferEndTime: null,
  stock: 5,
  images: [],
  pricingMeta: { exactFloorPrice: 832000, exactFloorPriceAt: FRESH, campaignType: 'flash' },
})

test('چت‌بات پس از انقضا: ۸۳۲٬۰۰۰ (نه ۹۹۰٬۴۷۶) و discount صفر', () => {
  const product = expiredManaged()
  assert.equal(finalPriceOf(product, NOW), 832000)
  const card = toCardPayload(product)
  assert.equal(card.price, 832000)
  assert.equal(card.oldPrice, undefined)
  assert.equal(card.discount, 0)
})

test('پاریتی کامل: چت = سبد/پرداخت = صفحه‌ی محصول برای محصول منقضی', () => {
  const product = expiredManaged()
  const chat = finalPriceOf(product, NOW)
  const checkout = computeItemPricing({ product }, NOW).finalPrice
  const detail = resolveProductDisplay(product, { now: NOW })
  assert.equal(chat, 832000)
  assert.equal(checkout, 832000)
  assert.equal(detail.price, 832000)
  assert.equal(detail.compareAtPrice, null)
  assert.equal(detail.discount, 0)
})

test('Sale فعال در علاقه‌مندی‌ها: درصد Sale اعمال و زیر کف قطعی clamp می‌شود', () => {
  const product = expiredManaged()
  product.isFlashDeal = false
  product.flashDealEndTime = null
  product.discount = 0
  const context = {
    campaignMap: new Map([['507f1f77bcf86cd799439011', { name: 'کمپین پاییزه', discount: 25, theme: 'green-orange', endDate: FUTURE }]]),
    categoryDiscountMap: new Map(),
  }
  const sale = findActiveSaleForProduct(product, context)
  assert.equal(sale.discountPercentage, 25)
  const display = resolveProductDisplay(product, { now: NOW, activeSale: sale })
  assert.equal(display.price, 832000)
  assert.equal(display.campaignLabel, 'کمپین پاییزه')
  assert.equal(display.compareAtPrice, 990476)
})

test('چت با Sale فعال: context متصل‌شده اعمال می‌شود و کارت همان قیمت نمایش را می‌دهد', () => {
  const product = expiredManaged()
  product.isFlashDeal = false
  product.flashDealEndTime = null
  product.discount = 0
  Object.defineProperty(product, '__activeSale', {
    value: { name: 'کمپین پاییزه', discountPercentage: 25, badgeTheme: 'green-orange', endDate: FUTURE },
    enumerable: false,
  })
  const card = toCardPayload(product)
  assert.equal(card.price, 832000)
  assert.equal(card.discount, 25)
  assert.equal(card.oldPrice, 990476)
  assert.equal(card.campaignLabel, 'کمپین پاییزه')
})

test('بدون pricingMeta: قیمت خام و رفتار قبلی حفظ می‌شود', () => {
  const plain = {
    _id: '507f1f77bcf86cd799439012',
    name: 'ساده',
    productType: 'simple',
    price: 1001,
    discount: 10,
    stock: 1,
    images: [],
  }
  assert.equal(finalPriceOf(plain, NOW), 1001)
  assert.equal(toCardPayload(plain).discount, 0)
})

test('محصول متغیر منقضی: کارت چت از ارزان‌ترین واریانت موجود استفاده می‌کند', () => {
  const variable = {
    _id: '507f1f77bcf86cd799439013',
    name: 'متغیر',
    productType: 'variable',
    price: 1200000,
    discount: 10,
    isSpecialOffer: true,
    specialOfferEndTime: PAST,
    stock: 2,
    images: [],
    pricingMeta: { exactFloorPrice: 832000, exactFloorPriceAt: FRESH, campaignType: 'featured' },
    variants: [
      { _id: 'v1', price: 900000, stock: 2, options: [{ name: 'رنگ', value: 'مشکی' }] },
      { _id: 'v2', price: 800000, stock: 0, options: [{ name: 'رنگ', value: 'سفید' }] },
    ],
  }
  const card = toCardPayload(variable)
  assert.equal(card.price, 900000, 'ارزان‌ترین واریانت موجود، نه سقف ریشه')
  assert.equal(card.discount, 0)
})
