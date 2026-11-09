/**
 * تشخیص «چیپ‌های بی‌معنا / تکراری» در فیلتر — فقط می‌خواند، چیزی را تغییر نمی‌دهد.
 *
 * اجرا (روی دیتابیس واقعی، با mongosh):
 *   mongosh "<MONGO_URI>" --file scripts/diagnose-quick-pills.mongosh.js
 *
 * اختیاری: اسلاگ دسته‌ی صفحه‌ی مشکل‌دار را در CATEGORY_SLUG بگذارید (زیرشاخه‌ها هم
 * شمرده می‌شوند). اگر null بماند همه‌ی محصولات بررسی می‌شوند.
 *
 * خروجی پنج جدول است:
 *   A) «ندارد» دقیقاً مال کدام ویژگی‌هاست؟            ← جواب «چی ندارد؟»
 *   B) محصولاتی که برای یک ویژگی هم مقدار خام (از گزینه‌ی متغیر) و هم باکت دارند
 *      ← اگر این جدول پر است، ریشه‌ی چیپ‌های تکراری «شمارش دوباره‌ی گزینه‌ی خام متغیر» است
 *   C) محصولاتی که properties نرمال‌نشده/قدیمی دارند ← با backfill درست می‌شود
 *   D) عبارت‌های «بدون/فاقد …» در مشخصات خام ← این‌ها همه به «ندارد» تبدیل می‌شوند،
 *      حتی «بدون سیم» (بی‌سیم) یا «بدون محدودیت»
 *   E) گزینه‌ی متغیری که در properties همان محصول هیچ معادلی ندارد (نه هم‌برچسب، نه هم‌مقدار)
 *      ← پچ بک‌اند برای محصولِ دارای properties فقط properties را می‌شمارد، پس این گزینه‌ها
 *        از فست‌ها کنار می‌روند. چطور بخوانیم:
 *          • برچسب غیرقابل‌فیلتر (مدل، گارانتی، وزن…) ← رفتار موردنظر نرمال‌ساز؛ فقط بدانید.
 *          • برچسب قابل‌فیلتر (رنگ، سایز، ظرفیت…) ← properties آن محصول قدیمی است
 *            (گزینه‌ی متغیر هیچ‌وقت وارد آن نشده)؛ پیش از استقرار پچ بک‌اند
 *            `node scripts/backfillProductSpecs.js --dry-run` و بعد `--apply` را اجرا کنید.
 */

const CATEGORY_SLUG = null // مثلاً 'receivers'
const SAMPLES_PER_ROW = 3
const MAX_ROWS = 40

