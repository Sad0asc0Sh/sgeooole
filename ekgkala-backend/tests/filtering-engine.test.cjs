// ============================================================
// تست‌های موتور فیلترینگ هوشمند (فازهای ۲ تا ۴) — آفلاین با mingo
// هیچ اتصال MongoDB، سرور یا نوشتن در دیتابیس لازم نیست.
// ============================================================
const assert = require('node:assert/strict')
const test = require('node:test')
const mongoose = require('mongoose')
require('mingo/init/system')
const { aggregate } = require('mingo')

const {
  normalizeBucketValue,
  isNegated,
  normalizeBooleanValue,
  bucketizeByThresholds,
  parseQuantity,
  toValueKey,
  normCompareKey,
  isNonFilterableKey,
  PREVIOUSLY_BLOCKED_KEYS,
} = require('../services/specNormalization')

const {
  prepareProductSpecsAndDescription,
  extractSpecsFromHtml,
  removeDuplicateSpecTables,
  hasRichHtml,
  isExplicitlyEnabledByAdmin,
} = require('../services/specAndDescriptionService')

const {
  mergeCategoryRules,
  filterableRules,
  rankAndFormatPropertyFacets,
} = require('../services/listingFacets')

const { parseListingQuery, buildListingPipeline, listProducts } = require('../services/productListingService')
const { resolveSort, buildSort } = require('../services/productSorting')

const now = new Date('2026-09-17T12:00:00Z')
const future = new Date('2026-09-18T12:00:00Z')
const id = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'))
const run = (products, query = {}, campaigns = []) =>
  aggregate(products, buildListingPipeline(parseListingQuery(query), { campaigns }, now))[0]
const ids = (result) => result.data.map((p) => String(p._id))

// ------------------------------------------------------------
// ۱) نرمال‌ساز عمومی و نگهبان نفی
// ------------------------------------------------------------
test('negation guard: «فاقد/بدون/ندارد» هرگز به مقدار مثبت تبدیل نمی‌شود', () => {
  assert.equal(isNegated('فاقد میکروفون داخلی'), true)
  assert.equal(isNegated('بدون دید در شب'), true)
  assert.equal(isNegated('میکروفون ندارد'), true)
  assert.equal(isNegated('دارد'), false)
  assert.equal(isNegated('without night vision'), true)

  assert.equal(normalizeBooleanValue('فاقد میکروفون داخلی'), 'ندارد')
  assert.equal(normalizeBooleanValue('بدون دید در شب رنگی'), 'ندارد')
  assert.equal(normalizeBooleanValue('دارد'), 'دارد')
  assert.equal(normalizeBooleanValue('built-in'), 'دارد')

  // نوع دید در شب: نفی مقدم است، پس «رنگی» تولید نمی‌شود
  assert.equal(normalizeBucketValue('نوع دید در شب', 'فاقد دید در شب رنگی'), 'ندارد')
  assert.equal(normalizeBucketValue('نوع دید در شب', 'دید در شب رنگی'), 'رنگی')
  assert.equal(normalizeBucketValue('میکروفون داخلی', 'فاقد میکروفون داخلی'), 'ندارد')
})

test('non-standard battery/body values are preserved, never dropped as null', () => {
  const cases = [
    ['نوع باتری', 'لیتیوم-یون', 'لیتیوم-یون'],
    ['نوع باتری', 'Li-ion', 'لیتیوم-یون'],
    ['نوع باتری', 'سیلد اسید ۱۲ ولت ۷ آمپر', 'سیلد اسید'],
    ['نوع باتری', 'باتری ژله‌ای سفارشی', 'باتری ژله‌ای سفارشی'],
    ['جنس بدنه', 'پلی‌کربنات', 'پلی‌کربنات'],
    ['جنس بدنه', 'آلومینیوم', 'آلومینیوم'],
    ['جنس بدنه', 'ترکیب سرامیک و رزین', 'ترکیب سرامیک و رزین'],
    ['برد عملکرد', 'تشخیص حرکت PIR', 'تشخیص حرکت'],
    ['برد عملکرد', 'برد اختصاصی کارخانه', 'برد اختصاصی کارخانه'],
  ]
  for (const [label, raw, expected] of cases) {
    assert.equal(normalizeBucketValue(label, raw), expected, `${label}=${raw}`)
  }
  // تنها ورودی خالی null است
  assert.equal(normalizeBucketValue('نوع باتری', ''), null)
  assert.equal(normalizeBucketValue('نوع باتری', '   '), null)
})

