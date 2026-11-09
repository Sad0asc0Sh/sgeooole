/**
 * ============================================================
 * Migration Script: Backfill product specs + evolve category facets
 * ============================================================
 * برای همه‌ی محصولات:
 *  ۱) جدول «مشخصات فنی» را از انتهای توضیحات استخراج می‌کند
 *  ۲) بلوک تکراری جدول (کامنت + کانتینر + تیتر + جدول) را از توضیحات حذف می‌کند
 *  ۳) `properties` (فست) و `specifications` (جدول کامل) را می‌نویسد
 *  ۴) گارانتی را در صورت خالی بودن پر می‌کند
 *  ۵) فست‌های هر دسته‌بندی را با autoEvolveCategoryFacets خودکار می‌سازد
 *
 * Usage:
 *   node scripts/backfillProductSpecs.js --dry-run
 *   node scripts/backfillProductSpecs.js --apply
 *   node scripts/backfillProductSpecs.js --apply --verbose --limit=500
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')
const Category = require('../models/Category')
const { prepareProductSpecsAndDescription } = require('../services/specAndDescriptionService')
const { autoEvolveCategoryFacets } = require('../services/categoryFacetEvolution')

const APPLY = process.argv.includes('--apply')
const DRY_RUN = process.argv.includes('--dry-run') || !APPLY
const VERBOSE = process.argv.includes('--verbose')
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Math.max(1, Number(LIMIT_ARG.split('=')[1]) || 0) : 0
const BATCH = 200

const log = (...args) => console.log(...args)

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
  await mongoose.connect(mongoUri)
  log(`✅ Connected: ${mongoose.connection.host}`)
  log(DRY_RUN ? '🧪 DRY-RUN (no writes)' : '✍️  APPLY mode (writes enabled)')

  // قواعد هر دسته یک‌بار بارگذاری می‌شود (شامل والدها)
  const categories = await Category.find({}).select('_id name properties parent').lean()
  const byId = new Map(categories.map((cat) => [String(cat._id), cat]))
  const rulesCache = new Map()
  const rulesFor = (categoryId) => {
    if (!categoryId) return []
    const key = String(categoryId)
    if (rulesCache.has(key)) return rulesCache.get(key)
    const chain = []
    let cursor = byId.get(key)
    let depth = 0
    while (cursor && depth < 10) {
      chain.push({ properties: cursor.properties })
      cursor = cursor.parent ? byId.get(String(cursor.parent)) : null
      depth += 1
    }
    const merged = require('../services/listingFacets').mergeCategoryRules(chain)
    rulesCache.set(key, merged)
    return merged
  }

  let query = Product.find({}).select(
    '_id name category description specifications properties attributes variants guarantee',
  )
  if (LIMIT) query = query.limit(LIMIT)
  const products = await query.lean()

  log(`📦 products to scan: ${products.length}`)

  const pendingByCategory = new Map()
  let scanned = 0
  let changed = 0
  let skipped = 0
  const operations = []

  for (const product of products) {
    scanned += 1
    const rules = rulesFor(product.category)
    const prepared = prepareProductSpecsAndDescription(product, rules)

    const hasSpecs = prepared.properties.length > 0 || Object.keys(prepared.specifications).length > 0
    if (!hasSpecs) {
      skipped += 1
      continue
    }

    const { canonicalizeSpecLabel, normalizeBucketValue, normCompareKey, toValueKey } = require('../services/specNormalization')
    const setFields = {
      properties: prepared.properties,
      specifications: prepared.specifications,
    }
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      setFields.variants = product.variants.map((v) => {
        if (!v || !Array.isArray(v.options)) return v
        return {
          ...v,
          options: v.options.map((o) => {
            if (!o || !o.name || !o.value) return o
            const name = String(o.name).trim()
            const value = String(o.value).trim()
            const canonicalLabel = canonicalizeSpecLabel(name) || name
            const bucketVal = normalizeBucketValue(canonicalLabel, value) || value
            return {
              ...o,
              name,
              value,
              normLabel: normCompareKey(canonicalLabel),
              normValue: toValueKey(bucketVal),
            }
          }),
        }
      })
    }
    if (typeof product.description === 'string' && product.description.trim()) {
      setFields.description = prepared.description
    }
    if (!product.guarantee && prepared.guarantee) setFields.guarantee = prepared.guarantee

    const descriptionWouldChange =
      typeof product.description === 'string' && product.description !== prepared.description

    changed += 1
    operations.push({ updateOne: { filter: { _id: product._id }, update: { $set: setFields } } })

    if (product.category && prepared.properties.length) {
      const key = String(product.category)
      if (!pendingByCategory.has(key)) pendingByCategory.set(key, { categoryId: product.category, properties: [] })
      pendingByCategory.get(key).properties.push(...prepared.properties)
    }

    if (VERBOSE) {
      log(
        `  • ${product.name || product._id}: ${prepared.properties.length} facet(s), ` +
          `${Object.keys(prepared.specifications).length} spec row(s)` +
          `${descriptionWouldChange ? ', description cleaned' : ''}`,
      )
    }
  }

  log(`\n🧮 scanned=${scanned} changed=${changed} skipped=${skipped} categories=${pendingByCategory.size}`)

  if (DRY_RUN) {
    log('🧪 dry-run: no writes performed.')
    await mongoose.disconnect()
    return
  }

  for (let i = 0; i < operations.length; i += BATCH) {
    const slice = operations.slice(i, i + BATCH)
    await Product.bulkWrite(slice, { ordered: false })
    log(`  ✓ wrote ${Math.min(i + BATCH, operations.length)}/${operations.length}`)
  }

  let evolved = 0
  for (const { categoryId, properties } of pendingByCategory.values()) {
    try {
      const result = await autoEvolveCategoryFacets(Category, categoryId, properties)
      if (result.changed) {
        evolved += 1
        log(`  ⚙️  category ${categoryId}: +${result.added} facet(s), +${result.optionsAdded} option(s)`)
      }
    } catch (error) {
      console.error(`  ✗ category ${categoryId}: ${error.message}`)
    }
  }

  log(`\n✅ done. products updated=${changed}, categories evolved=${evolved}`)
  await mongoose.disconnect()
  log('📦 disconnected')
}

main().catch(async (error) => {
  console.error('❌ backfill failed:', error)
  try {
    await mongoose.disconnect()
  } catch {
    /* ignore */
  }
  process.exitCode = 1
})
