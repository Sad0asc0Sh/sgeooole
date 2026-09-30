// Offline aggregation fixture: no MongoDB connection, server, environment, or DB writes.
const assert = require('node:assert/strict')
const test = require('node:test')
const qs = require('qs')
const mongoose = require('mongoose')
require('mingo/init/system')
const { aggregate, Query } = require('mingo')
const { parseListingQuery, buildListingPipeline, listProducts, ListingQueryError } = require('../services/productListingService')

const now = new Date('2026-09-17T12:00:00Z')
const future = new Date('2026-09-18T12:00:00Z')
const past = new Date('2026-09-16T12:00:00Z')
const id = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'))
const brandA = id(101)
const brandB = id(102)
const parent = id(201)
const child = id(202)
const other = id(203)
const product = (n, values = {}) => ({ _id: id(n), name: `Product ${n}`, isActive: true, price: 1000, stock: 2, rating: 4, discount: 0, createdAt: now, variants: [], ...values })
const run = (products, query = {}, campaigns = []) => aggregate(products, buildListingPipeline(parseListingQuery(query), { campaigns }, now))[0]
const ids = (result) => result.data.map((p) => String(p._id))
const count = (result) => result.total[0]?.count || 0

// Real emitted pipeline runs on Mingo. This is not a handwritten pricing/query mock.
// Mongo-specific ObjectId/graph traversal context is additionally checked below.
test('discounted filtering, count, sorting and range all precede pagination', () => {
  const products = [product(3, { price: 900 }), product(2, { price: 1500, discount: 60 }), product(1, { price: 1200, discount: 50 })]
  const first = run(products, { maxPrice: '700', sort: 'priceAsc', limit: '1' })
  assert.deepEqual(ids(first), [String(id(1))])
  assert.equal(first.data[0].price, 600)
  assert.equal(first.data[0].compareAtPrice, 1200)
  assert.equal(count(first), 2)
  assert.deepEqual(first.priceRange, [{ _id: null, min: 600, max: 900 }])
  const second = run(products, { maxPrice: '700', sort: 'priceAsc', limit: '1', page: '2' })
  assert.deepEqual(ids(second), [String(id(2))])
  assert.equal(count(second), 2)
  assert.deepEqual(ids(run(products, { sort: '-price' })), [id(3), id(1), id(2)].map(String))
})

test('precomputed discounts use compareAtPrice once; Math.round halves not bankers rounding', () => {
  const result = run([product(1, { price: 800, compareAtPrice: 1000, discount: 20 }), product(2, { price: 1005, discount: 50 })], { sort: 'priceAsc' })
  assert.deepEqual(result.data.map((p) => p.price), [503, 800])
  assert.equal(result.data[1].compareAtPrice, 1000)
})

test('timed offers expire strictly, restore base price and do not match onSale', () => {
  const products = [
    product(1, { price: 800, compareAtPrice: 1000, discount: 20, isFlashDeal: true, flashDealEndTime: past }),
    product(2, { price: 1000, discount: 20, isSpecialOffer: true, specialOfferEndTime: now }),
    product(3, { price: 1000, discount: 20, isFlashDeal: true, flashDealEndTime: future }),
    product(4, { price: 1000, discount: 20, isFlashDeal: true }),
    product(5, { price: 800, compareAtPrice: 1000 }),
  ]
  const all = run(products)
  assert.deepEqual(all.data.map((p) => p.price), [1000, 1000, 800, 800, 800])
  assert.deepEqual(all.data.map((p) => p.discount), [0, 0, 20, 20, 0])
  const sales = run(products, { onSale: 'true' })
  assert.deepEqual(ids(sales), [3, 4, 5].map((n) => String(id(n))))
  assert.equal(count(run(products, { maxPrice: '900' })), 3)
})

