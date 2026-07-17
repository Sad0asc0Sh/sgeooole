const assert = require('assert')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { flattenProduct, mapTorobProduct } = require('../utils/torobMapper')
const { extractProductCode, parsePageUnique, validateRequest } = require('../controllers/torobController')
const { torobAuth } = require('../middleware/torobAuth')

process.env.FRONTEND_URL = 'https://www.ekgkala.ir/'

const product = {
  _id: '123', productCode: 'KY-0000001', slug: 'test-product', name: 'Test product',
  description: '<p> A <strong>description</strong> </p>', productType: 'variable', isActive: true,
  discount: 10, compareAtPrice: 1500, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z',
  category: { name: 'Test category' }, images: [{ url: 'https://cdn.example/product.jpg' }],
  properties: [{ label: 'Material', value: 'Steel' }], specifications: { Brand: 'EkgKala' },
  variants: [{ _id: '507f1f77bcf86cd799439011', price: 1200, stock: 2, options: [{ name: 'Color', value: 'Blue' }], images: [{ url: 'https://cdn.example/blue.jpg' }] }],
}

const rows = flattenProduct(product)
assert.strictEqual(rows.length, 1)
assert.deepStrictEqual(rows[0].page_unique, 'KY-0000001_507f1f77bcf86cd799439011')
assert.strictEqual(rows[0].page_url, 'https://www.ekgkala.ir/product/ky-0000001/test-product')
assert.strictEqual(rows[0].current_price, 1080)
assert.strictEqual(rows[0].old_price, 1500)
assert.deepStrictEqual(rows[0].image_links, ['https://cdn.example/blue.jpg'])
assert.strictEqual(rows[0].short_desc, 'A description')
assert.strictEqual(rows[0].availability, true)
assert.strictEqual(flattenProduct({ ...product, isActive: false }).length, 0)
assert.strictEqual(mapTorobProduct({ ...product, productType: 'simple', stock: 0, price: 99 }).availability, false)

assert.strictEqual(validateRequest({}), 'request body is empty')
assert.strictEqual(validateRequest({ page: 1 }), 'sort parameter is not provided')
assert.strictEqual(validateRequest({ page: 1, sort: 'invalid' }), 'sort value is invalid')
assert.strictEqual(validateRequest({ page: 1, sort: 'date_added_desc', page_urls: ['x'] }), 'only one of page_urls, page_uniques or page+sort must be provided')
assert.strictEqual(validateRequest({ page_uniques: [] }), 'page_uniques must be a non-empty array')
assert.strictEqual(validateRequest({ page: 1, sort: 'date_added_desc' }), null)
assert.deepStrictEqual(parsePageUnique('ky-0000001_507f1f77bcf86cd799439011'), { productCode: 'KY-0000001', variantId: '507f1f77bcf86cd799439011' })
assert.strictEqual(extractProductCode('https://www.ekgkala.ir/product/ky-0000001/test-product'), 'KY-0000001')

const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.TOROB_PUBLIC_KEY = keys.publicKey.export({ type: 'spki', format: 'pem' })
const token = jwt.sign({ sub: 'torob' }, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { algorithm: 'RS256', expiresIn: '1h' })
let status = null
let payload = null
torobAuth({ headers: { 'x-torob-token': token }, ip: '127.0.0.1' }, { status(code) { status = code; return this }, json(value) { payload = value } }, () => { status = 200 })
assert.strictEqual(status, 200)
torobAuth({ headers: {} }, { status(code) { status = code; return this }, json(value) { payload = value } }, () => {})
assert.strictEqual(status, 401)
assert.deepStrictEqual(payload, { error: 'X-Torob-Token header is missing' })
console.log('Torob API V3 unit tests passed')
