/**
 * ============================================================
 * Listing Facets & Property Matching  (Phase 2.1.2 / 3.1 / 3.2)
 * ============================================================
 * سه مسئولیت:
 *   ۱) ادغام قواعد دسته‌بندی با ارث‌بری سلسله‌مراتبی (والد + فرزندان)
 *   ۲) شرط‌های تطبیق ویژگی: `$elemMatch` استاندارد و ایندکس‌پذیر
 *   ۳) تولید شاخه‌های فست Disjunctive + رتبه‌بندی با ترتیب پایدار
 *
 * قرارداد مهم: facet labels باید *قبل* از ساخت pipeline مشخص باشند،
 * بنابراین از قواعد دسته‌بندی + ویژگی‌های انتخاب‌شده ساخته می‌شوند.
 * ============================================================
 */

const { normalizeBucketValue, normCompareKey, toValueKey, isNonFilterableKey } = require('./specNormalization')

const INTERNAL = '__listing'

// ------------------------------------------------------------
// ۱) ادغام قواعد دسته‌بندی (ارث‌بری)
// ------------------------------------------------------------
const normalizeRule = (rule) => {
  if (!rule || !rule.name) return null
  const name = String(rule.name).trim()
  if (!name) return null
  return {
    name,
    key: normCompareKey(name),
    type: ['text', 'number', 'select'].includes(rule.type) ? rule.type : 'select',
    options: Array.isArray(rule.options) ? rule.options.map((o) => String(o)).filter(Boolean) : [],
    isFilterable: rule.isFilterable !== false,
    isPinned: rule.isPinned === true,
    unit: rule.unit ? String(rule.unit) : '',
    order: Number.isFinite(Number(rule.order)) ? Number(rule.order) : 0,
    aliases: Array.isArray(rule.aliases) ? rule.aliases.map((a) => String(a)).filter(Boolean) : [],
    valueAliases: rule.valueAliases && typeof rule.valueAliases === 'object' ? rule.valueAliases : {},
  }
}

/**
 * ادغام قواعد چند دسته (خود دسته → والدها → فرزندان) به یک فهرست یکتا.
 *
 * قواعد:
 *  - شناسه‌ی یکتایی: normCompareKey(name)
 *  - نزدیک‌ترین دسته برای unit/order برنده است
 *  - گزینه‌ها، aliases و valueAliases اجتماع می‌شوند
 *  - isFilterable=false در هر سطح فقط همان سطح را خاموش می‌کند؛ true برنده است
 */
function mergeCategoryRules(categories = []) {
  const merged = new Map()
  for (const category of Array.isArray(categories) ? categories : []) {
    const rules = Array.isArray(category?.properties) ? category.properties : []
    for (const raw of rules) {
      const rule = normalizeRule(raw)
      if (!rule) continue
      const existing = merged.get(rule.key)
      if (!existing) {
        merged.set(rule.key, { ...rule, options: [...new Set(rule.options)] })
        continue
      }
      existing.options = [...new Set([...existing.options, ...rule.options])]
      existing.aliases = [...new Set([...existing.aliases, ...rule.aliases])]
      existing.valueAliases = { ...rule.valueAliases, ...existing.valueAliases }
      if (existing.isFilterable === false && rule.isFilterable === true) existing.isFilterable = true
      if (!existing.unit && rule.unit) existing.unit = rule.unit
      if (!existing.isPinned && rule.isPinned) existing.isPinned = true
    }
  }
  const list = [...merged.values()]
  list.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, 'fa'))
  return list
}

/** قواعد قابل نمایش در سایدبار، به ترتیب پایدار `order`. */
function filterableRules(rules = []) {
  return (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.isFilterable !== false)
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
}

// ------------------------------------------------------------
// ۲) معیارهای ویژگی (Property Criteria)
// ------------------------------------------------------------
/**
 * هر معیار، هر دو شکل «خام» و «نرمال‌شده» را حمل می‌کند تا هم داده‌ی قدیمی
 * (بدون normValue) و هم داده‌ی جدید و هم گزینه‌ی تعریف‌شده‌ی ادمین
 * (مثلاً `2MP`) با مقدار محصول (مثلاً `۲ مگاپیکسل`) تطبیق پیدا کند.
 */
