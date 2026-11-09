// ============================================================
// رگرسیون: یک واقعیت در فست‌ها دو بار شمرده/نمایش داده می‌شد
//
// ریشه: `prepareProductSpecsAndDescription` گزینه‌های متغیر را نرمال‌شده وارد
// `properties` می‌کند («بدون ریموت» ← «ندارد»)، ولی `variants[].options` با مقدار
// خام می‌ماند و شاخه‌های فست هر دو را می‌شمردند. نتیجه در UI:
//   «بدون ریموت ۲» و «ندارد ۲» کنار هم، «پلاستیک» و «پلاستیک فشرده (ABS)» کنار هم،
//   و برای برچسب چندکلمه‌ای شمارشی بزرگ‌تر از تعداد واقعی محصولات.
//
// آفلاین با mingo؛ هیچ اتصال MongoDB لازم نیست.
// ============================================================
const assert = require('node:assert/strict')
const test = require('node:test')
require('mingo/init/system')
const { aggregate } = require('mingo')

const { prepareProductSpecsAndDescription } = require('../services/specAndDescriptionService')
const {
  mergeCategoryRules,
  basePropertiesFacetBranch,
  propertyFacetBranchWithCounts,
  buildPropertyCriteria,
} = require('../services/listingFacets')

const rules = mergeCategoryRules([
  {
    properties: [
      { name: 'ریموت', type: 'select', options: [], order: 1 },
      { name: 'جنس بدنه', type: 'select', options: [], order: 2 },
      { name: 'نوع نصب', type: 'select', options: [], order: 3 },
    ],
  },
])

/** شبیه ذخیره‌ی محصول در routes/products.js: گزینه‌های متغیر فقط {name, value} می‌شوند و properties ساخته می‌شود */
function savedProduct(id, { specs = [], options = [] } = {}) {
  const variants = options.length
    ? [{ options: options.map(([name, value]) => ({ name, value })), price: 1_000_000, stock: 5 }]
    : []
  const prepared = prepareProductSpecsAndDescription(
    { name: `محصول ${id}`, specifications: specs.map(([label, value]) => ({ label, value })), variants, description: '' },
    rules,
  )
  return { _id: id, properties: prepared.properties, variants, __listing: { variants } }
}

const baseRows = (docs) => aggregate(docs, basePropertiesFacetBranch({ definiteMatches: [], priceMatch: [] }))
const countsFor = (rows, valKey) => rows.filter((row) => row._id.valKey === valKey).reduce((sum, row) => sum + row.count, 0)
const valKeys = (rows, labelDisplay) => rows.filter((row) => row.labelDisplay === labelDisplay).map((row) => row._id.valKey).sort()

test('گزینه‌ی متغیر «بدون ریموت» فقط یک‌بار و با باکت «ندارد» شمرده می‌شود', () => {
  const docs = [
    savedProduct('p1', { options: [['ریموت', 'بدون ریموت']] }),
    savedProduct('p2', { options: [['ریموت', 'بدون ریموت']] }),
    savedProduct('p3', { options: [['ریموت', 'یک ریموت']] }),
  ]
  const rows = baseRows(docs)
  assert.deepEqual(valKeys(rows, 'ریموت'), ['ندارد', 'یک ریموت'], 'مقدار خام «بدون ریموت» نباید کنار باکت بیاید')
  assert.equal(countsFor(rows, 'ندارد'), 2)
  assert.equal(countsFor(rows, 'بدون ریموت'), 0)
})

test('مقدار خام «پلاستیک فشرده (ABS)» کنار باکت «پلاستیک» تکرار نمی‌شود', () => {
  const docs = [
    savedProduct('p1', { options: [['جنس بدنه', 'پلاستیک فشرده (ABS)']] }),
    savedProduct('p2', { options: [['جنس بدنه', 'پلاستیک فشرده (ABS)']] }),
  ]
  const rows = baseRows(docs)
  assert.deepEqual(valKeys(rows, 'جنس بدنه'), ['پلاستیک'])
  assert.equal(countsFor(rows, 'پلاستیک'), 2)
})

