const assert = require('node:assert/strict')
const test = require('node:test')

const {
  calibrateCeilingForExactFloor,
  validatePricingSyncPayload,
  syncProductTimedSaleMembership,
} = require('../services/competitivePricingSyncService')
const { computeItemPricing, applyPromotionOverlay } = require('../services/pricingService')
const { mapTorobProduct } = require('../utils/torobMapper')

test('۱. sgeooole pricing-sync: مسدود کردن هرگونه قیمت فروش کمتر یا مساوی قیمت خرید همکار (خط قرمز اول)', () => {
  const belowCost = validatePricingSyncPayload(
    {
      finalPrice: 2300000,
      basePrice: 2600000,
      costPrice: 2350000,
      hardFloorPrice: 2420000,
    },
    null,
  )
  assert.equal(belowCost.valid, false)
  assert.equal(belowCost.code, 'BELOW_COST_PRICE')

  const equalToCost = validatePricingSyncPayload(
    {
      finalPrice: 2350000,
      basePrice: 2600000,
      costPrice: 2350000,
    },
    null,
  )
  assert.equal(equalToCost.valid, false)
  assert.equal(equalToCost.code, 'BELOW_COST_PRICE')

  const belowFloor = validatePricingSyncPayload(
    {
      finalPrice: 2390000,
      basePrice: 2600000,
      costPrice: 2350000,
      hardFloorPrice: 2420000,
    },
    null,
  )
  assert.equal(belowFloor.valid, false)
  assert.equal(belowFloor.code, 'BELOW_HARD_FLOOR')
})

test('۲. sgeooole pricing-sync: کالیبراسیون دقیق سقف (basePrice) و درصد تخفیف روی کف (finalPrice) در پیشنهاد لحظه‌ای (flash)', () => {
  const futureIso = new Date(Date.now() + 12 * 3600 * 1000).toISOString()
  const res = validatePricingSyncPayload(
    {
      finalPrice: 2435000,
      basePrice: 2705556,
      discount: 10,
      costPrice: 2320000,
      hardFloorPrice: 2402000,
      campaignType: 'flash',
      isFlashDeal: true,
      flashDealEndTime: futureIso,
    },
    null,
  )

  assert.equal(res.valid, true)
  assert.equal(res.campaignType, 'flash')
  assert.equal(res.updateDoc.isFlashDeal, true)
  assert.equal(res.updateDoc.isSpecialOffer, false)
  assert.equal(res.discountPct, 10)
  // بررسی اینکه سقف کالیبره‌شده پس از کسر 10% تخفیف دقیقاً برابر 2,435,000 تومان می‌شود:
  assert.equal(Math.round(res.updateDoc.price * (1 - res.updateDoc.discount / 100)), 2435000)

  const mockProduct = {
    _id: '507f1f77bcf86cd799439011',
    name: 'دوربین مداربسته داهوا',
    slug: 'dahua-cam',
    productCode: 'KY-1002003',
    productType: 'simple',
    isActive: true,
    stock: 10,
    images: [{ url: 'https://cdn.example.com/cam.jpg' }],
    ...res.updateDoc,
  }

  const itemPricing = computeItemPricing({ product: mockProduct })
  assert.equal(itemPricing.finalPrice, 2435000, 'قیمت نهایی در سبد خرید باید دقیقاً برابر کف هدف باشد')
  assert.ok(itemPricing.finalPrice > mockProduct.costPrice)

  const torobRow = mapTorobProduct(mockProduct)
  assert.equal(torobRow.current_price, 2435000)
  assert.equal(torobRow.old_price, res.updateDoc.price)
})