function buildPropertyCriteria(properties, rules = []) {
  if (!properties || typeof properties.entries !== 'function') return []
  const criteria = []
  for (const [label, values] of properties) {
    if (!label || !Array.isArray(values) || !values.length) continue
    const displayLabel = String(label).trim()
    const rawValues = new Set()
    const buckets = new Set()
    for (const value of values) {
      if (value === undefined || value === null) continue
      const raw = String(value).trim()
      if (!raw) continue
      rawValues.add(raw)
      const bucket = normalizeBucketValue(displayLabel, raw)
      if (bucket) {
        buckets.add(toValueKey(bucket))
        rawValues.add(bucket)
      }
    }
    if (!buckets.size && !rawValues.size) continue
    const labelKeys = [...new Set([normCompareKey(displayLabel), displayLabel].filter(Boolean))]
    const matchValues = [...new Set([...buckets, ...[...rawValues].map(toValueKey), ...rawValues])]
    criteria.push({
      label: displayLabel,
      labelKeys,
      // برچسب‌های خام برای تطبیق با داده‌ی قدیمی (بدون normLabel)
      rawLabelCandidates: [...new Set([displayLabel, ...labelKeys])],
      matchValues,
      buckets: [...buckets],
      rawValues: [...rawValues],
      rule: rules.find((rule) => rule && rule.key === normCompareKey(displayLabel)) || null,
    })
  }
  return criteria
}

/**
 * شرط تطبیق یک ویژگی — با `$elemMatch` استاندارد (نه `$expr`/`$map`).
 *
 * چرا مهم است: `$elemMatch` روی آرایه‌ی `properties`/`variants.options` از
 * ایندکس Multikey استفاده می‌کند، در حالی که `$expr` + `$map` کل سند را در
 * حافظه اسکن می‌کند.
 *
 * هر آیتم `properties` می‌تواند `{ label, value, normLabel, normValue }` باشد؛
 * شاخه‌ی دوم برای داده‌ی قدیمی (فقط label/value) است.
 */
function propertyMatchQuery(criterion) {
  const normLabel = { $in: criterion.labelKeys }
  const normValue = { $in: criterion.matchValues }
  const rawLabel = { $in: criterion.rawLabelCandidates }
  const rawValue = { $in: criterion.matchValues }
  return {
    $or: [
      {
        properties: {
          $elemMatch: {
            $or: [
              { normLabel, normValue },
              { label: rawLabel, value: rawValue },
            ],
          },
        },
      },
      {
        'variants.options': {
          $elemMatch: {
            $or: [
              { normLabel, normValue },
              { name: rawLabel, value: rawValue },
            ],
          },
        },
      },
    ],
  }
}

/**
 * شرط‌های تطبیق برای همه‌ی معیارها، با امکان حذف یک معیار (برای فست Disjunctive).
 * خروجی مستقیماً در `$match: { $and: [...] }` قابل استفاده است.
 */
function propertyMatchConditions(criteria, { excludeIndex = -1 } = {}) {
  const conditions = []
  criteria.forEach((criterion, index) => {
    if (index === excludeIndex) return
    conditions.push(propertyMatchQuery(criterion))
  })
  return conditions
}

// ------------------------------------------------------------
// ۳) کوپل متغیر با موجودی و قیمت (فقط وقتی لازم است)
// ------------------------------------------------------------
const ref = (key) => `$${INTERNAL}.${key}`

// $anyElementTrue در MongoDB آرگومان را به‌صورت `[<arrayExpr>]` می‌خواهد.
const anyTrue = (arrayExpr) => ({ $anyElementTrue: [arrayExpr] })

// آیا نام این ویژگی روی گزینه‌ی یکی از متغیرها هست؟
const optionNameExpr = (criterion) => anyTrue({
  $map: {
    input: { $ifNull: ['$$v.options', []] },
    as: 'o',
    in: { $in: [{ $ifNull: ['$$o.normLabel', '$$o.name'] }, criterion.labelKeys] },
  },
})

// آیا یک متغیر مشخص، این مقدار را دارد؟
const optionMatchExpr = (criterion) => anyTrue({
  $map: {
    input: { $ifNull: ['$$v.options', []] },
    as: 'o',
    in: {
      $and: [
        { $in: [{ $ifNull: ['$$o.normLabel', '$$o.name'] }, criterion.labelKeys] },
        { $in: [{ $ifNull: ['$$o.normValue', '$$o.value'] }, criterion.matchValues] },
      ],
    },
  },
})