test('unit normalizer unifies GB/TB/MHz/W/A/V/mm/m/kg/inch across categories', () => {
  const cases = [
    ['ظرفیت حافظه', '۱۲۸ گیگابایت', '128 گیگابایت'],
    ['ظرفیت حافظه', '128GB', '128 گیگابایت'],
    ['ظرفیت حافظه', '2 TB', '2 ترابایت'],
    ['فرکانس', '2400 MHz', '2400 مگاهرتز'],
    ['فرکانس', '3.2GHz', '3.2 گیگاهرتز'],
    ['توان مصرفی', '300 W', '300 وات'],
    ['توان مصرفی', '۳۰۰ وات', '300 وات'],
    ['جریان', '7 A', '7 آمپر'],
    ['ولتاژ', '12 V', '12 ولت'],
    ['قطر', '50 mm', '50 میلی‌متر'],
    ['طول کابل', '2.5 m', '2.5 متر'],
    ['وزن', '1.5 kg', '1.5 کیلوگرم'],
    ['سایز صفحه', '6.1 inch', '6.1 اینچ'],
    ['رزولوشن', '2MP', '2 مگاپیکسل'],
    ['رزولوشن', '۲ مگاپیکسل', '2 مگاپیکسل'],
  ]
  for (const [label, raw, expected] of cases) {
    assert.equal(normalizeBucketValue(label, raw), expected, `${label}=${raw}`)
  }
  // نمایش و مقایسه: نقطه‌ی اعشار نباید گم شود
  assert.notEqual(toValueKey(normalizeBucketValue('سایز صفحه', '6.1 اینچ')), toValueKey(normalizeBucketValue('سایز صفحه', '61 اینچ')))
})

test('night-vision distance buckets are contiguous and inclusive (the 40/50 bug)', () => {
  const buckets = [
    { max: 20, label: 'تا 20 متر' },
    { max: 30, label: 'تا 30 متر' },
    { max: 40, label: 'تا 40 متر' },
    { max: 50, label: 'تا 50 متر' },
    { max: 80, label: 'تا 80 متر' },
  ]
  assert.equal(bucketizeByThresholds(39, buckets), 'تا 40 متر')
  assert.equal(bucketizeByThresholds(40, buckets), 'تا 40 متر')
  assert.equal(bucketizeByThresholds(41, buckets), 'تا 50 متر')
  assert.equal(bucketizeByThresholds(50, buckets), 'تا 50 متر')
  assert.equal(bucketizeByThresholds(79, buckets), 'تا 80 متر')
  assert.equal(bucketizeByThresholds(200, buckets), 'بیش از 80')
})

test('previously blocked cross-category keys are no longer non-filterable', () => {
  for (const key of PREVIOUSLY_BLOCKED_KEYS) {
    assert.equal(isNonFilterableKey(key), false, key)
  }
  // کلیدهای واقعاً غیرقابل‌فیلتر همچنان مسدودند
  assert.equal(isNonFilterableKey('قیمت'), true)
  assert.equal(isNonFilterableKey('بارکد'), true)
})

test('parseQuantity reads number + unit without inventing values', () => {
  assert.deepEqual(parseQuantity('128GB'), { value: 128, unit: 'گیگابایت', rawUnit: 'GB' })
  assert.equal(parseQuantity('اصلا عدد ندارد'), null)
})

// ------------------------------------------------------------
// ۲) استخراج غیرمخرب مشخصات و توضیحات
// ------------------------------------------------------------
const RICH_DESCRIPTION = [
  '<p>دوربین مداربسته <strong>۴ مگاپیکسل</strong> با دید در شب رنگی.</p>',
  '<img src="/uploads/camera-front.jpg" alt="نمای جلو" />',
  '<p>اطلاعات بیشتر در <a href="https://example.com/guide">راهنمای نصب</a>.</p>',
  '<table><tr><th>مشخصات فنی</th><td></td></tr><tr><th>رزولوشن</th><td>4MP</td></tr><tr><th>نوع باتری</th><td>لیتیوم-یون</td></tr></table>',
].join('')

test('rich admin HTML description keeps everything except the duplicate spec table', () => {
  assert.equal(hasRichHtml(RICH_DESCRIPTION), true)

  const prepared = prepareProductSpecsAndDescription(
    { name: 'دوربین', description: RICH_DESCRIPTION, specifications: {} },
    [],
    {},
  )

  // ۱) بلوک جدول مشخصات فنی به‌صورت پیش‌فرض حذف می‌شود (تکرار با تب مشخصات)
  assert.doesNotMatch(prepared.description, /<table/i)
  assert.doesNotMatch(prepared.description, /4MP/)

  // ۲) بقیه‌ی محتوای ادمین ۱۰۰٪ حفظ می‌شود
  assert.match(prepared.description, /<img src="\/uploads\/camera-front\.jpg"/)
  assert.match(prepared.description, /<a href="https:\/\/example\.com\/guide">/)
  assert.match(prepared.description, /<strong>۴ مگاپیکسل<\/strong>/)
  assert.match(prepared.description, /<p>دوربین مداربسته/)

  // ۳) مشخصات از جدول خوانده شده‌اند (خواندنی، نه مخرب)
  const specLabels = Object.keys(prepared.specifications)
  assert.ok(specLabels.includes('رزولوشن'))
  assert.ok(specLabels.includes('نوع باتری'))

  // ۴) در حالت خروج صریح، توضیحات بایت‌به‌بایت دست‌نخورده می‌ماند
  const kept = prepareProductSpecsAndDescription(
    { name: 'دوربین', description: RICH_DESCRIPTION, specifications: {} },
    [],
    { removeDuplicateSpecTable: false },
  )
  assert.equal(kept.description, RICH_DESCRIPTION)
})

