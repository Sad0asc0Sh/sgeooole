/**
 * ============================================================
 * Seed Script: Attribute Dictionary & Enum Values
 * (scripts/seedAttributeDictionary.js)
 * ============================================================
 * بذرگذاری دیکشنری ویژگی‌ها (`AttributeDef`) و مقادیر استاندارد (`AttributeValue`)
 * از ترکیب واژگان دامنه‌ی تجهیزات امنیتی و اتوماسیون (`attributeDictionary.js` +
 * کاتالوگ مهندسی‌معکوس‌شده‌ی دکاشاپ) و جداول مترادف `specNormalization.js`.
 *
 * Usage:
 *   node scripts/seedAttributeDictionary.js --dry-run   (پیش‌فرض؛ بدون نوشتن در DB)
 *   node scripts/seedAttributeDictionary.js --apply     (اعمال idempotent در MongoDB)
 *   node scripts/seedAttributeDictionary.js --apply --verbose
 */

require('dotenv').config()
const mongoose = require('mongoose')
const AttributeDef = require('../models/AttributeDef')
const AttributeValue = require('../models/AttributeValue')
const { ATTRIBUTE_DEFINITIONS, resolveAttributeDef } = require('../services/attributeDictionary')
const { BUILTIN_KEY_SYNONYMS } = require('../services/specNormalization')

function slugifyFallbackKey(persianLabel, index) {
  const ascii = String(persianLabel || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (ascii && /^[a-z][a-z0-9_]*$/.test(ascii)) return ascii
  return `spec_attr_${index + 1}`
}

/**
 * ساخت خالص اسناد بذرگذاری `AttributeDef` و `AttributeValue` (قابل تست بدون MongoDB)
 */
function buildDictionarySeedPayloads() {
  const attrDocs = []
  const valueDocs = []
  const seenKeys = new Set()

  for (const def of ATTRIBUTE_DEFINITIONS) {
    seenKeys.add(def.key)
    const aliases = [...new Set((def.aliases || []).map((a) => String(a).trim()).filter(Boolean))]
    attrDocs.push({
      key: def.key,
      label: def.label,
      aliases,
      type: def.type,
      scope: def.scope || 'product',
      unit: {
        canonical: def.unit?.canonical || '',
        label: def.unit?.label || '',
        aliases: def.unit?.aliases || [],
      },
      numeric: {
        discrete: Boolean(def.numeric?.discrete),
        min: def.numeric?.min ?? null,
        max: def.numeric?.max ?? null,
      },
      filterable: def.filterable !== false,
      allowNew: def.allowNew || (def.filterable === false ? 'none' : 'review'),
      status: 'active',
      mergedInto: null,
      sourceCatalogSlug: def.sourceCatalogSlug || '',
    })

    const values = Array.isArray(def.values) ? def.values : []
    values.forEach((v, idx) => {
      valueDocs.push({
        attr: def.key,
        key: String(v.key).trim().toLowerCase(),
        label: v.label,
        aliases: [...new Set((v.aliases || []).map((a) => String(a).trim()).filter(Boolean))],
        order: v.order !== undefined ? v.order : (idx + 1) * 10,
      })
    })
  }

  // اطمینان از پوشش ۱۰۰٪ گروه‌های مترادف موجود در BUILTIN_KEY_SYNONYMS
  const extraSynonymGroups = []
  const synonymEntries = Array.isArray(BUILTIN_KEY_SYNONYMS)
    ? BUILTIN_KEY_SYNONYMS.map((entry) => [entry?.canonical, entry?.aliases || []])
    : Object.entries(BUILTIN_KEY_SYNONYMS || {})

  synonymEntries.forEach(([canonicalLabel, variants], idx) => {
    if (!canonicalLabel) return
    const variantList = Array.isArray(variants) ? variants : []
    const existing = resolveAttributeDef(canonicalLabel) || variantList.map(resolveAttributeDef).find(Boolean)
    if (existing) {
      const target = attrDocs.find((d) => d.key === existing.key)
      if (target) {
        const mergedAliases = new Set(target.aliases)
        if (canonicalLabel !== target.label) mergedAliases.add(canonicalLabel)
        for (const v of variantList) {
          if (v && v !== target.label) mergedAliases.add(String(v).trim())
        }
        target.aliases = [...mergedAliases]
      }
      return
    }

    let fallbackKey = slugifyFallbackKey(canonicalLabel, idx)
    while (seenKeys.has(fallbackKey)) fallbackKey = `${fallbackKey}_${idx + 1}`
    seenKeys.add(fallbackKey)
    extraSynonymGroups.push(canonicalLabel)
    attrDocs.push({
      key: fallbackKey,
      label: canonicalLabel,
      aliases: [...new Set(variantList.filter((v) => v && v !== canonicalLabel))],
      type: 'enum',
      scope: 'product',
      unit: { canonical: '', label: '', aliases: [] },
      numeric: { discrete: false, min: null, max: null },
      filterable: true,
      allowNew: 'review',
      status: 'active',
      mergedInto: null,
      sourceCatalogSlug: '',
    })
  })

  return {
    attrDocs,
    valueDocs,
    summary: {
      totalAttributes: attrDocs.length,
      filterableAttributes: attrDocs.filter((d) => d.filterable).length,
      tableOnlyAttributes: attrDocs.filter((d) => !d.filterable).length,
      totalEnumValues: valueDocs.length,
      extraSynonymGroupsMapped: extraSynonymGroups.length,
    },
  }
}

async function runCli() {
  const APPLY = process.argv.includes('--apply')
  const DRY_RUN = process.argv.includes('--dry-run') || !APPLY
  const VERBOSE = process.argv.includes('--verbose')

  const { attrDocs, valueDocs, summary } = buildDictionarySeedPayloads()
  console.log('📚 Attribute Dictionary Seed Summary:', summary)
  if (VERBOSE) {
    for (const d of attrDocs) {
      console.log(`  - [${d.filterable ? 'filter' : 'table '}] ${d.key} (${d.type}) => ${d.label}`)
    }
  }

  if (DRY_RUN) {
    console.log('🧪 DRY-RUN complete (no database writes). Pass --apply to persist to MongoDB.')
    return
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
  await mongoose.connect(mongoUri)
  console.log(`✅ Connected to MongoDB: ${mongoose.connection.host}`)

  try {
    if (attrDocs.length) {
      const attrOps = attrDocs.map((doc) => ({
        updateOne: {
          filter: { key: doc.key },
          update: { $set: doc },
          upsert: true,
        },
      }))
      const attrRes = await AttributeDef.bulkWrite(attrOps, { ordered: false })
      console.log(`✍️  AttributeDef upserted=${attrRes.upsertedCount}, modified=${attrRes.modifiedCount}`)
    }

    if (valueDocs.length) {
      const valOps = valueDocs.map((doc) => ({
        updateOne: {
          filter: { attr: doc.attr, key: doc.key },
          update: { $set: doc },
          upsert: true,
        },
      }))
      const valRes = await AttributeValue.bulkWrite(valOps, { ordered: false })
      console.log(`✍️  AttributeValue upserted=${valRes.upsertedCount}, modified=${valRes.modifiedCount}`)
    }
  } finally {
    await mongoose.disconnect()
  }
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error('❌ seedAttributeDictionary failed:', err)
    process.exit(1)
  })
}

module.exports = {
  buildDictionarySeedPayloads,
}