/**
 * آیا به مرحله‌ی کوپل متغیر نیاز داریم؟
 *
 * هر گاه معیار ویژگی وجود داشته باشد، «قیمت نمایشی = کمترین قیمت متغیرهای
 * منطبق» یک الزام قراردادی است؛ پس مرحله‌ی کوپل همیشه اجرا می‌شود تا این
 * قیمت از میان متغیرهای منطبق (نه همه‌ی متغیرها) انتخاب شود.
 *
 * توجه: کوپل فقط روی آرایه‌ی کوچک `variants` کار می‌کند. تطبیق خودِ
 * `properties` همچنان با `$elemMatch` ایندکس‌پذیر انجام می‌شود.
 */
function needsVariantCoupling(criteria) {
  return Array.isArray(criteria) && criteria.length > 0
}

/**
 * مرحله‌های کوپل متغیر (فقط در صورت نیاز).
 *
 * خروجی:
 *  - `__listing.variantOk`        : آیا یک متغیر واحد همه‌ی معیارهای متغیری،
 *                                    موجودی مثبت و بازه‌ی قیمت را برآورده می‌کند
 *  - `__listing.matchedVariants`  : همان متغیرهای منطبق
 *  - قیمت/موجودی نمایشی از میان متغیرهای منطبق بازنویسی می‌شوند
 */
function variantCouplingStages(criteria, options = {}) {
  const fields = {}
  const variantBackedExprs = []
  criteria.forEach((criterion, index) => {
    fields[`${INTERNAL}.variantBacked_${index}`] = anyTrue({
      $map: {
        input: { $ifNull: ['$variants', []] },
        as: 'v',
        in: optionNameExpr(criterion),
      },
    })
    variantBackedExprs.push(ref(`variantBacked_${index}`))
  })

  const stages = [{ $addFields: fields }]
  const anyVariantBacked = { $or: variantBackedExprs }

  const perVariantConditions = criteria.map((criterion, index) => ({
    $cond: [ref(`variantBacked_${index}`), optionMatchExpr(criterion), true],
  }))
  const jointConditions = [...perVariantConditions]
  if (options.inStock) jointConditions.push({ $gt: [{ $ifNull: ['$$v.stock', 0] }, 0] })
  if (options.minPrice !== undefined) jointConditions.push({ $gte: ['$$v.price', options.minPrice] })
  if (options.maxPrice !== undefined) jointConditions.push({ $lte: ['$$v.price', options.maxPrice] })

  stages.push({
    $addFields: {
      [`${INTERNAL}.matchedVariants`]: {
        $cond: [
          anyVariantBacked,
          {
            $filter: {
              input: { $ifNull: [ref('variants'), []] },
              as: 'v',
              cond: jointConditions.length === 1 ? jointConditions[0] : { $and: jointConditions },
            },
          },
          { $ifNull: [ref('variants'), []] },
        ],
      },
    },
  })

  stages.push({
    $addFields: {
      [`${INTERNAL}.hasVariantCriteria`]: anyVariantBacked,
      [`${INTERNAL}.variantOk`]: {
        $or: [
          { $not: [anyVariantBacked] },
          { $gt: [{ $size: { $ifNull: [ref('matchedVariants'), []] } }, 0] },
        ],
      },
    },
  })

  const hasMatchedVariant = {
    $and: [
      ref('hasVariantCriteria'),
      { $gt: [{ $size: { $ifNull: [ref('matchedVariants'), []] } }, 0] },
    ],
  }
  stages.push({
    $addFields: {
      [`${INTERNAL}.price`]: {
        $cond: [
          hasMatchedVariant,
          { $min: { $map: { input: ref('matchedVariants'), as: 'v', in: '$$v.price' } } },
          ref('price'),
        ],
      },
      [`${INTERNAL}.stock`]: {
        $cond: [
          hasMatchedVariant,
          { $sum: { $map: { input: ref('matchedVariants'), as: 'v', in: { $ifNull: ['$$v.stock', 0] } } } },
          ref('stock'),
        ],
      },
    },
  })

  return stages
}

// ------------------------------------------------------------
// ۴) شاخه‌های فست
// ------------------------------------------------------------
/**
 * شرایط مشترک هر شاخه‌ی فست: برند (در صورت نیاز) + قیمت.
 * برند در فست برند اعمال نمی‌شود (Disjunctive).
 */
