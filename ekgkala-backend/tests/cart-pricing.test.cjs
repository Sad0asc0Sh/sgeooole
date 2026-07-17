const assert = require('assert')
const { computeItemPricing } = require('../services/pricingService')

const now = new Date('2026-07-17T00:00:00.000Z')

const cases = [
  {
    name: 'no discount',
    item: { product: { productType: 'simple', price: 1000.6, discount: 0 } },
    beforeRound: 1000.6,
    roundedValue: 1001,
  },
  {
    name: 'regular discount',
    item: { product: { productType: 'simple', price: 1001, discount: 10 } },
    beforeRound: 900.9,
    roundedValue: 901,
  },
  {
    name: 'active flash deal',
    item: { product: { productType: 'simple', price: 1003, discount: 10, isFlashDeal: true, flashDealEndTime: '2026-07-18T00:00:00.000Z' } },
    beforeRound: 902.7,
    roundedValue: 903,
  },
]

for (const testCase of cases) {
  const pricing = computeItemPricing(testCase.item, now)
  assert.strictEqual(pricing.finalPrice, testCase.beforeRound, `${testCase.name}: preserves checkout calculation`)
  assert.notStrictEqual(pricing.finalPrice, testCase.roundedValue, `${testCase.name}: differs from the Torob-only rounded value`)
  console.log(`${testCase.name}: checkout=${pricing.finalPrice}, torobRounded=${testCase.roundedValue}`)
}
