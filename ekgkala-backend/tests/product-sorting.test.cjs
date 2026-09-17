const assert = require('node:assert/strict')
const test = require('node:test')
require('mingo/init/system')
const { aggregate } = require('mingo')
const { parseListingQuery, buildListingPipeline } = require('../services/productListingService')

const now = new Date('2026-09-17T12:00:00Z')
const product = (_id, fields = {}) => ({ _id, name: 'Camera', isActive: true, price: 1000, stock: 1, discount: 0, createdAt: now, ...fields })
const run = (items, query = {}) => aggregate(items, buildListingPipeline(parseListingQuery(query), undefined, now))[0]
const ids = (result) => result.data.map((item) => item._id)

test('explicit price order takes precedence over exact SKU search matches', () => {
  const items = [product(1, { sku: 'Camera', price: 2000 }), product(2, { price: 500 })]
  assert.deepEqual(ids(run(items, { search: 'Camera', sort: 'priceAsc' })), [2, 1])
})

test('discount order uses actual price reduction including compare-only markdowns', () => {
  const items = [product(1, { discount: 10 }), product(2, { price: 500, compareAtPrice: 1000 }), product(3, { price: 600, compareAtPrice: 1000, discount: 40, isFlashDeal: true, flashDealEndTime: new Date('2020-01-01') })]
  assert.deepEqual(ids(run(items, { sort: 'discount' })), [2, 1, 3])
})

for (const [sort, expected] of [
  ['newest', [3, 2, 1]], ['oldest', [1, 2, 3]], ['priceAsc', [2, 3, 1]], ['priceDesc', [1, 3, 2]],
  ['bestSelling', [2, 1, 3]], ['mostVisited', [3, 1, 2]], ['popularity', [3, 1, 2]],
  ['rating', [2, 1, 3]], ['nameAsc', [2, 1, 3]], ['nameDesc', [3, 1, 2]],
]) {
  test(`${sort}: correct ordering without changing result membership`, () => {
    const items = [
      product(1, { name: 'Beta', price: 300, salesCount: 2, views: 3, rating: 5, numReviews: 2, createdAt: new Date('2020-01-01') }),
      product(2, { name: 'Alpha', price: 100, salesCount: 4, views: 1, rating: 5, numReviews: 8, createdAt: new Date('2021-01-01') }),
      product(3, { name: 'Gamma', price: 200, salesCount: 0, views: 6, rating: 4, numReviews: 20, createdAt: new Date('2022-01-01') }),
    ]
    const result = run(items, { sort })
    assert.deepEqual(ids(result), expected)
    assert.equal(result.total[0].count, 3)
    assert.equal(JSON.stringify(result).includes('__listing'), false)
  })
}

test('all named modes produce stable disjoint pages for tied metrics', () => {
  const items = [3, 1, 4, 2].map((id) => product(id))
  for (const sort of ['newest', 'oldest', 'priceAsc', 'priceDesc', 'bestSelling', 'mostVisited', 'rating', 'discount', 'nameAsc', 'nameDesc', 'relevance']) {
    const query = { sort, limit: '2', search: 'Camera' }
    assert.deepEqual(ids(run(items, query)), [1, 2])
    assert.deepEqual(ids(run(items, { ...query, page: '2' })), [3, 4])
  }
})

test('relevance defaults for search and normalizes Persian/Arabic exact SKU and names', () => {
  const items = [product(1, { name: 'مدل کالا ۱' }), product(2, { name: 'کالا ۱ مدل' }), product(3, { name: 'کالا ۱' }), product(4, { variants: [{ sku: 'كالا ١', price: 100, stock: 1 }] })]
  assert.equal(parseListingQuery({ search: 'کالا ۱' }).sortMode, 'relevance')
  assert.deepEqual(ids(run(items, { search: 'کالا ۱' })), [4, 3, 2, 1])
  assert.equal(parseListingQuery({ sort: 'relevance' }).sortMode, 'newest')
})

test('missing numeric metrics sort as zero; rating ties use review count', () => {
  const items = [product(1), product(2, { salesCount: null, views: null }), product(3, { salesCount: 10, views: 5 })]
  assert.deepEqual(ids(run(items, { sort: 'bestSelling' })), [3, 1, 2])
  assert.deepEqual(ids(run(items, { sort: 'mostVisited' })), [3, 1, 2])
})

test('variable price and active campaign discount determine ordering', () => {
  const items = [product(1, { price: 500 }), product(2, { price: 1, productType: 'variable', variants: [{ price: 800, stock: 1 }, { price: 700, stock: 0 }] })]
  assert.deepEqual(ids(run(items, { sort: 'priceAsc' })), [1, 2])
  const campaigns = [{ products: [2], categories: [], discountPercentage: 50, name: 'Sale', endDate: new Date('2099-01-01') }]
  const result = aggregate(items, buildListingPipeline(parseListingQuery({ sort: 'discount' }), { campaigns }, now))[0]
  assert.deepEqual(ids(result), [2, 1])
})

test('legacy raw admin sort fields and explicit ID direction remain supported', () => {
  const items = [product(1, { discount: 10 }), product(2, { discount: 20 })]
  assert.deepEqual(ids(run(items, { skipDiscount: 'true', sort: '-discount' })), [2, 1])
  assert.deepEqual(ids(run(items, { skipDiscount: 'true', sort: '-_id' })), [2, 1])
})