function facetBaseStages({ brandMatch = null, priceMatch = [] } = {}) {
  const stages = []
  if (brandMatch) stages.push({ $match: brandMatch })
  if (priceMatch.length) stages.push({ $match: { $and: priceMatch } })
  return stages
}

/**
 * شاخه‌ی فست یک ویژگی: همه‌ی معیارها اعمال می‌شوند به‌جز خودِ این معیار.
 */
function propertyFacetBranch(index, { criteria = [], ...context } = {}) {
  const conditions = propertyMatchConditions(criteria, { excludeIndex: index })
  const stages = facetBaseStages(context)
  if (conditions.length) stages.push({ $match: { $and: conditions } })
  return stages
}

/**
 * شاخه‌ی شمارش مقادیر یک ویژگی برای فست.
 *
 * نکته‌ی مهم (Phase Hardening ۱): گروه‌بندی روی «کلید مقایسه‌ای» انجام می‌شود
 * تا مقادیر هم‌ارز («۱۲۸ گیگابایت» و «128GB») ادغام شوند، ولی رشته‌ی نمایش
 * (`displayValue`) از مقدار خام گرفته می‌شود تا نیم‌فاصله‌ی واژه‌هایی مثل
 * «بی‌سیم»، «ژله‌ای» و «میلی‌آمپرساعت» در UI حفظ شود.
 */