test('direct campaign overrides category campaign and existing product discount', () => {
  const campaigns = [
    { products: [], categories: [child], name: '$Category literal', discountPercentage: 80, endDate: future },
    { products: [id(1)], categories: [], name: 'Direct', discountPercentage: 30, endDate: future, badgeTheme: 'gold-red' },
  ]
  const result = run([product(1, { category: child, discount: 90 }), product(2, { category: child })], { sort: 'priceAsc' }, campaigns)
  assert.deepEqual(result.data.map((p) => p.price), [200, 700])
  assert.equal(result.data[0].campaignLabel, '$Category literal')
  assert.equal(result.data[1].campaignLabel, 'Direct')
  assert.equal(result.data[1].isSpecialOffer, true)
  assert.equal(result.data[1].campaignTheme, 'gold-red')
  assert.deepEqual(result.data[1].specialOfferEndTime, future)
  assert.equal(count(run([product(1, { category: child })], { maxPrice: '600' }, campaigns)), 0)
})

test('variable display price is minimum discounted variant and stock is summed', () => {
  const variable = product(1, { productType: 'variable', price: 1, stock: 0, discount: 20, variants: [
    { sku: 'blue', price: 600, stock: 0 }, { sku: 'red', price: 1000, stock: 3 }, { price: 800, stock: 2 },
  ] })
  const result = run([variable], { inStock: 'true', minPrice: '480', maxPrice: '480', onSale: 'true' })
  assert.equal(count(result), 1)
  assert.equal(result.data[0].price, 480)
  assert.equal(result.data[0].compareAtPrice, 600)
  assert.equal(result.data[0].stock, 5)
  assert.deepEqual(result.data[0].variants.map((v) => v.price), [480, 800, 640])
  assert.equal(count(run([{ ...variable, variants: [{ price: 200, stock: 0 }], stock: 99 }], { inStock: 'true' })), 0)
  assert.equal(count(run([{ ...variable, variants: [], stock: 99 }], { inStock: 'true' })), 0)
})

test('zero bounds are valid; zero-price and 100% discounts are not lost', () => {
  const result = run([product(1, { price: 0 }), product(2, { price: 100, discount: 100 }), product(3)], { minPrice: '0', maxPrice: '0' })
  assert.deepEqual(result.data.map((p) => p.price), [0, 0])
  assert.equal(count(result), 2)
  assert.equal(count(run([product(1, { price: 100, discount: 100 })], { onSale: 'true', maxPrice: '0' })), 1)
  const zero = run([product(1, { price: 0, compareAtPrice: 100, discount: 20, isFlashDeal: true, flashDealEndTime: future })], { onSale: 'true', maxPrice: '0' })
  assert.equal(count(zero), 1)
  assert.equal(zero.data[0].price, 0)
  assert.equal(zero.data[0].compareAtPrice, 100)
})

test('properties use OR within label and AND across labels, minRating and stock combine', () => {
  const products = [
    product(1, { properties: [{ label: 'رنگ', value: 'قرمز' }, { label: 'Resolution', value: '4K' }] }),
    product(2, { properties: [{ label: 'رنگ', value: 'آبی' }, { label: 'Resolution', value: '4K' }] }),
    product(3, { rating: 2, properties: [{ label: 'رنگ', value: 'آبی' }, { label: 'Resolution', value: '4K' }] }),
    product(4, { properties: [{ label: 'رنگ', value: 'قرمز' }, { label: 'Resolution', value: '1080p' }] }),
    product(5, { stock: 0, properties: [{ label: 'رنگ', value: 'قرمز' }, { label: 'Resolution', value: '4K' }] }),
  ]
  const query = qs.parse('properties[رنگ]=قرمز&properties[رنگ]=آبی&properties[Resolution]=4K&minRating=4&inStock=true')
  assert.deepEqual(query.properties['رنگ'], ['قرمز', 'آبی'])
  assert.deepEqual(ids(run(products, query)), [String(id(1)), String(id(2))])
  assert.deepEqual(parseListingQuery({ 'properties[رنگ]': ['قرمز', 'آبی'] }).properties.get('رنگ'), ['قرمز', 'آبی'])
})

