/**
 * ============================================================
 * Seed Script: Category SpecTemplates (Draft Presets + Rule Migration)
 * (scripts/seedSpecTemplates.js)
 * ============================================================
 * ساخت قالب مشخصات اولیه (`SpecTemplate` با وضعیت `draft`) برای هر دسته‌بندی از روی:
 *  ۱) دو فیلتر لنگر سنجاق‌شده‌ی همیشگی (`product_type` و `brand`)
 *  ۲) الگوهای استاندارد دامنه برای خانواده‌های اصلی (دوربین، آیفون تصویری، دزدگیر، جک، قفل، اکسس)
 *  ۳) قواعد فعلی `Category.properties[]` و گزارش دقیق موارد بی‌نگاشت در حالت `--dry-run`
 *
 * Usage:
 *   node scripts/seedSpecTemplates.js --dry-run   (پیش‌فرض؛ گزارش بدون نوشتن)
 *   node scripts/seedSpecTemplates.js --apply     (ذخیره‌ی پیش‌نویس‌ها در MongoDB)
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Category = require('../models/Category')
const SpecTemplate = require('../models/SpecTemplate')
const { TEMPLATE_GROUPS, resolveAttributeDef } = require('../services/attributeDictionary')

const DOMAIN_PRESETS = [
  {
    match: /(cctv|camera|دوربین)/i,
    attrs: [
      'product_type', 'brand', 'resolution_mp', 'camera_tech', 'form',
      'ir_range_m', 'color_night', 'lens_type', 'lens_mm', 'ip_rating',
      'poe', 'mic', 'sd_slot', 'codec', 'wdr', 'smart_features',
      'body_material', 'power', 'warranty_months', 'dimensions_mm', 'operating_temp_c',
    ],
  },
  {
    match: /(nvr|dvr|xvr|ضبط)/i,
    attrs: [
      'product_type', 'brand', 'channels', 'resolution_mp', 'hdd_bays',
      'poe', 'codec', 'smart_features', 'power', 'warranty_months', 'dimensions_mm',
    ],
  },
  {
    match: /(vdp|door-phone|آیفون)/i,
    attrs: [
      'product_type', 'brand', 'screen_inch', 'keypad_type', 'vdp_memory',
      'intercom', 'second_panel', 'parking_opener', 'elevator_recall',
      'unit_capacity', 'wiring_type', 'color', 'warranty_months',
    ],
  },
  {
    match: /(alarm|دزدگیر)/i,
    attrs: [
      'product_type', 'brand', 'zones', 'dialer_type', 'frequency_mhz',
      'code_type', 'ups_support', 'connectivity', 'warranty_months',
    ],
  },
  {
    match: /(gate|jack|barrier|جک|راهبند|کرکره)/i,
    attrs: [
      'product_type', 'brand', 'leaf_width_m', 'leaf_weight_kg', 'jack_mechanism',
      'traffic_duty', 'motor_voltage', 'boom_length_m', 'ip_rating',
      'ups_support', 'warranty_months',
    ],
  },
  {
    match: /(lock|closer|قفل|آرام[\s‌]*بند)/i,
    attrs: [
      'product_type', 'brand', 'lock_type', 'identification_type',
      'door_weight_kg', 'body_material', 'installation_type', 'power', 'warranty_months',
    ],
  },
  {
    match: /(access|attendance|اکسس|حضور|تردد)/i,
    attrs: [
      'product_type', 'brand', 'identification_type', 'user_capacity',
      'log_capacity', 'connectivity', 'ip_rating', 'power', 'warranty_months',
    ],
  },
]

/**
 * ساخت خالص پیش‌نویس `SpecTemplate` برای یک دسته و گزارش فیلدهای نگاشت‌نشده
 */
