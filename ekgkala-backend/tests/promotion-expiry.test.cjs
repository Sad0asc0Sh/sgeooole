// Offline: timer-aware overlay for product detail endpoints + cache TTL cap. No DB.
const assert = require('node:assert/strict')
const test = require('node:test')
require('mingo/init/system')
const { aggregate } = require('mingo')
const { applyPromotionOverlay, ttlUntil } = require('../services/pricingService')
const { parseListingQuery, buildListingPipeline } = require('../services/productListingService')

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

test('product discount without active deal is stripped (price remains base); live special offer gets discount but no flash label', () => {
  const plain = base({ discount: 10 })
  applyPromotionOverlay(plain, { activeSale: null, now })
  assert.equal(plain.price, 4800000)
  assert.equal(plain.discount, 0)
  assert.equal(plain.campaignLabel, undefined)
  assert.equal(plain.compareAtPrice, undefined)

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

test('expired flash on LEGACY pre-discounted data (price=970k, compare=1M, discount=3): detail restores 1,000,000 like the listing', () => {
  const p = base({ price: 970000, compareAtPrice: 1000000, discount: 3, isFlashDeal: true, flashDealEndTime: past })
  applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.price, 1000000)
  assert.equal(p.discount, 0)
  assert.equal(p.compareAtPrice, undefined)
  assert.equal(p.campaignLabel, undefined)
})

test('expired flash: a stale inflated compareAtPrice that does not match the stored discount never inflates the price', () => {
  const p = base({ price: 4800000, compareAtPrice: 30000000, discount: 6, isFlashDeal: true, flashDealEndTime: past })
  applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.price, 4800000) // used to jump to 30,000,000
  assert.equal(p.compareAtPrice, undefined)
})

test('expired timer restores variant base prices only for legacy-consistent variants', () => {
  const p = base({ discount: 10, isSpecialOffer: true, specialOfferEndTime: past, variants: [
    { sku: 'a', price: 900, compareAtPrice: 1000 },
    { sku: 'b', price: 500, compareAtPrice: 9000 },
  ] })
  applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.variants[0].price, 1000)
  assert.equal(p.variants[1].price, 500)
  assert.equal(p.variants[0].compareAtPrice, undefined)
})

test('parity: expired listing pipeline and detail overlay agree on the base price', () => {
  const cases = [
    { price: 4800000, compareAtPrice: undefined, discount: 6, label: 'normal' },
    { price: 970000, compareAtPrice: 1000000, discount: 3, label: 'legacy' },
    { price: 4800000, compareAtPrice: 30000000, discount: 6, label: 'stale' },
  ]
  for (const [i, c] of cases.entries()) {
    const doc = {
      _id: `0000000000000000000000${10 + i}`,
      name: `P${i}`, isActive: true, price: c.price, discount: c.discount,
      stock: 2, rating: 4, createdAt: now, variants: [], productType: 'simple',
      isFlashDeal: true, flashDealEndTime: past,
      ...(c.compareAtPrice === undefined ? {} : { compareAtPrice: c.compareAtPrice }),
    }
    const [listed] = aggregate([doc], buildListingPipeline(parseListingQuery({}), { campaigns: [] }, now))[0].data
    const detail = { price: c.price, discount: c.discount, isFlashDeal: true, flashDealEndTime: past, variants: [], ...(c.compareAtPrice === undefined ? {} : { compareAtPrice: c.compareAtPrice }) }
    applyPromotionOverlay(detail, { activeSale: null, now })
    assert.equal(listed.price, detail.price, `price parity for ${c.label}`)
    assert.equal(listed.discount, detail.discount, `discount parity for ${c.label}`)
    assert.equal(listed.compareAtPrice, undefined, `no strike for ${c.label}`)
    assert.equal(detail.compareAtPrice, undefined, `no strike (detail) for ${c.label}`)
  }
})