test('legacy advanced filters, inactive access, dates and raw admin behavior', () => {
  const p = product(1, { price: 1200, discount: 50, stock: 3, isActive: false, isFlashDeal: true, flashDealEndTime: future, salesCount: 2 })
  assert.equal(count(run([p])), 0)
  const q = { skipDiscount: 'true', includeInactive: 'true', 'price[gte]': '1000', 'price[lte]': '1500', stock: { eq: '3' }, isActive: { eq: 'false' }, 'flashDealEndTime[gt]': now.toISOString(), minSalesCount: '1' }
  const result = run([p], q)
  assert.equal(count(result), 1)
  assert.deepEqual(result.data[0], p)
  assert.equal(result.priceRange[0].min, 1200)
  assert.equal(count(run([p], { ...q, skipDiscount: 'false' })), 0)
})

test('projection happens after pricing and cannot leak internal sort fields', () => {
  const p = product(1, { price: 1200, discount: 50, sku: 'Exact' })
  const result = run([p], { fields: 'name,price,-_id', search: 'Exact' })
  assert.deepEqual(result.data, [{ name: 'Product 1', price: 600 }])
  assert.equal(JSON.stringify(result).includes('__listing'), false)
  assert.equal(run([p], { fields: '-discount' }).data[0].price, 600)
})

test('Persian normalized literal search and exact SKU priority survive stable sorting', () => {
  const products = [product(1, { name: 'كالا ١ **' }), product(2, { name: 'Product 2', sku: 'کالا ۱ **' })]
  const result = run(products, { search: 'کالا ۱ **', sort: 'newest' })
  assert.deepEqual(ids(result), [String(id(2)), String(id(1))])
  assert.equal(count(run(products, { search: '**', searchField: 'name' })), 1)
})

test('invalid numeric, nested, projection and pagination input is rejected safely', () => {
  for (const value of ['NaN', 'Infinity', '-1', '', 'bad', {}, [], true]) {
    assert.throws(() => parseListingQuery({ minPrice: value }), ListingQueryError)
    assert.throws(() => parseListingQuery({ maxPrice: value }), ListingQueryError)
  }
  for (const query of [{ page: '-1' }, { page: '1.2' }, { limit: '0' }, { minRating: '6' }, { minPrice: '2', maxPrice: '1' }, { properties: 'bad' }, { properties: { Color: { gt: '1' } } }, { fields: 'price,-stock' }, { fields: '__listing.price' }]) {
    assert.throws(() => parseListingQuery(query), ListingQueryError)
  }
  const options = parseListingQuery({ page: '9999999', limit: '50000', sort: '-notAField' })
  assert.equal(options.page, 100000)
  assert.equal(options.limit, 100)
  assert.deepEqual(options.sort, { createdAt: -1, _id: 1 })
})

// Metadata model fixture exercises the async service and aggregation together.
function fixtureModels(products, sales = []) {
  const brands = [{ _id: brandA, slug: 'alpha' }, { _id: brandB, slug: 'beta' }]
  const categories = [{ _id: parent, slug: 'parent' }, { _id: child, slug: 'child', parent }, { _id: other, slug: 'other' }]
  const chain = (value) => ({ select() { return this }, sort() { return this }, lean: async () => value })
  const calls = { products: 0, saleQueries: [], graphQueries: [] }
  return {
    calls,
    Product: { aggregate: (pipeline) => {
      calls.products++
      return { allowDiskUse: async () => aggregate(products, pipeline) }
    } },
    Brand: { find: (query) => chain(new Query(query).find(brands).all()) },
    Category: {
      collection: { name: 'categories' },
      findOne: (query) => chain(new Query(query).find(categories).all()[0] || null),
      aggregate: async (pipeline) => {
        calls.graphQueries.push(pipeline)
        assert.ok(pipeline[0].$match._id instanceof mongoose.Types.ObjectId)
        const cat = String(pipeline[0].$match._id)
        return [{ ids: cat === String(parent) ? [child] : [] }]
      },
    },
    Sale: { find: (query) => {
      calls.saleQueries.push(query)
      return chain(new Query(query).find(sales).all())
    } },
  }
}