function propertyFacetBranchWithCounts(criterion, index, context = {}) {
  const labelKeys = criterion.labelKeys
  const propPairs = {
    $map: {
      input: {
        $filter: {
          input: { $ifNull: ['$properties', []] },
          as: 'p',
          cond: { $in: [{ $ifNull: ['$$p.normLabel', '$$p.label'] }, labelKeys] },
        },
      },
      as: 'p',
      in: {
        k: { $ifNull: ['$$p.normValue', '$$p.value'] },
        v: { $ifNull: ['$$p.value', '$$p.normValue'] },
      },
    },
  }
  const variantPairs = {
    $map: {
      input: {
        $reduce: {
          input: { $ifNull: [ref('variants'), []] },
          initialValue: [],
          in: {
            $concatArrays: [
              '$$value',
              {
                $filter: {
                  input: { $ifNull: ['$$this.options', []] },
                  as: 'o',
                  cond: { $in: [{ $ifNull: ['$$o.normLabel', '$$o.name'] }, labelKeys] },
                },
              },
            ],
          },
        },
      },
      as: 'o',
      in: {
        k: { $ifNull: ['$$o.normValue', '$$o.value'] },
        v: { $ifNull: ['$$o.value', '$$o.normValue'] },
      },
    },
  }

  return [
    ...propertyFacetBranch(index, context),
    { $project: { pairs: { $setUnion: [propPairs, variantPairs] } } },
    { $unwind: '$pairs' },
    { $match: { 'pairs.k': { $nin: [null, ''] } } },
    // یک‌بار برای هر سند یکتا می‌شود (یک محصول، یک شمارش به ازای هر مقدار)
    { $group: { _id: { k: '$pairs.k', doc: '$_id' }, display: { $first: '$pairs.v' } } },
    // سپس شمارش روی همان کلید مقایسه‌ای، با حفظ رشته‌ی نمایش خام
    { $group: { _id: '$_id.k', displayValue: { $first: '$display' }, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: Math.max(1, Number(context.maxValues) || 60) },
  ]
}

/**
 * شاخه‌ی «همه‌ی ویژگی‌های موجود در نتایج» (propBase).
 *
 * چرا لازم است: شاخه‌های `prop_${index}` فقط برای ویژگی‌هایی ساخته می‌شوند که
 * کاربر در URL انتخاب کرده است. بنابراین در ورود اول به یک دسته‌بندی (بدون هیچ
 * فیلتری) هیچ `prop_*` وجود نداشت و همه‌ی ویژگی‌ها با count=0 برمی‌گشتند و
 * نوار Quick Filter Pills خالی می‌ماند.
 *
 * این شاخه یک‌بار روی کل نتایج منطبق اجرا می‌شود و همه‌ی جفت‌های
 * (برچسب، مقدار) را از `properties` و `variants.options` می‌شمارد.
 */
function basePropertiesFacetBranch({ definiteMatches = [], priceMatch = [], maxBuckets = 500 } = {}) {
  const labelKey = { $ifNull: ['$$p.normLabel', '$$p.label'] }
  const propPairs = {
    $map: {
      input: { $ifNull: ['$properties', []] },
      as: 'p',
      in: {
        labelKey,
        labelDisplay: '$$p.label',
        valKey: { $ifNull: ['$$p.normValue', '$$p.value'] },
        valDisplay: { $ifNull: ['$$p.bucket', '$$p.value'] },
      },
    },
  }
  const variantPairs = {
    $map: {
      input: {
        $reduce: {
          input: { $ifNull: [ref('variants'), []] },
          initialValue: [],
          in: { $concatArrays: ['$$value', { $ifNull: ['$$this.options', []] }] },
        },
      },
      as: 'p',
      in: {
        labelKey: { $ifNull: ['$$p.normLabel', '$$p.name'] },
        labelDisplay: '$$p.name',
        valKey: { $ifNull: ['$$p.normValue', '$$p.value'] },
        valDisplay: '$$p.value',
      },
    },
  }

  return [
    ...definiteMatches,
    ...priceMatch,
    { $project: { pairs: { $setUnion: [propPairs, variantPairs] } } },
    { $unwind: '$pairs' },
    { $match: { 'pairs.valKey': { $nin: [null, ''] }, 'pairs.labelKey': { $nin: [null, ''] } } },
    // یک محصول برای یک (برچسب، مقدار) فقط یک بار شمرده می‌شود
    {
      $group: {
        _id: { labelKey: '$pairs.labelKey', valKey: '$pairs.valKey', doc: '$_id' },
        labelDisplay: { $first: '$pairs.labelDisplay' },
        valDisplay: { $first: '$pairs.valDisplay' },
      },
    },
    {
      $group: {
        _id: { labelKey: '$_id.labelKey', valKey: '$_id.valKey' },
        labelDisplay: { $first: '$labelDisplay' },
        displayValue: { $first: '$valDisplay' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, '_id.valKey': 1 } },
    { $limit: Math.max(1, Number(maxBuckets) || 500) },
  ]
}

// ------------------------------------------------------------
// ۵) رتبه‌بندی و قالب‌بندی فست
// ------------------------------------------------------------
/**
 * رتبه‌بندی و قالب‌بندی فست ویژگی‌ها.
 *
 * تضمین‌ها:
 *  ۱) ترتیب ویژگی‌ها = `order` دسته‌بندی، ثابت بین کلیک‌ها
 *  ۲) گزینه‌ی انتخاب‌شده (`isSelected`) هرگز حذف نمی‌شود، حتی با count=0
 *  ۳) گزینه‌های تعریف‌شده‌ی ادمین حتی با count=0 نمایش داده می‌شوند
 *  ۴) دو مقدار که به یک باکت نرمال می‌شوند ادغام شده و شمارش جمع می‌شود
 *  ۵) رشته‌ی نمایش (`displayValue`) نیم‌فاصله را حفظ می‌کند
 */
function rankAndFormatPropertyFacets({
  bucketsByLabel = new Map(),
  rules = [],
  selected = new Map(),
  maxValues = 40,
  maxAutoFacets = 10,
} = {}) {
  const ruleByKey = new Map(filterableRules(rules).map((rule) => [rule.key, rule]))
  const labels = new Set([...bucketsByLabel.keys(), ...selected.keys()])

  const result = []
  for (const label of labels) {
    const labelKey = normCompareKey(label)
    const rule = ruleByKey.get(labelKey) || null
    const selectedValues = selected.get(label) || []
    // ویژگی‌ای که ادمین صراحتاً غیرقابل‌فیلتر کرده حذف می‌شود — مگر کاربر
    // خودش آن را انتخاب کرده باشد (باید بتواند تیک را بردارد).
    if (rule && rule.isFilterable === false && !selectedValues.length) continue

    const keyOfValue = (raw) => toValueKey(normalizeBucketValue(label, raw) || raw)

    // ادغام مقادیر هم‌باکت: کلید = کلید مقایسه‌ای، مقدار = رشته‌ی نمایش خام
    const merged = new Map()
    for (const entry of bucketsByLabel.get(label) || []) {
      const key = entry.key ? toValueKey(entry.key) : keyOfValue(entry.bucket || entry.value)
      const display = entry.value || entry.bucket || key
      const current = merged.get(key)
      if (current) current.count += Number(entry.count) || 0
      else merged.set(key, { key, value: display, count: Number(entry.count) || 0 })
    }

    // گزینه‌های تعریف‌شده‌ی ادمین (به شکل استانداردشده‌ی خودشان نمایش داده می‌شوند)
    for (const option of rule ? rule.options : []) {
      const key = keyOfValue(option)
      if (!merged.has(key)) merged.set(key, { key, value: normalizeBucketValue(label, option) || option, count: 0 })
    }
    // گزینه‌های انتخاب‌شده (هرگز حذف نمی‌شوند)
    for (const raw of selectedValues) {
      const key = keyOfValue(raw)
      if (!merged.has(key)) merged.set(key, { key, value: String(raw), count: 0 })
    }

    const selectedKeys = new Set(selectedValues.map(keyOfValue))
    const values = [...merged.values()]
      .map((entry) => ({ value: entry.value, count: entry.count, isSelected: selectedKeys.has(entry.key) }))
      .sort((a, b) => {
        if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1
        if (b.count !== a.count) return b.count - a.count
        return a.value.localeCompare(b.value, 'fa')
      })

    // سقف نمایش: گزینه‌های انتخاب‌شده و تعریف‌شده‌ی ادمین همیشه می‌مانند
    const pinned = new Set([
      ...values.filter((v) => v.isSelected).map((v) => keyOfValue(v.value)),
      ...(rule ? rule.options : []).map(keyOfValue),
    ])
    const trimmed = values.filter((v, index) => index < maxValues || pinned.has(keyOfValue(v.value)))

    result.push({
      name: label,
      unit: rule ? rule.unit : '',
      isConfigured: Boolean(rule),
      isPinned: Boolean(rule && rule.isPinned),
      order: rule ? rule.order : Number.MAX_SAFE_INTEGER,
      hasUserSelection: selectedValues.length > 0,
      totalCoverage: trimmed.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
      values: trimmed,
    })
  }

  // ------------------------------------------------------------
  // حاکمیت ضدشلوغی سایدبار (Anti-Clutter Governance)
  // ------------------------------------------------------------
  // ویژگی‌های تعریف‌شده‌ی ادمین و ویژگی‌هایی که کاربر انتخاب کرده همیشه
  // می‌مانند. ویژگی‌های «کشف‌شده‌ی خودکار» فقط اگر واقعاً فیلترپذیر باشند
  // نمایش داده می‌شوند تا سایدبار دسته‌های بزرگ از متن‌های آزاد پر نشود.
  const configured = []
  const userSelected = []
  const autos = []

  for (const entry of result) {
    if (entry.isConfigured) {
      configured.push(entry)
      continue
    }
    if (entry.hasUserSelection) {
      userSelected.push(entry)
      continue
    }
    // کلیدهای صرفاً جدولی هرگز به‌صورت خودکار وارد سایدبار نمی‌شوند
    if (isNonFilterableKey(entry.name)) continue
    const liveValues = entry.values.filter((item) => (Number(item.count) || 0) > 0)
    // تک‌مقداره‌ها فایده‌ی فیلترینگ ندارند؛ پراکندگی بیش از ۱۸ مقدار هم
    // سایدبار را غیرقابل استفاده می‌کند.
    if (liveValues.length < 2 || liveValues.length > 18) continue
    autos.push(entry)
  }

  configured.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, 'fa'))
  userSelected.sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  autos.sort((a, b) => (b.totalCoverage - a.totalCoverage) || a.name.localeCompare(b.name, 'fa'))

  const limit = Number.isFinite(Number(maxAutoFacets)) ? Math.max(0, Number(maxAutoFacets)) : 10
  return [...configured, ...userSelected, ...autos.slice(0, limit)]
}

module.exports = {
  mergeCategoryRules,
  filterableRules,
  buildPropertyCriteria,
  propertyMatchQuery,
  propertyMatchConditions,
  needsVariantCoupling,
  variantCouplingStages,
  propertyFacetBranch,
  propertyFacetBranchWithCounts,
  basePropertiesFacetBranch,
  facetBaseStages,
  rankAndFormatPropertyFacets,
  INTERNAL,
}