test('plain description is left byte-identical too (no forced template)', () => {
  const prepared = prepareProductSpecsAndDescription({ description: '<p>متن ساده ادمین</p>' }, [])
  assert.equal(prepared.description, '<p>متن ساده ادمین</p>')
})

test('duplicate spec table removal drops the marked table but keeps other tables', () => {
  const html = [
    '<p>مقدمه</p>',
    '<table><tr><td>مشخصات فنی</td><td></td></tr><tr><td>رزولوشن</td><td>4MP</td></tr></table>',
    '<table><tr><td>جدول قیمت</td><td>۱۰۰۰</td></tr></table>',
    '<p>پایان</p><img src="/x.jpg" />',
  ].join('')
  const cleaned = removeDuplicateSpecTables(html)
  assert.doesNotMatch(cleaned, /4MP/)
  // جدول غیرمرتبط با مشخصات فنی باید بماند
  assert.match(cleaned, /جدول قیمت/)
  assert.match(cleaned, /<p>مقدمه<\/p>/)
  assert.match(cleaned, /<p>پایان<\/p>/)
  assert.match(cleaned, /<img src="\/x\.jpg" \/>/)

  // پیش‌فرض جدید: حذف انجام می‌شود
  const removedByDefault = prepareProductSpecsAndDescription({ description: html }, [])
  assert.doesNotMatch(removedByDefault.description, /4MP/)
  assert.match(removedByDefault.description, /جدول قیمت/)

  // خروج صریح: دست‌نخورده
  const untouched = prepareProductSpecsAndDescription({ description: html }, [], { removeDuplicateSpecTable: false })
  assert.match(untouched.description, /4MP/)
})

test('extractSpecsFromHtml reads tables, dl and label:value lists', () => {
  const pairs = extractSpecsFromHtml(
    '<table><tr><th>وزن</th><td>1.5 kg</td></tr></table>' +
    '<dl><dt>گارانتی</dt><dd>۱۸ ماه</dd></dl>' +
    '<ul><li>رنگ: مشکی</li></ul>',
  )
  const byLabel = Object.fromEntries(pairs.map((pair) => [pair.label, pair.value]))
  assert.equal(byLabel['وزن'], '1.5 kg')
  assert.equal(byLabel['گارانتی'], '18 ماه') // ارقام در نرمال‌سازی یکسان می‌شوند
  assert.equal(byLabel['رنگ'], 'مشکی')
})

// ------------------------------------------------------------
// ۳) تزریق ویژگی‌های متغیر به properties
// ------------------------------------------------------------
test('variant options and product attributes are injected into properties', () => {
  const prepared = prepareProductSpecsAndDescription({
    name: 'گوشی',
    specifications: { 'حافظه داخلی': '128GB' },
    attributes: [{ name: 'سایز صفحه', values: ['6.1 inch'] }],
    variants: [
      { options: [{ name: 'رنگ', value: 'آبی' }, { name: 'حافظه داخلی', value: '128GB' }] },
      { options: [{ name: 'رنگ', value: 'مشکی' }, { name: 'حافظه داخلی', value: '256GB' }] },
    ],
  }, [])

  const byLabel = new Map()
  for (const item of prepared.properties) {
    if (!byLabel.has(item.label)) byLabel.set(item.label, new Set())
    byLabel.get(item.label).add(item.bucket)
  }
  assert.deepEqual([...byLabel.get('رنگ')].sort(), ['آبی', 'مشکی'].sort())
  assert.deepEqual([...byLabel.get('حافظه داخلی')].sort(), ['128 گیگابایت', '256 گیگابایت'].sort())
  assert.ok([...byLabel.get('سایز صفحه')].includes('6.1 اینچ'))
})

test('admin-defined properties are always filterable, even with isPinned=false', () => {
  const rules = [{ name: 'ظرفیت حافظه', isFilterable: true, isPinned: false }]
  assert.equal(isExplicitlyEnabledByAdmin('ظرفیت حافظه', rules), true)
  const prepared = prepareProductSpecsAndDescription(
    { specifications: { 'ظرفیت حافظه': '1TB' } },
    rules,
  )
  assert.equal(prepared.properties[0].bucket, '1 ترابایت')
})

// ------------------------------------------------------------
// ۴) ارث‌بری دسته‌بندی و فست‌ها
// ------------------------------------------------------------
test('category rules inherit from parents and merge descendants without duplicates', () => {
  const grandParent = { properties: [{ name: 'برند', order: 0, isFilterable: true, options: ['A'] }] }
  const parent = { properties: [{ name: 'نوع کاربری', order: 1, isFilterable: true, unit: '' }] }
  const self = { properties: [{ name: 'رزولوشن', order: 2, isFilterable: true, unit: 'مگاپیکسل', options: ['2MP'] }] }
  const child = { properties: [{ name: 'رزولوشن', order: 2, isFilterable: true, options: ['4MP'] }] }

  const merged = mergeCategoryRules([self, parent, grandParent, child])
  const names = merged.map((rule) => rule.name)
  assert.deepEqual(names, ['برند', 'نوع کاربری', 'رزولوشن'])
  const resolution = merged.find((rule) => rule.name === 'رزولوشن')
  // گزینه‌ها اجتماع می‌شوند و چیزی گم نمی‌شود
  assert.deepEqual([...resolution.options].sort(), ['2MP', '4MP'])
  assert.equal(resolution.unit, 'مگاپیکسل')
})