test('mixed brand slug/IDs, category descendants, campaign windows and response contract', async () => {
  const products = [product(1, { brand: brandA, category: child }), product(2, { brand: brandB, category: parent }), product(3, { brand: brandB, category: other })]
  const sales = [
    { _id: id(301), isActive: true, startDate: past, endDate: future, name: 'Parent sale', discountPercentage: 20, categories: [parent] },
    { _id: id(302), isActive: true, startDate: past, endDate: now, name: 'Expired direct', discountPercentage: 90, products: [id(1)] },
    { _id: id(303), isActive: true, startDate: future, endDate: future, name: 'Future direct', discountPercentage: 90, products: [id(1)] },
  ]
  const models = fixtureModels(products, sales)
  const result = await listProducts({ brand: `alpha,${brandB},missing`, category: 'parent', includeChildren: 'true', maxPrice: '850', limit: '1' }, models, now)
  assert.equal(result.data[0].price, 800)
  assert.deepEqual(result.pagination, { currentPage: 1, itemsPerPage: 1, totalItems: 2, totalPages: 2 })
  assert.deepEqual(result.priceRange, { min: 800, max: 800 })
  assert.equal(models.calls.products, 1, 'single product aggregation, not an unbounded find')
  assert.equal(models.calls.graphQueries.length, 1, 'descendants cached within the request')
  assert.deepEqual(models.calls.saleQueries[0].endDate, { $gt: now })
  assert.equal((await listProducts({ brand: 'unknown' }, models, now)).pagination.totalItems, 0)
  assert.equal((await listProducts({ category: 'unknown' }, models, now)).pagination.totalItems, 0)
  assert.equal((await listProducts({ category: String(child) }, models, now)).pagination.totalItems, 1)
})

test('category sale includeSubcategories=false excludes child and admin skips sales lookup', async () => {
  const products = [product(1, { category: child }), product(2, { category: parent })]
  const models = fixtureModels(products, [{ _id: id(301), isActive: true, startDate: past, endDate: future, name: 'Parent only', discountPercentage: 20, categories: [parent], includeSubcategories: false }])
  const result = await listProducts({ onSale: 'true' }, models, now)
  assert.deepEqual(ids(result), [String(id(2))])
  const admin = fixtureModels(products)
  await listProducts({ skipDiscount: 'true' }, admin, now)
  assert.equal(admin.calls.saleQueries.length, 0)
})

test('production query sanitizers and hpp preserve repeated nested properties', () => {
  const mongoSanitize = require('express-mongo-sanitize')
  const hpp = require('hpp')
  const { noSqlInjectionPrevention } = require('../middleware/noSqlInjection')
  const req = { headers: {}, query: qs.parse('properties[رنگ]=قرمز&properties[رنگ]=آبی&properties[Resolution]=4K&brand=alpha,beta'), body: {}, params: {} }
  const res = { status() { throw new Error('Unexpected middleware rejection') } }
  let nextCalls = 0
  for (const middleware of [mongoSanitize(), noSqlInjectionPrevention(), hpp()]) middleware(req, res, () => nextCalls++)
  assert.equal(nextCalls, 3)
  assert.deepEqual(parseListingQuery(req.query).properties.get('رنگ'), ['قرمز', 'آبی'])
  assert.deepEqual(parseListingQuery(req.query).brands, ['alpha', 'beta'])
})

