// Offline: timer-aware overlay for product detail endpoints + cache TTL cap. No DB.
const assert = require('node:assert/strict')
const test = require('node:test')
const { applyPromotionOverlay, ttlUntil } = require('../services/pricingService')

const now = new Date('2026-09-30T10:00:00Z')
const future = new Date('2026-10-05T10:00:00Z')
const past = new Date('2026-09-29T10:00:00Z')
const base = (extra = {}) => ({ price: 4800000, discount: 0, variants: [], ...extra })

test('active Sale: discount, label, theme and end time are applied; TTL is capped to the Sale end', () => {
  const p = base()
  const { promotionEndsAt } = applyPromotionOverlay(p, { activeSale: { name: 'تخفیفات پاییزه', discountPercentage: 6, badgeTheme: 'gold-red', endDate: future }, now })
  assert.equal(p.price, 4512000)
  assert.equal(p.compareAtPrice, 4800000)
  assert.equal(p.campaignLabel, 'تخفیفات پاییزه')
  assert.equal(p.campaignTheme, 'gold-red')
  assert.equal(p.isSpecialOffer, true)
  assert.deepEqual(promotionEndsAt, future)
  assert.equal(ttlUntil(new Date(now.getTime() + 90_000), 300, now), 90)
  assert.equal(ttlUntil(future, 300, now), 300)
  assert.equal(ttlUntil(null, 300, now), 300)
  assert.equal(ttlUntil(new Date(now.getTime() + 200), 300, now), 1)
})

test('expired Sale (no activeSale) leaves no label, no discount and the base price', () => {
  const p = base()
  const { promotionEndsAt } = applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.price, 4800000)
  assert.equal(p.campaignLabel, undefined)
  assert.equal(p.compareAtPrice, undefined)
  assert.equal(promotionEndsAt, null)
})

test('expired flash deal with a stored discount: NO discount, NO label (regression: used to keep both)', () => {
  const p = base({ discount: 20, isFlashDeal: true, flashDealEndTime: past })
  applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.price, 4800000)
  assert.equal(p.discount, 0)
  assert.equal(p.campaignLabel, undefined)
  assert.equal(p.compareAtPrice, undefined)
})

test('expired special offer with a stored discount: no discount either', () => {
  const p = base({ discount: 10, isSpecialOffer: true, specialOfferEndTime: past })
  applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.price, 4800000)
  assert.equal(p.discount, 0)
})

test('live flash deal: discount + flash label, TTL ends at flash end', () => {
  const p = base({ discount: 20, isFlashDeal: true, flashDealEndTime: future })
  const { promotionEndsAt } = applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.price, 3840000)
  assert.equal(p.compareAtPrice, 4800000)
  assert.equal(p.campaignLabel, 'پیشنهاد لحظه‌ای')
  assert.deepEqual(promotionEndsAt, future)
})

test('plain product discount without timer flags is unaffected; live special offer gets no flash label', () => {
  const plain = base({ discount: 10 })
  applyPromotionOverlay(plain, { activeSale: null, now })
  assert.equal(plain.price, 4320000)
  assert.equal(plain.campaignLabel, undefined)

  const special = base({ discount: 10, isSpecialOffer: true, specialOfferEndTime: future })
  applyPromotionOverlay(special, { activeSale: null, now })
  assert.equal(special.price, 4320000)
  assert.equal(special.campaignLabel, undefined)
})

test('Sale ends exactly at now: caller filters with $gt, overlay treats endDate<=now as ended for TTL', () => {
  const p = base()
  const { promotionEndsAt } = applyPromotionOverlay(p, { activeSale: { name: 'X', discountPercentage: 5, endDate: now }, now })
  assert.equal(promotionEndsAt, null)
})