test('rankAndFormatPropertyFacets keeps category order and never drops selected values', () => {
  const rules = [
    { name: 'رزولوشن', order: 0, isFilterable: true, unit: 'مگاپیکسل', options: ['2MP', '4MP'] },
    { name: 'نوع باتری', order: 1, isFilterable: true, options: [] },
  ]
  const bucketsByLabel = new Map([
    ['نوع باتری', [{ value: 'لیتیوم-یون', bucket: 'لیتیوم-یون', count: 9 }]],
    ['رزولوشن', [
      { value: '2 مگاپیکسل', bucket: '2 مگاپیکسل', count: 5 },
      { value: '4MP', bucket: '4 مگاپیکسل', count: 3 },
    ]],
    ['ویژگی کشف‌شده', [{ value: 'X', bucket: 'X', count: 1 }]],
    // ویژگی خودکارِ معتبر: ≥۲ مقدار با count>0 ⇒ باید نمایش داده شود
    ['نوع اتصال', [
      { value: 'بی‌سیم', bucket: 'بی‌سیم', count: 4 },
      { value: 'باسیم', bucket: 'باسیم', count: 2 },
    ]],
  ])
  const selected = new Map([['نوع باتری', ['لیتیوم-یون']], ['رزولوشن', ['8 مگاپیکسل']]])

  const facets = rankAndFormatPropertyFacets({ bucketsByLabel, rules, selected })

  // ترتیب: ویژگی‌های تعریف‌شده‌ی دسته اول و به ترتیب order
  assert.equal(facets[0].name, 'رزولوشن')
  assert.equal(facets[1].name, 'نوع باتری')

  // حاکمیت ضدشلوغی: ویژگی خودکارِ تک‌مقداره حذف می‌شود…
  assert.equal(facets.some((facet) => facet.name === 'ویژگی کشف‌شده'), false)
  // …ولی ویژگی خودکارِ چندمقداره می‌ماند و بعد از ویژگی‌های دسته قرار می‌گیرد
  assert.equal(facets.at(-1).name, 'نوع اتصال')
  assert.equal(facets.at(-1).isConfigured, false)

  // گزینه‌ی انتخاب‌شده حتی بدون محصول باقی می‌ماند
  const resolution = facets.find((facet) => facet.name === 'رزولوشن')
  const eightMp = resolution.values.find((value) => value.value === '8 مگاپیکسل')
  assert.ok(eightMp, 'selected value must survive with zero count')
  assert.equal(eightMp.count, 0)
  assert.equal(eightMp.isSelected, true)

  // گزینه‌های تعریف‌شده‌ی ادمین هم با count=0 می‌مانند (کلید یکسان‌شان ادغام می‌شود)
  const bucketKeys = resolution.values.map((value) =>
    toValueKey(normalizeBucketValue('رزولوشن', value.value) || value.value))
  assert.ok(bucketKeys.includes(toValueKey('2 مگاپیکسل')))
  assert.ok(bucketKeys.includes(toValueKey('4 مگاپیکسل')))

  // مقادیر هم‌باکت ادغام می‌شوند (2MP + 2 مگاپیکسل = یک گزینه)
  const twoMp = resolution.values.filter((value) => toValueKey(value.value) === toValueKey('2 مگاپیکسل'))
  assert.equal(twoMp.length, 1)
  assert.equal(twoMp[0].count, 5)

  // ترتیب ویژگی‌ها با isPinned=false هم پایدار است
  assert.deepEqual(filterableRules(rules).map((rule) => rule.name), ['رزولوشن', 'نوع باتری'])
})

// ------------------------------------------------------------
// ۵) فیلترینگ آگاه از متغیر (کوپل با موجودی و قیمت)
// ------------------------------------------------------------
const variableProduct = (n, variants, values = {}) => ({
  _id: id(n),
  name: `Variable ${n}`,
  isActive: true,
  productType: 'variable',
  price: 0,
  stock: 0,
  rating: 4,
  discount: 0,
  createdAt: now,
  properties: [],
  attributes: [],
  variants,
  ...values,
})

test('variant option filtering requires the SAME variant to match option + stock', () => {
  const products = [
    // آبی موجود، قرمز ناموجود
    variableProduct(1, [
      { sku: 'A-BLUE', price: 1000, stock: 5, options: [{ name: 'رنگ', value: 'آبی' }] },
      { sku: 'A-RED', price: 900, stock: 0, options: [{ name: 'رنگ', value: 'قرمز' }] },
    ]),
    // فقط قرمز موجود
    variableProduct(2, [
      { sku: 'B-RED', price: 1200, stock: 3, options: [{ name: 'رنگ', value: 'قرمز' }] },
    ]),
  ]

  const red = run(products, { 'properties[رنگ]': 'قرمز' })
  // بدون inStock، موجودی متغیر ملاک نیست: هر دو محصول متغیر قرمز دارند
  assert.deepEqual(ids(red), [String(id(1)), String(id(2))])

  const redInStock = run(products, { 'properties[رنگ]': 'قرمز', inStock: 'true' })
  assert.deepEqual(ids(redInStock), [String(id(2))])

  const blueInStock = run(products, { 'properties[رنگ]': 'آبی', inStock: 'true' })
  assert.deepEqual(ids(blueInStock), [String(id(1))])
})

