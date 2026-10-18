// ۴.۱.۲ (بستن N1) — چرخه‌ی عمر باید قیمت ماندگار دیتابیس را هم به کف قطعی برگرداند.
// چرا مهم است: مسیرهای محافظت‌شده (صفحه محصول/سبد/پرداخت/فید ترب/لیست) قیمت را هنگام
// خواندن اصلاح می‌کنند؛ ولی علاقه‌مندی‌ها و چت‌بات قیمت خام DB را می‌خوانند. اگر price
// روی سقف معیار بماند، آن دو مسیر ۹۹۰٬۴۷۶ نشان می‌دهند در حالی که قیمت فروش ۸۳۲٬۰۰۰ است.
const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildDeactivationUpdate,
  buildManagedRestore,
  planPromotionCleanup,
  staleCandidatesFilter,
  applyOwnPromotionRules,
} = require('../services/promotionLifecycleService')
const { MANAGED_EXACT_FLOOR_MAX_AGE_DAYS } = require('../services/pricingService')

const NOW = new Date('2026-10-17T10:00:00.000Z')
const FRESH = new Date('2026-10-16T10:00:00.000Z')
const PAST = new Date('2026-10-10T10:00:00.000Z')

const managed = (extra = {}) => ({
  _id: 'p1',
  name: 'کارت مدیریت‌شده',
  productType: 'simple',
  price: 990476,
  compareAtPrice: 990476,
  discount: 16,
  isFlashDeal: true,
  flashDealEndTime: PAST,
  isSpecialOffer: false,
  specialOfferEndTime: null,
  pricingMeta: {
    exactFloorPrice: 832000,
    exactFloorPriceAt: FRESH,
    campaignType: 'flash',
  },
  ...extra,
})

test('انقضای پروموشن مستقیم: price ماندگار = exactFloorPrice و needsRefresh روشن می‌شود', () => {
  const update = buildDeactivationUpdate(managed(), { now: NOW })
  assert.equal(update.$set.price, 832000)
  assert.equal(update.$set.discount, 0)
  assert.equal(update.$set.isFlashDeal, false)
  assert.equal(update.$set.isSpecialOffer, false)
  assert.equal(update.$set['pricingMeta.needsRefresh'], true)
  assert.equal(update.$set['pricingMeta.campaignType'], 'none')
  assert.equal(update.$set['pricingMeta.restoredFromPrice'], 990476)
  assert.equal(update.$unset.compareAtPrice, '')
  assert.equal(update.$unset.flashDealEndTime, '')
})

test('عقب‌مانده: discount قبلاً صفر شده ولی price روی سقف مانده (بدون ردّ پروموشن)', () => {
  const legacyZeroed = managed({
    discount: 0,
    isFlashDeal: false,
    flashDealEndTime: null,
  })
  assert.equal(buildManagedRestore(legacyZeroed, NOW).set.price, 832000)
  const plan = planPromotionCleanup(legacyZeroed, NOW)
  assert.ok(plan, 'عقب‌مانده باید پاک‌سازی شود، نه رها')
  assert.equal(plan.$set.price, 832000)
  assert.equal(plan.$set.discount, 0)
})

test('محصول timed_sale دست‌نخورده می‌ماند (جلوگیری از تخفیف دوبل Sale روی کف)', () => {
  const timed = managed({
    discount: 0,
    isFlashDeal: false,
    flashDealEndTime: null,
    pricingMeta: { exactFloorPrice: 832000, exactFloorPriceAt: FRESH, campaignType: 'timed_sale' },
  })
  assert.equal(buildManagedRestore(timed, NOW), null)
  assert.equal(planPromotionCleanup(timed, NOW), null)
  const update = buildDeactivationUpdate(timed, { now: NOW })
  assert.equal(update.$set.price, undefined, 'قیمت timed_sale نباید کف شود')
})