// ---- کلیدهای مقایسه (هم‌ارز normCompareKey / toValueKey پروژه، بدون وابستگی) ----
const cmpKey = (s) =>
  String(s ?? '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[يئ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإ]/g, 'ا')
    .toLowerCase()
    .replace(/آ/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, '')
const valKey = (s) => String(s ?? '').replace(/‌/g, '').replace(/\s+/g, ' ').trim()

const NEGATION_RE = /^(بدون|فاقد|ندارد|ندارند|عدم|بی\s*نیاز|بی‌نیاز)/

/** تحلیل خالص روی آرایه‌ی سندها (قابل تست بدون دیتابیس) */
function analyze(products, { samples = SAMPLES_PER_ROW, maxRows = MAX_ROWS } = {}) {
  const A = new Map() // label → {n, names[]}
  const B = new Map() // `${label}|${raw}|${bucket}` → {label, raw, bucket, n, names[]}
  const C = { missingNormValue: 0, names: [] }
  const D = new Map() // `${label}|${raw}` → {label, raw, bucket, n}
  const inflation = new Map() // label → n   (برچسب چندکلمه‌ای با گزینه‌ی هم‌مقدار)
  const E = new Map() // labelKey → {label, n, values:Set, names[]}   (گزینه‌ی متغیرِ بدون معادل در properties)

  const push = (list, name) => { if (list.length < samples) list.push(name) }

  for (const product of products) {
    const properties = Array.isArray(product.properties) ? product.properties : []
    const options = (Array.isArray(product.variants) ? product.variants : [])
      .flatMap((variant) => (Array.isArray(variant && variant.options) ? variant.options : []))

    // A: کدام ویژگی‌ها باکت «ندارد» دارند
    for (const prop of properties) {
      if ((prop.bucket ?? prop.value) === 'ندارد') {
        const row = A.get(prop.label) || { n: 0, names: [] }
        row.n += 1
        push(row.names, product.name)
        A.set(prop.label, row)
      }
      // C: properties قدیمی/نرمال‌نشده
      if (prop.normValue === undefined || prop.bucket === undefined) {
        C.missingNormValue += 1
        push(C.names, product.name)
      }
    }

    // B: برای هر ویژگیِ هم‌برچسب، گزینه‌ی متغیرِ خام ≠ باکت
    for (const option of options) {
      const optionLabelKey = cmpKey(option.name)
      for (const prop of properties) {
        const propLabelKey = prop.normLabel || cmpKey(prop.label)
        if (propLabelKey !== optionLabelKey) continue
        const rawKey = valKey(option.value)
        const bucketKey = prop.normValue !== undefined ? prop.normValue : valKey(prop.bucket ?? prop.value)
        if (rawKey && bucketKey && rawKey !== bucketKey) {
          const id = `${prop.label}|${option.value}|${prop.bucket ?? prop.value}`
          const row = B.get(id) || { label: prop.label, raw: option.value, bucket: prop.bucket ?? prop.value, n: 0, names: [] }
          row.n += 1
          push(row.names, product.name)
          B.set(id, row)
        } else if (rawKey === bucketKey && String(option.name) !== cmpKey(option.name)) {
          // مقدار برابر ولی برچسب خام با فاصله/نشانه: در شمارش نهایی دو بار جمع می‌شود (تورم)
          inflation.set(prop.label, (inflation.get(prop.label) || 0) + 1)
        }
      }
    }

    // E: گزینه‌ی متغیری که محصولِ دارای properties برایش هیچ معادلی (هم‌برچسب یا هم‌مقدار) ندارد.
    //    پچ بک‌اند برای چنین محصولی فقط properties را می‌شمارد ← این گزینه از فست‌ها کنار می‌رود.
    //    محصول بدون properties (داده‌ی قدیمی) همچنان از گزینه‌های خامش شمرده می‌شود، پس در E نمی‌آید.
    if (properties.length > 0) {
      const seenLabels = new Set()
      for (const option of options) {
        const labelKey = cmpKey(option && option.name)
        const valueKey = cmpKey(option && option.value)
        if (!labelKey || !valueKey) continue
        const covered = properties.some((prop) => (
          (prop.normLabel || cmpKey(prop.label)) === labelKey
          || cmpKey(prop.value) === valueKey
          || cmpKey(prop.bucket) === valueKey
        ))
        if (covered) continue
        const row = E.get(labelKey) || { label: option.name, n: 0, values: new Set(), names: [] }
        if (!seenLabels.has(labelKey)) {
          seenLabels.add(labelKey)
          row.n += 1
          push(row.names, product.name)
        }
        if (row.values.size < samples) row.values.add(String(option.value))
        E.set(labelKey, row)
      }
    }

    // D: عبارت‌های «بدون/فاقد …» در مشخصات خام
    const specs = product.specifications
    const pairs = Array.isArray(specs)
      ? specs.map((s) => [s && (s.label ?? s.name ?? s.key), s && s.value])
      : specs && typeof specs === 'object' ? Object.entries(specs) : []
    for (const [label, raw] of pairs) {
      if (typeof raw !== 'string' || !NEGATION_RE.test(raw.trim())) continue
      const id = `${label}|${raw}`
      const bucket = properties.find((p) => (p.normLabel || cmpKey(p.label)) === cmpKey(label))
      const row = D.get(id) || { label, raw, bucket: bucket ? (bucket.bucket ?? bucket.value) : '(بدون property)', n: 0 }
      row.n += 1
      D.set(id, row)
    }
  }

  const top = (map) => [...map.values()].sort((a, b) => b.n - a.n).slice(0, maxRows)
  return {
    productCount: products.length,
    negativeBucketByProperty: [...A.entries()].map(([label, v]) => ({ label, n: v.n, samples: v.names.join(' | ') })).sort((a, b) => b.n - a.n).slice(0, maxRows),
    rawVsBucket: top(B).map((r) => ({ label: r.label, raw: r.raw, bucket: r.bucket, n: r.n, samples: r.names.join(' | ') })),
    inflationLabels: [...inflation.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    staleProperties: C,
    negationPhrases: top(D),
    variantOnlyLabels: top(E).map((r) => ({ label: r.label, n: r.n, values: [...r.values].join(' | '), samples: r.names.join(' | ') })),
  }
}

// ---- اجرا در mongosh ----
if (typeof db !== 'undefined') {
  let categoryIds = null
  if (CATEGORY_SLUG) {
    const root = db.categories.findOne({ slug: CATEGORY_SLUG }, { _id: 1 })
    if (!root) throw new Error(`دسته‌ای با slug=${CATEGORY_SLUG} پیدا نشد`)
    categoryIds = [root._id]
    for (let frontier = [root._id]; frontier.length;) {
      frontier = db.categories.find({ parent: { $in: frontier } }, { _id: 1 }).toArray().map((c) => c._id)
      categoryIds.push(...frontier)
    }
  }
  const filter = categoryIds ? { category: { $in: categoryIds } } : {}
  const products = db.products
    .find(filter, { name: 1, properties: 1, 'variants.options': 1, specifications: 1 })
    .toArray()

  const report = analyze(products)
  print(`\nمحصولات بررسی‌شده: ${report.productCount}${CATEGORY_SLUG ? ` (دسته: ${CATEGORY_SLUG} و زیرشاخه‌ها)` : ''}`)
  print('\n[A] «ندارد» مال کدام ویژگی‌هاست؟')
  console.table(report.negativeBucketByProperty)
  print('\n[B] گزینه‌ی متغیرِ خام ≠ باکتِ همان ویژگی (هر ردیف = یک چیپ تکراریِ بالقوه)')
  console.table(report.rawVsBucket)
  print('\n[B2] برچسب‌های چندکلمه‌ای که شمارششان متورم می‌شود')
  console.table(report.inflationLabels)
  print(`\n[C] properties بدون normValue/bucket (قدیمی): ${report.staleProperties.missingNormValue} مورد`)
  print('\n[D] عبارت‌های «بدون/فاقد …» در مشخصات خام و باکتی که گرفته‌اند')
  console.table(report.negationPhrases)
  print('\n[E] گزینه‌ی متغیری که در properties همان محصول معادل ندارد — بعد از پچ بک‌اند از فست‌ها کنار می‌رود')
  print('    (غیرقابل‌فیلتر مثل مدل/گارانتی/وزن = مورد انتظار؛ قابل‌فیلتر مثل رنگ/سایز = properties قدیمی ← backfill)')
  console.table(report.variantOnlyLabels)
}

if (typeof module !== 'undefined' && module.exports) module.exports = { analyze }