test('displayed price is the cheapest variant that matches the active filter', () => {
  const products = [
    // آبی گران‌تر از قرمز است؛ با فیلتر آبی باید قیمت آبی نمایش داده شود
    variableProduct(1, [
      { sku: 'BLUE', price: 2000, stock: 4, options: [{ name: 'رنگ', value: 'آبی' }] },
      { sku: 'RED', price: 1000, stock: 4, options: [{ name: 'رنگ', value: 'قرمز' }] },
    ]),
  ]
  const blue = run(products, { 'properties[رنگ]': 'آبی', sort: 'priceAsc' })
  assert.equal(blue.data[0].price, 2000)

  const red = run(products, { 'properties[رنگ]': 'قرمز', sort: 'priceAsc' })
  assert.equal(red.data[0].price, 1000)

  // بدون فیلتر، کمترین قیمت کل متغیرها
  const any = run(products, { sort: 'priceAsc' })
  assert.equal(any.data[0].price, 1000)
})

test('variant filter couples with minPrice/maxPrice of the matching variant', () => {
  const products = [
    variableProduct(1, [
      { sku: 'BLUE', price: 5000, stock: 4, options: [{ name: 'رنگ', value: 'آبی' }] },
      { sku: 'RED', price: 1000, stock: 4, options: [{ name: 'رنگ', value: 'قرمز' }] },
    ]),
  ]
  // بازه‌ی قیمت فقط روی متغیرِ منطبق اعمال می‌شود: آبی ۵۰۰۰ خارج از بازه است
  assert.equal(run(products, { 'properties[رنگ]': 'آبی', maxPrice: '2000' }).total[0]?.count || 0, 0)
  assert.equal(run(products, { 'properties[رنگ]': 'قرمز', maxPrice: '2000' }).total[0]?.count || 0, 1)
})

test('static property filtering still works alongside variant options', () => {
  const products = [
    {
      _id: id(1),
      name: 'Static',
      isActive: true,
      price: 1000,
      stock: 3,
      rating: 4,
      discount: 0,
      createdAt: now,
      variants: [],
      properties: [{ label: 'نوع باتری', value: 'لیتیوم-یون', normLabel: 'نوعباتری', normValue: 'لیتیوم-یون' }],
    },
    {
      _id: id(2),
      name: 'Static 2',
      isActive: true,
      price: 1000,
      stock: 3,
      rating: 4,
      discount: 0,
      createdAt: now,
      variants: [],
      properties: [{ label: 'نوع باتری', value: 'سیلد اسید', normLabel: 'نوعباتری', normValue: 'سیلد اسید' }],
    },
  ]
  assert.deepEqual(ids(run(products, { 'properties[نوع باتری]': 'لیتیوم-یون' })), [String(id(1))])
  // مقدار خام و نرمال‌شده هر دو کار می‌کنند
  assert.deepEqual(ids(run(products, { 'properties[نوع باتری]': 'سیلد اسید' })), [String(id(2))])
})

// ------------------------------------------------------------
// ۶) فست‌ها در پاسخ pipeline
// ------------------------------------------------------------
test('pipeline emits brand, category and per-property facet branches', () => {
  const brandA = id(101)
  const brandB = id(102)
  const catA = id(201)
  const catB = id(202)
  const products = [
    {
      _id: id(1), name: 'P1', isActive: true, price: 1000, stock: 2, rating: 4, discount: 0, createdAt: now,
      brand: brandA, category: catA, variants: [],
      properties: [{ label: 'رزولوشن', value: '4MP', normLabel: 'رزولوشن', normValue: '4 مگاپیکسل' }],
    },
    {
      _id: id(2), name: 'P2', isActive: true, price: 2000, stock: 2, rating: 4, discount: 0, createdAt: now,
      brand: brandB, category: catB, variants: [],
      properties: [{ label: 'رزولوشن', value: '2MP', normLabel: 'رزولوشن', normValue: '2 مگاپیکسل' }],
    },
  ]
  const result = run(products, { 'properties[رزولوشن]': '4 مگاپیکسل' })

  // داده فیلتر شده
  assert.deepEqual(ids(result), [String(id(1))])
  assert.equal(result.total[0].count, 1)

  // فست ویژگی Disjunctive است: مقدار *انتخاب‌شده* فیلترِ خودش را حذف می‌کند،
  // پس هر دو مقدار (۴ و ۲ مگاپیکسل) با شمارش کامل دیده می‌شوند.
  const propRows = result.prop_0 || []
  const propCounts = new Map(propRows.map((row) => [row._id, row.count]))
  assert.equal(propCounts.get('4 مگاپیکسل'), 1)
  assert.equal(propCounts.get('2 مگاپیکسل'), 1, 'sibling property values must not collapse to zero')

  // فست زیردسته‌ها هم موجود است
  assert.ok(Array.isArray(result.categories))
  assert.ok(result.categories.length >= 1)
})

