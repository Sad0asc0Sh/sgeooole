const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const { stripSecretFields, hideInternalPricingFields, SECRET_KEYS } = require('../middleware/hideInternalPricingFields')

// productListingService فقط برای ساخت ObjectId به mongoose نیاز دارد. در محیطی که node_modules نصب نیست (مثلاً CI سبک)
// یک جایگزین حداقلی تزریق می‌شود؛ در محیط عادی mongoose واقعی استفاده می‌شود.
function requireWithOptionalMongooseStub(id) {
  const Module = require('node:module')
  const origLoad = Module._load
  Module._load = function patched(request, ...rest) {
    if (request === 'mongoose') {
      try {
        return origLoad.call(this, request, ...rest)
      } catch {
        return { Types: { ObjectId: class FakeObjectId { constructor(v) { this.v = v } } } }
      }
    }
    return origLoad.call(this, request, ...rest)
  }
  try {
    return require(id)
  } finally {
    Module._load = origLoad
  }
}
const { parseListingQuery, buildListingPipeline } = requireWithOptionalMongooseStub('../services/productListingService')
const { validatePricingSyncPayload } = require('../services/competitivePricingSyncService')

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8')

const COST = 2331600
const FLOOR = 2402000

function sampleProduct() {
  return {
    _id: { toJSON: () => '507f1f77bcf86cd799439011' },
    name: 'دوربین داهوا',
    price: 2705556,
    discount: 10,
    costPrice: COST,
    hardFloorPrice: FLOOR,
    supplierQuotes: [{ supplierName: 'پخش شرق مشهد', rawPrice: 2320000 }],
    pricingMeta: {
      exactFloorPrice: 2435000,
      exactFloorPriceAt: new Date('2026-10-14T08:00:00Z'),
      hardFloorPrice: FLOOR,
      badgeTheme: 'gold-red',
    },
    variants: [{ sku: 'a', price: 1, costPrice: 1, nested: { supplierQuotes: [1], keep: true } }],
  }
}

test('۱. stripSecretFields: هر سه کلید محرمانه را در هر عمقی حذف می‌کند و بقیه را نگه می‌دارد', () => {
  const out = stripSecretFields({ success: true, data: [sampleProduct()], single: sampleProduct() })
  const json = JSON.stringify(out)
  for (const k of SECRET_KEYS) assert.ok(!json.includes(`"${k}"`), `کلید ${k} نباید در خروجی باشد`)
  for (const secret of [COST, FLOOR, 2320000]) assert.ok(!json.includes(String(secret)), `عدد ${secret} نشت کرده`)
  assert.ok(!json.includes('پخش شرق'))
  // داده‌های غیرمحرمانه دست‌نخورده
  assert.equal(out.data[0].name, 'دوربین داهوا')
  assert.equal(out.data[0].pricingMeta.exactFloorPrice, 2435000)
  assert.equal(out.data[0].pricingMeta.badgeTheme, 'gold-red')
  assert.equal(out.data[0].variants[0].nested.keep, true)
  assert.equal(out.data[0]._id, '507f1f77bcf86cd799439011')
  assert.equal(typeof out.data[0].pricingMeta.exactFloorPriceAt, 'string') // Date → ISO مانند JSON.stringify
})

test('۲. stripSecretFields ورودی را تغییر نمی‌دهد (کش/اشتراک داده امن می‌ماند)', () => {
  const p = sampleProduct()
  const before = JSON.stringify(p)
  stripSecretFields(p)
  assert.equal(JSON.stringify(p), before)
  assert.equal(p.costPrice, COST)
})

test('۳. مقادیر ساده، null، آرایهٔ خالی و ساختار حلقوی بدون خطا عبور می‌کنند', () => {
  assert.equal(stripSecretFields(null), null)
  assert.equal(stripSecretFields(5), 5)
  assert.equal(stripSecretFields('x'), 'x')
  assert.deepEqual(stripSecretFields([]), [])
  const a = { x: 1 }
  a.self = a
  assert.doesNotThrow(() => stripSecretFields(a))
})

test('۴. میان‌افزار: res.json هر مسیر /api پاک‌سازی‌شده می‌فرستد و زنجیرهٔ status().json() حفظ می‌شود', () => {
  const sent = []
  const res = {
    statusCode: 200,
    status(c) {
      this.statusCode = c
      return this
    },
    json(p) {
      sent.push({ code: this.statusCode, body: p })
      return this
    },
  }
  let nextCalled = false
  hideInternalPricingFields({}, res, () => {
    nextCalled = true
  })
  assert.equal(nextCalled, true)
  const ret = res.status(201).json({ success: true, data: sampleProduct() })
  assert.equal(ret, res)
  assert.equal(sent[0].code, 201)
  assert.ok(!/costPrice|hardFloorPrice|supplierQuotes/.test(JSON.stringify(sent[0].body)))
})

