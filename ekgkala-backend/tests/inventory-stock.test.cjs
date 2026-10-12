// ============================================
// تست‌های سرویس موجودی (inventoryService) — بدون نیاز به دیتابیس واقعی.
// مدل Product با یک store درون‌حافظه‌ای stub می‌شود که آپدیت شرطی
// اتمیک MongoDB (فیلتر stock >= qty + ‏$inc) را وفادارانه شبیه‌سازی
// می‌کند: بدنه‌ی updateOne بدون await اجرا می‌شود، پس هر فراخوانی
// نسبت به بقیه اتمیک است — مثل خود Mongo.
// ============================================
const assert = require('assert')

const Product = require('../models/Product')

// ---------- In-memory product store ----------
let store = new Map()
const clone = (v) => JSON.parse(JSON.stringify(v))

const makeQuery = (doc) => {
  const q = Promise.resolve(doc ? clone(doc) : null)
  q.lean = () => Promise.resolve(doc ? clone(doc) : null)
  return q
}

Product.findById = (id) => makeQuery(store.get(String(id)) || null)

Product.updateOne = async (filter, update) => {
  const doc = store.get(String(filter._id))
  if (!doc) return { matchedCount: 0, modifiedCount: 0 }

  // Pipeline update (salesCount)
  if (Array.isArray(update)) {
    const set = update[0].$set.salesCount
    const delta = set.$max[1].$add[1]
    doc.salesCount = Math.max(0, (doc.salesCount || 0) + delta)
    return { matchedCount: 1, modifiedCount: 1 }
  }

  const inc = update.$inc || {}

  // Variant positional decrement (conditional via $elemMatch)
  if (filter.variants && filter.variants.$elemMatch) {
    const { _id: variantId, stock } = filter.variants.$elemMatch
    const variant = (doc.variants || []).find((v) => String(v._id) === String(variantId))
    if (!variant) return { matchedCount: 0, modifiedCount: 0 }
    if (stock && typeof stock.$gte === 'number' && !(variant.stock >= stock.$gte)) {
      return { matchedCount: 0, modifiedCount: 0 }
    }
    variant.stock += inc['variants.$.stock']
    return { matchedCount: 1, modifiedCount: 1 }
  }

  // Variant positional increment (release)
  if (filter['variants._id']) {
    const variant = (doc.variants || []).find((v) => String(v._id) === String(filter['variants._id']))
    if (!variant) return { matchedCount: 0, modifiedCount: 0 }
    variant.stock += inc['variants.$.stock']
    return { matchedCount: 1, modifiedCount: 1 }
  }

  // Product-level stock decrement (conditional)
  if (filter.stock && typeof filter.stock.$gte === 'number') {
    if (!(doc.stock >= filter.stock.$gte)) return { matchedCount: 0, modifiedCount: 0 }
    doc.stock += inc.stock
    return { matchedCount: 1, modifiedCount: 1 }
  }

  // Product-level stock increment (release)
  if (typeof inc.stock === 'number') {
    doc.stock += inc.stock
    return { matchedCount: 1, modifiedCount: 1 }
  }

  return { matchedCount: 0, modifiedCount: 0 }
}

const inventory = require('../services/inventoryService')

const SIMPLE = '64b0000000000000000000a1'
const VARIABLE = '64b0000000000000000000a2'
const SINGLE_VARIANT = '64b0000000000000000000a3'
const OTHER = '64b0000000000000000000a4'

const seed = () => {
  store = new Map([
    [SIMPLE, { _id: SIMPLE, name: 'ساده', productType: 'simple', stock: 5, salesCount: 10, isActive: true }],
    [OTHER, { _id: OTHER, name: 'دوم', productType: 'simple', stock: 10, salesCount: 0, isActive: true }],
    [
      VARIABLE,
      {
        _id: VARIABLE,
        name: 'متغیر',
        productType: 'variable',
        stock: 0,
        salesCount: 0,
        isActive: true,
        variants: [
          { _id: 'v-red', price: 100, stock: 2, options: [{ name: 'رنگ', value: 'قرمز' }] },
          { _id: 'v-blue', price: 100, stock: 5, options: [{ name: 'رنگ', value: 'آبی' }] },
        ],
      },
    ],
    [
      SINGLE_VARIANT,
      {
        _id: SINGLE_VARIANT,
        name: 'تک‌ترکیب',
        productType: 'variable',
        stock: 0,
        salesCount: 0,
        isActive: true,
        variants: [{ _id: 'v-only', price: 50, stock: 4, options: [{ name: 'سایز', value: 'L' }] }],
      },
    ],
  ])
}