test('brand facet stays disjunctive: selecting one brand keeps the others visible', () => {
  const brandA = id(101)
  const brandB = id(102)
  const products = [
    { _id: id(1), name: 'A1', isActive: true, price: 1000, stock: 2, rating: 4, discount: 0, createdAt: now, brand: brandA, category: id(201), variants: [], properties: [] },
    { _id: id(2), name: 'B1', isActive: true, price: 1500, stock: 2, rating: 4, discount: 0, createdAt: now, brand: brandB, category: id(201), variants: [], properties: [] },
  ]
  const pipeline = buildListingPipeline(
    parseListingQuery({}),
    { campaigns: [], brandMatch: { brand: { $in: [brandA] } } },
    now,
  )
  const result = aggregate(products, pipeline)[0]

  // داده فقط برند انتخاب‌شده است
  assert.deepEqual(result.data.map((item) => String(item._id)), [String(id(1))])

  // اما فست برند هر دو را نشان می‌دهد (فیلتر برند روی شاخه‌ی برند اعمال نمی‌شود)
  const brandCounts = new Map((result.brands || []).map((row) => [String(row._id), row.count]))
  assert.equal(brandCounts.get(String(brandA)), 1)
  assert.equal(brandCounts.get(String(brandB)), 1, 'other brands must stay visible for disjunctive facets')
})

// ------------------------------------------------------------
// ۸) Hardening: نیم‌فاصله در نمایش + کوئری ایندکس‌پذیر
// ------------------------------------------------------------
test('facet displayValue keeps ZWNJ while the group key stays normalized', () => {
  const products = [
    {
      _id: id(1), name: 'A', isActive: true, price: 100, stock: 1, rating: 4, discount: 0, createdAt: now,
      variants: [],
      properties: [{ label: 'نوع اتصال', value: 'بی‌سیم', normLabel: 'نوعاتصال', normValue: 'بیسیم' }],
    },
    {
      _id: id(2), name: 'B', isActive: true, price: 100, stock: 1, rating: 4, discount: 0, createdAt: now,
      variants: [],
      properties: [{ label: 'نوع اتصال', value: 'بيسيم', normLabel: 'نوعاتصال', normValue: 'بیسیم' }],
    },
  ]
  const result = run(products, { 'properties[نوع اتصال]': 'بی‌سیم' })
  const rows = result.prop_0 || []
  assert.equal(rows.length, 1, 'هم‌باکت‌ها در یک ردیف ادغام می‌شوند')
  assert.equal(rows[0].count, 2)
  assert.ok(rows[0].displayValue.includes('\u200c'), 'نیم‌فاصله در رشته‌ی نمایش حفظ می‌شود')
  assert.equal(rows[0]._id.includes('\u200c'), false, 'کلید گروه‌بندی بدون نیم‌فاصله است')
})

test('property matching uses $elemMatch and facets=false makes the first $match index-able', () => {
  const facetsOn = buildListingPipeline(parseListingQuery({ 'properties[رنگ]': 'آبی' }), { campaigns: [] }, now)
  // با فست فعال، شرط ویژگی در مرحله‌ی اول نیست (برای حفظ رفتار Disjunctive)
  assert.equal(JSON.stringify(facetsOn[0].$match).includes('$elemMatch'), false)
  // اما در شاخه‌ی data با $elemMatch (نه $expr/$map) اعمال می‌شود
  const dataStage = facetsOn[facetsOn.length - 1].$facet.data.find((stage) => stage.$match)
  assert.match(JSON.stringify(dataStage.$match), /\$elemMatch/)
  assert.doesNotMatch(JSON.stringify(dataStage.$match), /\$anyElementTrue|\$map/)

  const facetsOff = buildListingPipeline(
    parseListingQuery({ 'properties[رنگ]': 'آبی', facets: 'false' }),
    { campaigns: [] },
    now,
  )
  // با facets=false همه‌ی شرط‌ها در اولین $match می‌نشینند ⇒ ایندکس Multikey
  const first = JSON.stringify(facetsOff[0].$match)
  assert.match(first, /\$elemMatch/)
  assert.doesNotMatch(first, /\$anyElementTrue|\$map/)
  // و هیچ شاخه‌ی فست اضافه‌ای ساخته نمی‌شود
  assert.deepEqual(Object.keys(facetsOff[facetsOff.length - 1].$facet).sort(), ['data', 'priceRange', 'total'])
})