test('۵. میان‌افزار fail-safe: اگر پاک‌سازی خطا بدهد، داده‌ی خام هرگز فرستاده نمی‌شود', () => {
  const sent = []
  const res = {
    statusCode: 200,
    status(c) {
      this.statusCode = c
      return this
    },
    json(p) {
      sent.push({ code: this.statusCode, body: p })
      return this
    },
  }
  hideInternalPricingFields({}, res, () => {})
  const poisoned = {
    costPrice: COST,
    toJSON() {
      throw new Error('boom')
    },
  }
  // toJSON خطادار داخل stripSecretFields گرفته می‌شود و ساختار اصلی پردازش می‌شود؛ حتی در بدترین حالت، کلید حذف می‌شود
  res.json(poisoned)
  assert.ok(!JSON.stringify(sent[0].body).includes(String(COST)))
})

test('۶. پایپ‌لاین لیست محصولات (aggregate) فیلدهای محرمانه را صریحاً $project می‌کند، قبل از projection کاربر', () => {
  const options = parseListingQuery({ fields: 'name,price' })
  const stages = buildListingPipeline(options, { campaigns: [] }, new Date('2026-10-14T08:00:00Z'))
  const facet = stages.find((s) => s.$facet)
  assert.ok(facet, 'مرحلهٔ $facet پیدا نشد')
  const projects = facet.$facet.data.filter((s) => s.$project)
  assert.ok(projects.length >= 2)
  const exclusion = projects[0].$project
  for (const k of ['costPrice', 'hardFloorPrice', 'supplierQuotes', 'pricingMeta.hardFloorPrice']) {
    assert.equal(exclusion[k], 0, `${k} باید حذف شود`)
  }
  assert.deepEqual(projects[1].$project, { name: 1, price: 1 })

  // بدون fields هم حذف می‌شود، و برای skipDiscount=true (حالت «ویرایش ادمین») هم
  for (const q of [{}, { skipDiscount: 'true' }]) {
    const st = buildListingPipeline(parseListingQuery(q), { campaigns: [] }, new Date())
    const dataProj = st.find((s) => s.$facet).$facet.data.filter((s) => s.$project)[0].$project
    assert.equal(dataProj.costPrice, 0)
    assert.equal(dataProj.supplierQuotes, 0)
  }
})

test('۷. رگرسیون پیکربندی: فیلتر پیش از routeها نصب شده و مدل فیلدهای محرمانه را select:false کرده است', () => {
  const server = read('server.js')
  const iHide = server.indexOf("app.use('/api', hideInternalPricingFields)")
  const iProducts = server.indexOf("app.use('/api/products', optional")
  const iAuth = server.indexOf("app.use('/api/auth', authRoutes)")
  assert.ok(iHide > 0, 'فیلتر در server.js نصب نشده')
  assert.ok(iHide < iAuth && iHide < iProducts, 'فیلتر باید قبل از تمام routeهای /api نصب شود')

  const model = read('models', 'Product.js')
  for (const field of ['costPrice', 'hardFloorPrice', 'supplierQuotes']) {
    const m = new RegExp(`${field}:\\s*\\{[^}]*select:\\s*false`, 's').exec(model)
    assert.ok(m, `${field} باید select:false باشد`)
  }
})

test('۸. مسیر pricing-sync مقدار ذخیره‌شده را صریحاً می‌خواند (گارد کف با select:false از کار نمی‌افتد)', () => {
  const routes = read('routes', 'products.js')
  const start = routes.indexOf("router.post('/pricing-sync'")
  const handler = routes.slice(start, start + 6000)
  assert.ok(handler.includes(".select('+costPrice +hardFloorPrice +supplierQuotes')"))
  // پاسخ همگام‌سازی هم دیگر قیمت خرید/کف را برنمی‌گرداند
  assert.ok(!/costPrice:\s*updated\.costPrice/.test(handler))
  assert.ok(!/hardFloorPrice:\s*updated\.hardFloorPrice/.test(handler))
})

test('۹. گارد کف قطعی: وقتی payload هزینه را نفرستد، مقدار ذخیره‌شدهٔ محصول مبنا می‌ماند', () => {
  const stored = { costPrice: 2331600, hardFloorPrice: 2402000, pricingMeta: {} }
  const low = validatePricingSyncPayload({ finalPrice: 2380000, basePrice: 2600000 }, stored)
  assert.equal(low.valid, false)
  assert.equal(low.code, 'BELOW_HARD_FLOOR')
  const belowCost = validatePricingSyncPayload({ finalPrice: 2331600, basePrice: 2600000 }, stored)
  assert.equal(belowCost.valid, false)
  assert.equal(belowCost.code, 'BELOW_COST_PRICE')
  const ok = validatePricingSyncPayload({ finalPrice: 2450000, basePrice: 2600000 }, stored)
  assert.equal(ok.valid, true)
  // اگر مقدار ذخیره‌شده خوانده نشود (select:false بدون select صریح)، گارد بی‌صدا خالی می‌شود — این همان دلیل select صریح در مسیر است
  const noStored = validatePricingSyncPayload({ finalPrice: 2380000, basePrice: 2600000 }, { pricingMeta: {} })
  assert.equal(noStored.valid, true)
})