test('محصول متغیر: قیمت ریشه بازنویسی نمی‌شود؛ فقط فلگ/تخفیف پاک می‌شود', () => {
  const variable = managed({
    productType: 'variable',
    price: 1200000,
    variants: [{ _id: 'v1', price: 900000, stock: 3 }],
  })
  assert.equal(buildManagedRestore(variable, NOW), null)
  const plan = planPromotionCleanup(variable, NOW)
  assert.ok(plan, 'فلگ منقضی باید خاموش شود')
  assert.equal(plan.$set.price, undefined, 'قیمت ریشه‌ی محصول متغیر نباید کف شود')
  assert.equal(plan.$set.discount, 0)
})

test('کف قطعی کهنه (بیش از ۱۴ روز) معتبر نیست و قیمت دست نمی‌خورد', () => {
  const stale = managed({
    pricingMeta: {
      exactFloorPrice: 832000,
      exactFloorPriceAt: new Date(NOW.getTime() - (MANAGED_EXACT_FLOOR_MAX_AGE_DAYS + 1) * 86_400_000),
      campaignType: 'flash',
    },
  })
  assert.equal(buildManagedRestore(stale, NOW), null)
  const update = buildDeactivationUpdate(stale, { now: NOW })
  assert.equal(update.$set.price, undefined)
  // ولی فلگ/تخفیف مثل قبل پاک می‌شود
  assert.equal(update.$set.discount, 0)
})

test('timestamp نامعتبر = fail-closed (قیمت دست نمی‌خورد)', () => {
  const broken = managed({
    pricingMeta: { exactFloorPrice: 832000, exactFloorPriceAt: 'not-a-date', campaignType: 'flash' },
  })
  assert.equal(buildManagedRestore(broken, NOW), null)
})

test('محصول بدون pricingMeta: رفتار قبلی حفظ می‌شود (بدون گارد کف)', () => {
  const plain = {
    productType: 'simple',
    price: 1008,
    compareAtPrice: 1200,
    discount: 16,
    isFlashDeal: true,
    flashDealEndTime: PAST,
  }
  const update = buildDeactivationUpdate(plain, { now: NOW })
  assert.equal(update.$set.price, 1200, 'بازگردانی legacy باید همچنان کار کند')
  assert.equal(update.$set['pricingMeta.needsRefresh'], undefined)
})

test('فیلتر کاندیداها: شاخه‌ی عقب‌مانده فقط پروموشن مستقیم را می‌گیرد', () => {
  const filter = staleCandidatesFilter(NOW)
  const backlog = filter.$or[3]
  assert.equal(backlog.productType.$ne, 'variable')
  assert.deepEqual(backlog['pricingMeta.campaignType'].$in, ['flash', 'featured', null])
  assert.equal(backlog.$or.length, 3, 'کف کهنه نباید کاندید شود و batch را اشغال کند')
  assert.deepEqual(backlog.$expr, { $gt: ['$price', '$pricingMeta.exactFloorPrice'] })
})

test('ویرایش ادمین (برداشتن تیک پروموشن): قیمت ماندگار هم کف می‌شود', () => {
  const current = managed({ isFlashDeal: true, flashDealEndTime: PAST })
  const updates = { isFlashDeal: false, flashDealEndTime: null, discount: 0 }
  const unset = {}
  const result = applyOwnPromotionRules(updates, unset, current, NOW)
  assert.equal(result.deactivated, true)
  assert.equal(updates.price, 832000)
  assert.equal(updates['pricingMeta.needsRefresh'], true)
  assert.equal(unset.compareAtPrice, '')
})

test('ویرایش قیمت دستی ادمین هرگز با کف قدیمی بازنویسی نمی‌شود', () => {
  const current = managed({ isFlashDeal: true, flashDealEndTime: PAST })
  const updates = { isFlashDeal: false, flashDealEndTime: null, discount: 0, price: 777000 }
  const unset = {}
  applyOwnPromotionRules(updates, unset, current, NOW)
  assert.equal(updates.price, 777000, 'قیمت صریح ادمین باید حفظ شود')
  assert.equal(updates['pricingMeta.needsRefresh'], undefined)
})