test('facets=false still returns the exact filtered data', () => {
  const products = [
    { _id: id(1), name: 'A', isActive: true, price: 100, stock: 1, rating: 4, discount: 0, createdAt: now, variants: [], properties: [{ label: 'رنگ', value: 'آبی', normLabel: 'رنگ', normValue: 'آبی' }] },
    { _id: id(2), name: 'B', isActive: true, price: 100, stock: 1, rating: 4, discount: 0, createdAt: now, variants: [], properties: [{ label: 'رنگ', value: 'قرمز', normLabel: 'رنگ', normValue: 'قرمز' }] },
  ]
  const result = run(products, { 'properties[رنگ]': 'قرمز', facets: 'false' })
  assert.deepEqual(ids(result), [String(id(2))])
  assert.equal(result.total[0].count, 1)
})

// ------------------------------------------------------------
// ۹) سازگاری فید ترب با ساختار جدید properties
// ------------------------------------------------------------
test('torobMapper merges properties into the feed spec without overwriting specifications', () => {
  const { mapSpecifications } = require('../utils/torobMapper')
  const spec = mapSpecifications({
    specifications: { 'حافظه داخلی': '128 گیگابایت' },
    properties: [
      { label: 'حافظه داخلی', value: '128GB', normLabel: 'حافظهداخلی', normValue: '128 گیگابایت' },
      { label: 'نوع اتصال', value: 'بی‌سیم' },
      { label: 'رنگ', value: 'مشکی' },
      { label: '', value: 'بدون برچسب' },
      { label: 'خالی', value: '   ' },
    ],
  })
  // مقدار رسمی specifications مقدم است و بازنویسی نمی‌شود
  assert.equal(spec['حافظه داخلی'], '128 گیگابایت')
  // ویژگی‌های سطح متغیر هم به فید می‌رسند
  assert.equal(spec['نوع اتصال'], 'بی‌سیم')
  assert.equal(spec['رنگ'], 'مشکی')
  // نیم‌فاصله در مقدار فید حفظ می‌شود
  assert.ok(spec['نوع اتصال'].includes('\u200c'))
  // رکوردهای خالی حذف می‌شوند
  assert.equal(Object.keys(spec).length, 3)
})

// ------------------------------------------------------------
// ۱۰) قالب واقعی «پنل دزدگیر سایلکس SG8-S»
// ------------------------------------------------------------
test('Silex SG8-S template: full specs, guarantee, block removal, filterable buckets', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'silex-sg8s-description.html'), 'utf8')
  const prepared = prepareProductSpecsAndDescription({ name: 'SG8-S', description: html })

  // (الف) هر ۹ ردیف جدول با متن کامل در specifications
  const specs = prepared.specifications
  assert.equal(Object.keys(specs).length, 9)
  assert.equal(specs['نوع دستگاه'], 'پنل دزدگیر اماکن سیم‌کارتی')
  assert.equal(specs['تعداد زون'], '5 زون قابل برنامه‌ریزی')
  assert.equal(specs['حالت‌های قابل تعریف برای زون'], '8 حالت عملکرد')
  assert.equal(specs['تعداد رله خروجی'], '4 رله کنترلی')
  assert.equal(specs['فرکانس ریموت'], '433.92 MHz')
  assert.equal(specs['نوع کد ریموت'], 'Hopping Code')
  assert.equal(specs['مدت ضبط پیام'], '24 ثانیه')
  assert.equal(specs['تعداد مدیران سیستم'], '4 مدیر (Admin)')
  assert.equal(specs['گارانتی'], '36 ماه گارانتی سایلکس')

  // (ب) گارانتی از جدول استخراج می‌شود
  assert.equal(prepared.guarantee, '36 ماه گارانتی سایلکس')

  // (ج) کل بلوک انتهایی حذف شده و بقیه‌ی قالب دست‌نخورده است
  const desc = prepared.description
  assert.doesNotMatch(desc, /<table/i)
  assert.doesNotMatch(desc, /Technical Specifications/)
  assert.equal(desc.includes('مشخصات فنی'), false)
  assert.doesNotMatch(desc, /<h1\b/i)
  assert.match(desc, /<h2[^>]*>پنل دزدگیر اماکن سیم‌کارتی سایلکس مدل SG8-S<\/h2>/)
  assert.match(desc, /معرفی محصول/)
  assert.match(desc, /کاربردها/)
  for (const num of ['01', '02', '03', '04', '05', '06']) assert.ok(desc.includes(num), `card ${num}`)
  assert.match(desc, /<img[^>]+silex-sg8s-panel\.jpg/)
  assert.match(desc, /<a href="https:\/\/example\.com\/silex-sg8s-manual"/)
  // استایل‌های اینلاین قالب حفظ شده‌اند
  assert.match(desc, /background:\s*#f9fafb/)
  assert.match(desc, /font-family:\s*Tahoma/)
  assert.match(desc, /<span style="color:#b45309; font-weight:bold;">/)

  // (د) properties فقط شامل فست‌های کوتاه و استاندارد
  const byLabel = new Map(prepared.properties.map((item) => [item.label, item.value]))
  assert.equal(byLabel.get('نوع کاربری'), 'پنل دزدگیر اماکن سیم‌کارتی')
  assert.equal(byLabel.get('تعداد زون'), '5 زون')
  assert.equal(byLabel.get('تعداد رله'), '4 رله')
  assert.equal(byLabel.get('فرکانس کاری'), '433 مگاهرتز')
  assert.equal(byLabel.get('نوع کددهی'), 'هاپینگ کد (Hopping)')
  // ردیف‌های صرفاً جدولی وارد properties نمی‌شوند
  for (const label of ['مدت ضبط پیام', 'تعداد مدیران سیستم', 'حالت‌های قابل تعریف برای زون', 'گارانتی']) {
    assert.equal(byLabel.has(label), false, `${label} باید فقط در specifications بماند`)
  }
  // نیم‌فاصله در مقدار باکت حفظ می‌شود
  assert.ok(prepared.properties.every((item) => item.value === item.bucket))
})