test('featured=true: manual special offers + only showInFeatured campaigns, with campaign label', () => {
  const products = [
    product(1, { discount: 10, isSpecialOffer: true, specialOfferEndTime: future }), // manual شگفت‌انگیز
    product(2, {}), // in featured sale
    product(3, {}), // in NON-featured sale
    product(4, {}), // plain
    product(5, { discount: 10, isSpecialOffer: true, specialOfferEndTime: past }), // expired manual
  ]
  const campaigns = [
    { _id: id(301), name: 'ویژه پاییز', discountPercentage: 20, badgeTheme: 'gold-red', endDate: future, products: [id(2)], categories: [], showInFeatured: true },
    { _id: id(302), name: 'بی‌سر و صدا', discountPercentage: 30, badgeTheme: 'green-orange', endDate: future, products: [id(3)], categories: [], showInFeatured: false },
  ]
  // The Mongo-level pre-filter is applied by resolveListingContext; emulate it with the same $or so Mingo sees the real pipeline.
  const pre = [{ $or: [{ isSpecialOffer: true, specialOfferEndTime: { $gt: now } }, { _id: { $in: [id(2)] } }] }]
  const opts = parseListingQuery({ featured: 'true', sort: 'newest' })
  const result = aggregate(products, buildListingPipeline(opts, { conditions: pre, campaigns }, now))[0]
  assert.deepEqual(ids(result).sort(), [id(1), id(2)].map(String).sort())
  const sale = result.data.find((p) => String(p._id) === String(id(2)))
  assert.equal(sale.campaignLabel, 'ویژه پاییز')
  assert.equal(sale.discount, 20)

  // Non-featured campaign product is never returned even if a pre-filter lets it through.
  const leaky = aggregate(products, buildListingPipeline(opts, { conditions: [], campaigns }, now))[0]
  assert.ok(!ids(leaky).includes(String(id(3))))
  assert.ok(!ids(leaky).includes(String(id(4))))
  assert.ok(!ids(leaky).includes(String(id(5))))
})

test('showInFeatured=false only hides from the featured rail; normal pricing is untouched', () => {
  const products = [product(3, {})]
  const campaigns = [
    { _id: id(302), name: 'بی‌سر و صدا', discountPercentage: 30, badgeTheme: 'green-orange', endDate: future, products: [id(3)], categories: [], showInFeatured: false },
  ]
  const result = run(products, {}, campaigns)
  assert.deepEqual(ids(result), [String(id(3))])
  assert.equal(result.data[0].discount, 30)
  assert.equal(result.data[0].price, 700)
  assert.equal(result.data[0].campaignLabel, 'بی‌سر و صدا')
  assert.equal(result.data[0].isSpecialOffer, true)
  assert.deepEqual(result.data[0].specialOfferEndTime, future)
})

test('featured=true keeps only TIMED manual specials; indefinite ones stay out of the rail', () => {
  const products = [
    product(1, { discount: 10, isSpecialOffer: true, specialOfferEndTime: future }), // timed manual
    product(6, { discount: 10, isSpecialOffer: true }), // indefinite manual (no end time)
  ]
  const opts = parseListingQuery({ featured: 'true', sort: 'newest' })
  // Pre-filter mirror of resolveListingContext: only timed manuals pass at the Mongo level.
  const pre = [{ $or: [{ isSpecialOffer: true, specialOfferEndTime: { $gt: now } }] }]
  const result = aggregate(products, buildListingPipeline(opts, { conditions: pre, campaigns: [] }, now))[0]
  assert.deepEqual(ids(result), [String(id(1))])
})

test('featured=true: campaign products come before manual specials (rail limit safety)', () => {
  const products = [
    product(1, { discount: 10, isSpecialOffer: true, specialOfferEndTime: future, createdAt: future }), // manual, NEWER
    product(2, { createdAt: past }), // in featured sale, OLDER
  ]
  const campaigns = [
    { _id: id(301), name: 'ویژه پاییزه', discountPercentage: 20, badgeTheme: 'gold-red', endDate: future, products: [id(2)], categories: [], showInFeatured: true },
  ]
  const pre = [{ $or: [{ isSpecialOffer: true, specialOfferEndTime: { $gt: now } }, { _id: { $in: [id(2)] } }] }]
  // با limit=1 فقط محصول کمپین برمی‌گردد، با اینکه شگفت‌انگیز دستی جدیدتر است
  const opts = parseListingQuery({ featured: 'true', sort: 'newest', limit: '1' })
  const result = aggregate(products, buildListingPipeline(opts, { conditions: pre, campaigns }, now))[0]
  assert.deepEqual(ids(result), [String(id(2))])
  assert.equal(result.data[0].campaignLabel, 'ویژه پاییزه')

  // بدون limit: کمپین اول، بعد دستی (هر گروه با newest)
  const all = aggregate(products, buildListingPipeline(parseListingQuery({ featured: 'true', sort: 'newest' }), { conditions: pre, campaigns }, now))[0]
  assert.deepEqual(ids(all), [String(id(2)), String(id(1))])
})