function buildDraftTemplateForCategory(category) {
  const fieldsByAttr = new Map()
  const unmappedRules = []

  const addAttrField = (def, overrides = {}) => {
    if (!def || !def.key || fieldsByAttr.has(def.key)) return
    const filterable = overrides.filterable !== undefined ? overrides.filterable : def.filterable !== false
    const importance = overrides.importance
      || (!filterable ? 'hidden' : (def.importance || 'normal'))
    fieldsByAttr.set(def.key, {
      attr: def.key,
      group: overrides.group || def.group || 'general',
      order: overrides.order !== undefined ? overrides.order : (fieldsByAttr.size + 1) * 10,
      required: Boolean(overrides.required),
      importance,
      roles: {
        table: def.key !== 'product_type',
        filter: filterable && importance !== 'hidden',
        card: ['resolution_mp', 'screen_inch', 'channels', 'zones', 'leaf_weight_kg'].includes(def.key),
        compare: true,
      },
      widget: def.type === 'boolean'
        ? 'toggle'
        : (def.type === 'number' && !def.numeric?.discrete ? 'slider' : 'auto'),
      appliesWhen: null,
      dependsOn: null,
      bins: null,
    })
  }

  // ۱. دو فیلتر لنگر همیشگی در ابتدای قالب
  addAttrField(resolveAttributeDef('product_type'), { importance: 'pin', order: 1 })
  addAttrField(resolveAttributeDef('brand'), { importance: 'pin', order: 2 })

  // ۲. افزودن پیش‌فرض دامنه بر اساس نام یا اسلاگ دسته
  const haystack = `${category?.slug || ''} ${category?.name || ''}`
  for (const preset of DOMAIN_PRESETS) {
    if (preset.match.test(haystack)) {
      for (const attrKey of preset.attrs) {
        addAttrField(resolveAttributeDef(attrKey))
      }
    }
  }

  // ۳. نگاشت قواعد فعلی Category.properties[]
  const existingProps = Array.isArray(category?.properties) ? category.properties : []
  for (const prop of existingProps) {
    if (!prop || !prop.name) continue
    const def = resolveAttributeDef(prop.name)
    if (!def) {
      unmappedRules.push(String(prop.name).trim())
      continue
    }
    addAttrField(def, {
      filterable: prop.isFilterable !== false && def.filterable !== false,
      importance: prop.isPinned ? 'pin' : undefined,
      order: Number.isFinite(Number(prop.order)) && Number(prop.order) > 0
        ? Number(prop.order) + 10
        : undefined,
    })
  }

  const fields = [...fieldsByAttr.values()].sort((a, b) => a.order - b.order)
  const usedGroupKeys = new Set(fields.map((f) => f.group))
  const groups = [...usedGroupKeys]
    .map((key) => TEMPLATE_GROUPS[key] || { key, title: key, order: 50, openByDefault: false })
    .sort((a, b) => a.order - b.order)

  return {
    template: {
      category: category._id,
      version: 1,
      status: 'draft',
      groups,
      fields,
      changelog: 'Initial draft seeded from curated security domain presets and Category.properties',
    },
    unmappedRules,
  }
}

async function runCli() {
  const APPLY = process.argv.includes('--apply')
  const DRY_RUN = process.argv.includes('--dry-run') || !APPLY

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
  await mongoose.connect(mongoUri)
  console.log(`✅ Connected to MongoDB: ${mongoose.connection.host}`)
  console.log(DRY_RUN ? '🧪 DRY-RUN (no writes)' : '✍️  APPLY mode (creating missing draft SpecTemplates)')

  try {
    const categories = await Category.find({}).select('_id name slug parent properties').lean()
    console.log(`📂 Scanned categories: ${categories.length}`)

    let created = 0
    let skippedExisting = 0
    const allUnmapped = []

    for (const cat of categories) {
      const { template, unmappedRules } = buildDraftTemplateForCategory(cat)
      if (unmappedRules.length) {
        allUnmapped.push({ category: cat.name || cat.slug || String(cat._id), unmappedRules })
      }
      if (DRY_RUN) continue

      const exists = await SpecTemplate.findOne({ category: cat._id }).select('_id').lean()
      if (exists) {
        skippedExisting += 1
        continue
      }
      await SpecTemplate.create(template)
      created += 1
    }

    console.log(`📊 Unmapped Category.properties rules across catalog: ${allUnmapped.length}`)
    for (const row of allUnmapped.slice(0, 20)) {
      console.log(`   • ${row.category}: ${row.unmappedRules.join('، ')}`)
    }
    if (!DRY_RUN) {
      console.log(`✅ Draft templates created=${created}, skippedExisting=${skippedExisting}`)
    }
  } finally {
    await mongoose.disconnect()
  }
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error('❌ seedSpecTemplates failed:', err)
    process.exit(1)
  })
}

module.exports = {
  DOMAIN_PRESETS,
  buildDraftTemplateForCategory,
}