// ------------------------------------------------------------
// ۱۱) propBase: ورود اول به دسته بدون هیچ فیلتری
// ------------------------------------------------------------
test('propBase populates facets with real counts on first category entry (no filters)', async () => {
  const categoryId = id(701)
  const otherCategory = id(702)
  const rules = [
    { name: 'تعداد زون', order: 0, isFilterable: true, options: [] },
    { name: 'فرکانس کاری', order: 1, isFilterable: true, options: [] },
    { name: 'نوع اتصال', order: 2, isFilterable: true, options: [] },
  ]

  const build = (n, props, category = categoryId) => ({
    _id: id(n),
    name: `Alarm ${n}`,
    isActive: true,
    price: 1000,
    stock: 3,
    rating: 4,
    discount: 0,
    createdAt: now,
    category,
    variants: [],
    properties: props.map(([label, value]) => ({
      label,
      value,
      normLabel: normCompareKey(label),
      normValue: toValueKey(value),
      bucket: value,
    })),
  })

  const products = [
    build(1, [['تعداد زون', '5 زون'], ['فرکانس کاری', '433 مگاهرتز'], ['نوع اتصال', 'بی‌سیم']]),
    build(2, [['تعداد زون', '8 زون'], ['فرکانس کاری', '433 مگاهرتز'], ['نوع اتصال', 'باسیم']]),
    build(3, [['تعداد زون', '5 زون'], ['فرکانس کاری', '433 مگاهرتز'], ['نوع اتصال', 'بی‌سیم']]),
    // محصول دسته‌ی دیگر نباید شمرده شود
    build(9, [['تعداد زون', '99 زون']], otherCategory),
  ]

  const chain = () => ({ select() { return this }, sort() { return this }, lean: async () => [] })
  const models = {
    Product: {
      aggregate: (pipeline) => ({ allowDiskUse: async () => aggregate(products, pipeline) }),
    },
    Brand: { find: () => chain() },
    Sale: { find: () => chain() },
    Category: {
      collection: { name: 'categories' },
      findOne: () => ({ select: () => ({ lean: async () => ({ _id: categoryId }) }) }),
      aggregate: async () => [{
        ids: [categoryId],
        selfProperties: rules,
        ancestorProperties: [],
        descendantProperties: [],
      }],
    },
  }

  // بدون هیچ پارامتر properties[...] — حالت «ورود اول به دسته»
  const result = await listProducts({ category: 'alarm-panels' }, models, now)

  assert.ok(Array.isArray(result.facets.properties))
  assert.ok(result.facets.properties.length > 0, 'سایدبار نباید خالی باشد')

  const byName = new Map(result.facets.properties.map((facet) => [facet.name, facet]))
  const zones = byName.get('تعداد زون')
  assert.ok(zones, 'تعداد زون باید حاضر باشد')
  const zoneValues = new Map(zones.values.map((v) => [v.value, v.count]))
  assert.equal(zoneValues.get('5 زون'), 2)
  assert.equal(zoneValues.get('8 زون'), 1)
  assert.equal(zoneValues.get('99 زون'), undefined, 'محصول دسته‌ی دیگر شمرده نمی‌شود')

  const freq = byName.get('فرکانس کاری')
  assert.ok(freq)
  assert.equal(freq.values.find((v) => v.value === '433 مگاهرتز').count, 3)

  // نیم‌فاصله در برچسب نمایشی حفظ می‌شود
  const conn = byName.get('نوع اتصال')
  assert.ok(conn)
  assert.ok(conn.values.some((v) => v.value === 'بی‌سیم' && v.count === 2))
})

// ------------------------------------------------------------
// ۷) bestSelling یک حالت واقعی است
// ------------------------------------------------------------
test('bestSelling sorts by salesCount and is distinct from popularity', () => {
  assert.equal(resolveSort('bestSelling', {}), 'bestSelling')
  assert.equal(resolveSort('popularity', {}), 'popularity')
  assert.equal(resolveSort('-salesCount', {}), 'bestSelling')

  const bestSelling = buildSort({ sortMode: 'bestSelling', skipDiscount: false }, new Set())
  assert.deepEqual(Object.keys(bestSelling)[0], '__listing.sort.salesCount')

  const popularity = buildSort({ sortMode: 'popularity', skipDiscount: false }, new Set())
  assert.deepEqual(Object.keys(popularity)[0], '__listing.sort.views')
})