test('۳. sgeooole pricing-sync: سیستم سوم (فرصت‌های زمان‌دار بخش مالی و تخفیف — مدل Sale با showInFeatured و badgeTheme)', async () => {
  const futureIso = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
  const res = validatePricingSyncPayload(
    {
      finalPrice: 2430000,
      basePrice: 2700000,
      costPrice: 2320000,
      hardFloorPrice: 2402000,
      campaignType: 'timed_sale',
      timedSale: {
        enabled: true,
        name: 'فرصت ویژه مشهد',
        discountPercentage: 10,
        endDate: futureIso,
        badgeTheme: 'green-orange',
        showInFeatured: true,
      },
    },
    null,
  )

  assert.equal(res.valid, true)
  assert.equal(res.campaignType, 'timed_sale')
  // در حالت timed_sale، روی خود Product نباید isFlashDeal یا isSpecialOffer روشن باشد تا تداخل 409 رخ ندهد
  assert.equal(res.updateDoc.isFlashDeal, false)
  assert.equal(res.updateDoc.isSpecialOffer, false)
  assert.equal(res.updateDoc.discount, 0)
  assert.equal(res.updateDoc.price, 2700000, 'قیمت پایه روی Product برابر سقف معیار است')
  assert.equal(res.timedSaleSpec.enabled, true)
  assert.equal(res.timedSaleSpec.name, 'فرصت ویژه مشهد')
  assert.equal(res.timedSaleSpec.discountPercentage, 10)
  assert.equal(res.timedSaleSpec.badgeTheme, 'green-orange')
  assert.equal(res.timedSaleSpec.showInFeatured, true)

  // تست همگام‌سازی خودکار با مدل Sale و بررسی خروجی applyPromotionOverlay و mapTorobProduct
  let capturedQuery = null
  let capturedUpdate = null
  const mockSaleModel = {
    updateMany: async () => ({ modifiedCount: 0 }),
    findOneAndUpdate: async (q, u) => {
      capturedQuery = q
      capturedUpdate = u
      return {
        _id: 'sale_123',
        name: q.name,
        discountPercentage: q.discountPercentage,
        badgeTheme: u.$set.badgeTheme,
        showInFeatured: u.$set.showInFeatured,
        endDate: u.$set.endDate,
        products: ['507f1f77bcf86cd799439011'],
        categories: [],
      }
    },
  }

  const syncedSale = await syncProductTimedSaleMembership(
    mockSaleModel,
    '507f1f77bcf86cd799439011',
    res.timedSaleSpec,
  )

  assert.equal(capturedQuery.name, 'فرصت ویژه مشهد')
  assert.equal(capturedQuery.discountPercentage, 10)
  assert.equal(capturedUpdate.$set.showInFeatured, true)
  assert.equal(capturedUpdate.$set.badgeTheme, 'green-orange')

  const productObj = {
    _id: '507f1f77bcf86cd799439011',
    name: 'دوربین مداربسته داهوا',
    slug: 'dahua-cam',
    productCode: 'KY-1002003',
    productType: 'simple',
    isActive: true,
    stock: 10,
    images: [{ url: 'https://cdn.example.com/cam.jpg' }],
    ...res.updateDoc,
  }

  // بررسی اینکه در فید ترب، کمپین Sale به درستی سقف 2,700,000 را با 10% تخفیف به کف 2,430,000 تبدیل می‌کند:
  const torobRow = mapTorobProduct(productObj, [syncedSale])
  assert.equal(torobRow.current_price, 2430000)
  assert.equal(torobRow.old_price, 2700000)

  // بررسی اینکه در لیست محصولات سایت (applyPromotionOverlay)، برچسب کمپین و تم رنگی به درستی می‌نشیند:
  applyPromotionOverlay(productObj, { activeSale: syncedSale, now: new Date() })
  assert.equal(productObj.price, 2430000)
  assert.equal(productObj.compareAtPrice, 2700000)
  assert.equal(productObj.discount, 10)
  assert.equal(productObj.campaignLabel, 'فرصت ویژه مشهد')
  assert.equal(productObj.campaignTheme, 'green-orange')
})

test('۴. sgeooole pricing-sync: پشتیبانی از idempotencyKey و تشخیص تکرار تصمیم (idempotentReplay)', () => {
  const first = validatePricingSyncPayload(
    {
      finalPrice: 2500000,
      basePrice: 2800000,
      costPrice: 2300000,
      hardFloorPrice: 2400000,
      campaignType: 'flash',
      decisionId: 77,
      idempotencyKey: 'decision-77-v1',
    },
    null,
  )
  assert.equal(first.valid, true)
  assert.equal(first.decisionId, '77')
  assert.equal(first.idempotencyKey, 'decision-77-v1')
  assert.equal(first.idempotentReplay, false)

  // شبیه‌سازی محصولی که همین تصمیم قبلاً رویش نشسته است
  const existingAfterFirst = {
    _id: '507f1f77bcf86cd799439011',
    price: first.updateDoc.price,
    costPrice: 2300000,
    hardFloorPrice: 2400000,
    pricingMeta: first.updateDoc.pricingMeta,
  }

  const replay = validatePricingSyncPayload(
    {
      finalPrice: 2500000,
      basePrice: 2800000,
      costPrice: 2300000,
      hardFloorPrice: 2400000,
      campaignType: 'flash',
      decisionId: 77,
      idempotencyKey: 'decision-77-v1',
    },
    existingAfterFirst,
  )
  assert.equal(replay.valid, true)
  assert.equal(replay.idempotentReplay, true)
})

test('۵. sgeooole pricing-sync: رد کردن payload نامعتبر و پشتیبانی ممیزی‌شده از مجوز صریح زیر قیمت خرید (belowCostOverride)', () => {
  assert.equal(validatePricingSyncPayload(null, null).valid, false)
  assert.equal(validatePricingSyncPayload('bad', null).valid, false)
  assert.equal(validatePricingSyncPayload({ finalPrice: -100 }, null).valid, false)

  // بدون مجوز کامل (یا با دلیل کوتاه/بدون تاییدکننده) همچنان مسدود است
  const incompleteOverride = validatePricingSyncPayload(
    {
      finalPrice: 2200000,
      basePrice: 2500000,
      costPrice: 2350000,
      belowCostOverride: { allowBelowCost: true, reason: 'ok', authorizedBy: '' },
    },
    null,
  )
  assert.equal(incompleteOverride.valid, false)
  assert.equal(incompleteOverride.code, 'BELOW_COST_PRICE')

  // با مجوز صریح و کامل، در pricingMeta ثبت ممیزی می‌شود
  const authorizedOverride = validatePricingSyncPayload(
    {
      finalPrice: 2200000,
      basePrice: 2500000,
      costPrice: 2350000,
      belowCostOverride: {
        allowBelowCost: true,
        reason: 'تخلیه انبار مدل متوقف‌شده با تایید مدیریت مالی',
        authorizedBy: 'admin@ekgkala.ir',
      },
    },
    null,
  )
  assert.equal(authorizedOverride.valid, true)
  assert.equal(authorizedOverride.belowCostAuthorized, true)
  assert.equal(authorizedOverride.updateDoc.pricingMeta.belowCostOverride.authorizedBy, 'admin@ekgkala.ir')
})
