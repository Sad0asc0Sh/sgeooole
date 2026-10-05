const assert = require('assert')
const { computeItemPricing } = require('../services/pricingService')

const now = new Date('2026-07-17T00:00:00.000Z')

const cases = [
  {
    name: 'no discount',
    item: { product: { productType: 'simple', price: 1000.6, discount: 0 } },
    // بدون تخفیف فعال قیمت نهایی همان price است (بدون رُند)
    expected: 1000.6,
  },
  {
    name: 'active special offer',
    item: { product: { productType: 'simple', price: 1001, discount: 10, isSpecialOffer: true, specialOfferEndTime: '2026-07-18T00:00:00.000Z' } },
    // با تخفیف فعال: Math.round(1001 × 0.9) = 901
    expected: 901,
  },
  {
    name: 'inactive deal (no flash/special)',
    item: { product: { productType: 'simple', price: 1001, discount: 10 } },
    // بدون تخفیف فعال: تخفیف اعمال نمی‌شود و قیمت کامل است
    expected: 1001,
  },
  {
    name: 'active flash deal',
    item: { product: { productType: 'simple', price: 1003, discount: 10, isFlashDeal: true, flashDealEndTime: '2026-07-18T00:00:00.000Z' } },
    // با تخفیف فعال: Math.round(1003 × 0.9) = 903
    expected: 903,
  },
]

for (const testCase of cases) {
  const pricing = computeItemPricing(testCase.item, now)
  // قرارداد قیمت: قیمت نهایی تخفیف‌دار همیشه Math.round می‌شود؛ بدون تخفیف همان price
  assert.strictEqual(pricing.finalPrice, testCase.expected, `${testCase.name}: checkout follows the price contract`)
  console.log(`${testCase.name}: checkout=${pricing.finalPrice}`)
}
