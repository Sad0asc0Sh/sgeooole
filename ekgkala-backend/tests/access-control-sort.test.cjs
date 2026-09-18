const assert = require('node:assert/strict')
const test = require('node:test')
const { checkProductAccess } = require('../middleware/accessControl')

test('public users can sort by all standard storefront options', () => {
  const publicSorts = [
    'newest',
    'oldest',
    'priceAsc',
    'priceDesc',
    'bestSelling',
    'bestseller',
    'bestSellers',
    'popularity',
    'mostVisited',
    'discount',
    'flash',
    'special',
    'rating',
    '-rating',
    'relevance',
    'name',
    '-name',
    'price',
    '-price',
    'createdAt',
    '-createdAt',
  ]

  for (const sortOption of publicSorts) {
    const req = { query: { sort: sortOption }, user: null }
    const res = {}
    let nextCalled = false
    checkProductAccess(req, res, () => { nextCalled = true })

    assert.equal(nextCalled, true, `next() should be called for sort=${sortOption}`)
    assert.equal(
      req.query.sort,
      sortOption,
      `sort=${sortOption} should be preserved for public users, not overwritten`,
    )
  }
})

test('admin-only sensitive fields are still blocked and reset for non-admins', () => {
  const adminSorts = ['costPrice', '-costPrice', 'profitMargin', '-profitMargin', 'stock', '-stock']

  for (const sortOption of adminSorts) {
    const req = { query: { sort: sortOption }, user: null }
    const res = {}
    checkProductAccess(req, res, () => {})

    assert.equal(
      req.query.sort,
      '-createdAt',
      `admin-only sort=${sortOption} must be reset to -createdAt for public users`,
    )
  }
})