const stockOf = (id) => store.get(id).stock
const variantStock = (id, vid) => store.get(id).variants.find((v) => v._id === vid).stock

const expectError = async (fn, { statusCode, code }) => {
  try {
    await fn()
  } catch (err) {
    assert.strictEqual(err.statusCode, statusCode, `statusCode: ${err.message}`)
    assert.strictEqual(err.code, code, `code: ${err.message}`)
    return err
  }
  assert.fail(`expected ${code} error`)
}

;(async () => {
  // ۱) رزرو موفق محصول ساده
  seed()
  await inventory.reserveStock([{ product: SIMPLE, quantity: 3 }])
  assert.strictEqual(stockOf(SIMPLE), 2)
  console.log('simple reserve ok: 5 -> 2')

  // ۲) موجودی ناکافی محصول ساده: خطای 409 و موجودی دست‌نخورده
  seed()
  const err2 = await expectError(
    () => inventory.reserveStock([{ product: SIMPLE, quantity: 6 }]),
    { statusCode: 409, code: 'INSUFFICIENT_STOCK' },
  )
  assert.strictEqual(err2.details[0].available, 5)
  assert.strictEqual(err2.details[0].requested, 6)
  assert.strictEqual(stockOf(SIMPLE), 5)
  console.log('simple insufficient: 409, stock untouched')

  // ۳) تجمیع اقلام تکراری: ۳+۳ در برابر موجودی ۵ باید رد شود (نه دو بار ۳تایی مجزا)
  seed()
  const err3 = await expectError(
    () =>
      inventory.reserveStock([
        { product: SIMPLE, quantity: 3 },
        { product: SIMPLE, quantity: 3 },
      ]),
    { statusCode: 409, code: 'INSUFFICIENT_STOCK' },
  )
  assert.strictEqual(err3.details[0].requested, 6)
  assert.strictEqual(stockOf(SIMPLE), 5)
  console.log('duplicate lines aggregated: 3+3 > 5 rejected')

  // ۴) rollback: قلم اول رزرو می‌شود، دومی کم می‌آورد => اولی برمی‌گردد
  seed()
  await expectError(
    () =>
      inventory.reserveStock([
        { product: OTHER, quantity: 4 },
        { product: SIMPLE, quantity: 99 },
      ]),
    { statusCode: 409, code: 'INSUFFICIENT_STOCK' },
  )
  assert.strictEqual(stockOf(OTHER), 10)
  assert.strictEqual(stockOf(SIMPLE), 5)
  console.log('rollback: partial reservation fully reverted')

  // ۵) رزرو ترکیب دقیق محصول متغیر
  seed()
  await inventory.reserveStock([
    { product: VARIABLE, quantity: 2, variantOptions: [{ name: 'رنگ', value: 'قرمز' }] },
  ])
  assert.strictEqual(variantStock(VARIABLE, 'v-red'), 0)
  assert.strictEqual(variantStock(VARIABLE, 'v-blue'), 5)
  console.log('variant reserve ok: red 2 -> 0, blue untouched')

  // ۶) موجودی ناکافی یک ترکیب، ترکیب دیگر جبران نمی‌کند
  seed()
  await expectError(
    () => inventory.reserveStock([{ product: VARIABLE, quantity: 3, variantOptions: [{ name: 'رنگ', value: 'قرمز' }] }]),
    { statusCode: 409, code: 'INSUFFICIENT_STOCK' },
  )
  assert.strictEqual(variantStock(VARIABLE, 'v-red'), 2)
  console.log('variant insufficient: other variant does not compensate')

  // ۷) ترکیب ناموجود/نامعتبر: خطای 400
  seed()
  await expectError(
    () => inventory.reserveStock([{ product: VARIABLE, quantity: 1, variantOptions: [{ name: 'رنگ', value: 'سبز' }] }]),
    { statusCode: 400, code: 'INVALID_VARIANT' },
  )
  console.log('invalid variant combination: 400')

  // ۸) محصول چندترکیبی بدون انتخاب ترکیب: خطای 400
  seed()
  await expectError(() => inventory.reserveStock([{ product: VARIABLE, quantity: 1 }]), {
    statusCode: 400,
    code: 'VARIANT_REQUIRED',
  })
  console.log('multi-variant without selection: 400 VARIANT_REQUIRED')

  // ۹) محصول تک‌ترکیبی بدون گزینه: همان ترکیب رزرو می‌شود
  seed()
  await inventory.reserveStock([{ product: SINGLE_VARIANT, quantity: 3 }])
  assert.strictEqual(variantStock(SINGLE_VARIANT, 'v-only'), 1)
  console.log('single-variant product without options: reserved')

  // ۱۰) تعداد نامعتبر (۰ و اعشاری)
  seed()
  await expectError(() => inventory.reserveStock([{ product: SIMPLE, quantity: 0 }]), {
    statusCode: 400,
    code: 'INVALID_QUANTITY',
  })
  await expectError(() => inventory.reserveStock([{ product: SIMPLE, quantity: 2.5 }]), {
    statusCode: 400,
    code: 'INVALID_QUANTITY',
  })
  console.log('invalid quantities rejected')

  // ۱۱) آزادسازی: موجودی دقیق برمی‌گردد (ساده + متغیر)
  seed()
  const items = [
    { product: SIMPLE, quantity: 4 },
    { product: VARIABLE, quantity: 2, variantOptions: [{ name: 'رنگ', value: 'آبی' }] },
  ]
  await inventory.reserveStock(items)
  assert.strictEqual(stockOf(SIMPLE), 1)
  assert.strictEqual(variantStock(VARIABLE, 'v-blue'), 3)
  await inventory.releaseStock(items)
  assert.strictEqual(stockOf(SIMPLE), 5)
  assert.strictEqual(variantStock(VARIABLE, 'v-blue'), 5)
  console.log('release restores stock exactly')

  // ۱۲) مسابقه‌ی دو رزرو همزمان روی موجودی ۵، هرکدام ۴ عدد: دقیقاً یکی موفق
  seed()
  const results = await Promise.allSettled([
    inventory.reserveStock([{ product: SIMPLE, quantity: 4 }]),
    inventory.reserveStock([{ product: SIMPLE, quantity: 4 }]),
  ])
  const fulfilled = results.filter((r) => r.status === 'fulfilled')
  const rejected = results.filter((r) => r.status === 'rejected')
  assert.strictEqual(fulfilled.length, 1)
  assert.strictEqual(rejected.length, 1)
  assert.strictEqual(rejected[0].reason.code, 'INSUFFICIENT_STOCK')
  assert.strictEqual(stockOf(SIMPLE), 1)
  console.log('concurrent reserves: exactly one wins, stock never negative')

  // ۱۳) شمارنده‌ی فروش اتمیک با کف صفر
  seed()
  await inventory.adjustSalesCount([{ product: SIMPLE, quantity: 3 }], 1)
  assert.strictEqual(store.get(SIMPLE).salesCount, 13)
  await inventory.adjustSalesCount([{ product: SIMPLE, quantity: 99 }], -1)
  assert.strictEqual(store.get(SIMPLE).salesCount, 0)
  console.log('salesCount atomic with zero floor')

  // ۱۴) assertAvailable: چک خواندنی بدون رزرو
  seed()
  await inventory.assertAvailable([{ product: SIMPLE, quantity: 5 }])
  await expectError(() => inventory.assertAvailable([{ product: SIMPLE, quantity: 6 }]), {
    statusCode: 409,
    code: 'INSUFFICIENT_STOCK',
  })
  assert.strictEqual(stockOf(SIMPLE), 5)
  console.log('assertAvailable checks without deducting')

  // ۱۵) availableForCart: ساده / ترکیب دقیق / بدون گزینه (جمع ترکیب‌ها)
  seed()
  assert.strictEqual(inventory.availableForCart(store.get(SIMPLE), []), 5)
  assert.strictEqual(
    inventory.availableForCart(store.get(VARIABLE), [{ name: 'رنگ', value: 'قرمز' }]),
    2,
  )
  assert.strictEqual(inventory.availableForCart(store.get(VARIABLE), []), 7)
  console.log('availableForCart: simple / exact variant / total')

  console.log('\nAll inventory-stock tests passed ✅')
})().catch((err) => {
  console.error('❌ inventory-stock test failed:', err)
  process.exit(1)
})
