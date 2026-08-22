const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ShippingMethod = require('../models/ShippingMethod')

const publicMethod = new ShippingMethod({
  name: 'ارسال عمومی آزمایشی',
  cost: 99000,
})
assert.equal(publicMethod.validateSync(), undefined, 'روش عمومی باید بدون مقصد محدود معتبر باشد')
assert.equal(publicMethod.availabilityScope, 'all')

const provinceMethod = new ShippingMethod({
  name: 'ارسال خراسان رضوی آزمایشی',
  cost: 49000,
  availabilityScope: 'restricted',
  destinationRules: [{ province: 'خراسان رضوی', cities: [] }],
})
assert.equal(provinceMethod.validateSync(), undefined, 'روش محدود به تمام شهرهای یک استان باید معتبر باشد')
assert.deepEqual(provinceMethod.destinationRules[0].cities, [])

const cityMethod = new ShippingMethod({
  name: 'تحویل مشهد آزمایشی',
  cost: 0,
  availabilityScope: 'restricted',
  destinationRules: [{ province: 'خراسان رضوی', cities: ['مشهد'] }],
})
assert.equal(cityMethod.validateSync(), undefined, 'روش محدود به شهر مشخص باید معتبر باشد')
assert.deepEqual(cityMethod.destinationRules[0].cities, ['مشهد'])

const checkoutSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/app/checkout/page.tsx'),
  'utf8',
)
assert.ok(
  checkoutSource.includes('isShippingMethodAvailableForAddress'),
  'صفحه پرداخت باید روش‌های ارسال را براساس آدرس انتخاب‌شده فیلتر کند',
)
assert.ok(
  checkoutSource.includes('visibleShippingMethods.map'),
  'صفحه پرداخت باید فقط روش‌های ارسال قابل نمایش را فهرست کند',
)

console.log('Shipping destination rules tests passed.')