test('برچسب چندکلمه‌ای: شمارش از تعداد واقعی محصولات بیشتر نمی‌شود', () => {
  const docs = [
    savedProduct('p1', { options: [['نوع نصب', 'روکار']] }),
    savedProduct('p2', { options: [['نوع نصب', 'روکار']] }),
  ]
  const rows = baseRows(docs)
  // پیش از اصلاح: دو گروه (normLabel بدون فاصله + name خام با فاصله) که در ادغام نهایی جمع می‌شدند ← ۴
  assert.equal(countsFor(rows, 'روکار'), 2)
})

test('محصول قدیمی بدون properties همچنان از گزینه‌های خام متغیر شمرده می‌شود', () => {
  const legacy = {
    _id: 'old1',
    properties: [],
    variants: [{ options: [{ name: 'رنگ', value: 'مشکی' }] }],
    __listing: { variants: [{ options: [{ name: 'رنگ', value: 'مشکی' }] }] },
  }
  const rows = baseRows([legacy])
  assert.equal(countsFor(rows, 'مشکی'), 1)
})

test('شاخه‌ی ویژگی انتخاب‌شده هم مقدار خام و باکت را دوبار نمی‌شمارد', () => {
  const docs = [
    savedProduct('p1', { options: [['ریموت', 'بدون ریموت']] }),
    savedProduct('p2', { options: [['ریموت', 'بدون ریموت']] }),
    savedProduct('p3', { options: [['ریموت', 'یک ریموت']] }),
  ]
  const criterion = buildPropertyCriteria(new Map([['ریموت', ['ندارد']]]), rules)[0]
  const rows = aggregate(docs, propertyFacetBranchWithCounts(criterion, 0, { criteria: [criterion] }))
  assert.deepEqual(rows.map((row) => row._id).sort(), ['ندارد', 'یک ریموت'])
  assert.equal(rows.find((row) => row._id === 'ندارد').count, 2)
})

test('عبارات مثبت دارای «بدون» («بدون سیم»، «بدون محدودیت»، «بدون نیاز به سیم‌کشی») به «ندارد» تخریب نمی‌شوند', () => {
  const { isNegated, normalizeBucketValue } = require('../services/specNormalization')
  assert.equal(isNegated('بدون سیم'), false)
  assert.equal(normalizeBucketValue('نوع اتصال', 'بدون سیم'), 'بی‌سیم')
  assert.equal(normalizeBucketValue('نوع اتصال', 'بدون‌سیم'), 'بی‌سیم')
  assert.equal(normalizeBucketValue('برد عملکرد', 'بدون محدودیت'), 'بدون محدودیت')
  assert.equal(normalizeBucketValue('نصب', 'بدون نیاز به سیم‌کشی'), 'بدون نیاز به سیم‌کشی')
  assert.equal(normalizeBucketValue('ریموت', 'بدون ریموت'), 'ندارد')
})

test('امتیاز utilityScore ویژگی تک‌مقداری (k=1) هرگز بالاتر از ویژگی دوگزینه‌ای هویتی («نوع کاربری») نمی‌نشیند', () => {
  const { computeFacetUtilityScore } = require('../services/listingFacets')
  const singleValueConfigured = computeFacetUtilityScore([{ value: '433 مگاهرتز', count: 10 }], 12, {
    isConfigured: true,
  })
  const twoValueIdentity = computeFacetUtilityScore(
    [
      { value: 'گیرنده ریموت و رله فرمان', count: 4 },
      { value: 'مدار فرمان کرکره برقی', count: 4 },
    ],
    12,
    { isCore: true, isConfigured: true },
  )
  assert.ok(
    twoValueIdentity > singleValueConfigured,
    `expected twoValueIdentity (${twoValueIdentity}) > singleValueConfigured (${singleValueConfigured})`,
  )
})
