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

const {
  normalizeBucketValue,
  normCompareKey,
  toValueKey,
  isNonFilterableKey,
  isCoreIdentityKey,
} = require('./specNormalization')
const { resolveAttributeDef, expandAttributeQueryValues } = require('./attributeDictionary')

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
function buildPropertyCriteria(properties, rules = [], { attrMeta = null, ranges = [] } = {}) {
  const criteria = []
  if (properties && typeof properties.entries === 'function') {
    for (const [label, values] of properties) {
      if (!label || !Array.isArray(values) || !values.length) continue
      const displayLabel = String(label).trim()
      const meta = attrMeta instanceof Map ? attrMeta.get(displayLabel) : null
      const attrDef = meta?.def || resolveAttributeDef(displayLabel)

      const rawValues = new Set()
      const buckets = new Set()
      const facetKeys = new Set(meta?.facetKeys || [])

      const allInputValues = meta?.expandedValues?.length
        ? [...new Set([...values, ...meta.expandedValues])]
        : values

      for (const value of allInputValues) {
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
      if (attrDef && !meta) {
        const expanded = expandAttributeQueryValues(attrDef, values)
        for (const fk of expanded.facetKeys) facetKeys.add(fk)
      }

      if (!buckets.size && !rawValues.size && !facetKeys.size) continue

      const extraLabels = meta?.labelCandidates || []
      const labelKeys = [...new Set([
        normCompareKey(displayLabel),
        displayLabel,
        ...extraLabels.map((l) => normCompareKey(l)),
        ...extraLabels,
      ].filter(Boolean))]
      const matchValues = [...new Set([...buckets, ...[...rawValues].map(toValueKey), ...rawValues])]

      criteria.push({
        kind: 'discrete',
        attr: meta?.attr || (attrDef ? attrDef.key : null),
        label: displayLabel,
        labelKeys,
        // برچسب‌های خام برای تطبیق با داده‌ی قدیمی (بدون normLabel)
        rawLabelCandidates: [...new Set([displayLabel, ...extraLabels, ...labelKeys])],
        matchValues,
        buckets: [...buckets],
        rawValues: [...rawValues],
        facetKeys: [...facetKeys],
        rule: rules.find((rule) => rule && rule.key === normCompareKey(displayLabel)) || null,
      })
    }
  }

  for (const r of Array.isArray(ranges) ? ranges : []) {
    if (!r || (r.min === undefined && r.max === undefined)) continue
    criteria.push({
      kind: 'range',
      attr: r.attr,
      label: r.label,
      labelKeys: r.labelKeys,
      rawLabelCandidates: r.rawLabelCandidates,
      min: r.min,
      max: r.max,
      rule: rules.find((rule) => rule && rule.key === normCompareKey(r.label)) || null,
    })
  }

  return criteria
}

const DIGIT_REPLACEMENTS = [
  ['۰', '0'], ['۱', '1'], ['۲', '2'], ['۳', '3'], ['۴', '4'],
  ['۵', '5'], ['۶', '6'], ['۷', '7'], ['۸', '8'], ['۹', '9'],
  ['٠', '0'], ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'],
  ['٥', '5'], ['٦', '6'], ['٧', '7'], ['٨', '8'], ['٩', '9'],
  ['٫', '.'], ['٬', ''],
]

function asciiDigitsExpr(strExpr) {
  return DIGIT_REPLACEMENTS.reduce(
    (acc, [find, replacement]) => ({ $replaceAll: { input: acc, find, replacement } }),
    strExpr,
  )
}

/**
 * شرط تطبیق بازه‌ی عددی (`r.<key>=min-max`):
 *  ۱) مسیر ایندکس‌پذیر روی داده‌ی تایپ‌دار `specs[]` (`specs.attr` + `specs.num` یا همپوشانی `[min, max]`)
 *  ۲) مسیر سازگار با داده‌ی قدیمی روی `properties[]` بدون نیاز به مهاجرت اجباری
 */
function rangeMatchQuery(criterion) {
  const { attr, labelKeys, rawLabelCandidates, min, max } = criterion
  const numBounds = {}
  if (min !== undefined) numBounds.$gte = min
  if (max !== undefined) numBounds.$lte = max

  const specElemOr = [{ num: numBounds }]
  const intervalMatch = {
    min: { $type: 'number', ...(max !== undefined ? { $lte: max } : {}) },
    max: { $type: 'number', ...(min !== undefined ? { $gte: min } : {}) },
  }
  specElemOr.push(intervalMatch)

  const legacyPropCond = {
    $expr: {
      $anyElementTrue: [
        {
          $map: {
            input: { $ifNull: ['$properties', []] },
            as: 'p',
            in: {
              $and: [
                {
                  $or: [
                    { $in: ['$$p.normLabel', labelKeys] },
                    { $in: ['$$p.label', rawLabelCandidates] },
                  ],
                },
                {
                  $let: {
                    vars: {
                      rx: {
                        $regexFind: {
                          input: asciiDigitsExpr({
                            $ifNull: ['$$p.normValue', { $ifNull: ['$$p.value', ''] }],
                          }),
                          regex: '\\d+(?:\\.\\d+)?',
                        },
                      },
                    },
                    in: {
                      $cond: [
                        { $eq: ['$$rx', null] },
                        false,
                        {
                          $let: {
                            vars: {
                              parsedNum: {
                                $convert: {
                                  input: '$$rx.match',
                                  to: 'double',
                                  onNull: null,
                                  onError: null,
                                },
                              },
                            },
                            in: {
                              $and: [
                                { $ne: ['$$parsedNum', null] },
                                ...(min !== undefined ? [{ $gte: ['$$parsedNum', min] }] : []),
                                ...(max !== undefined ? [{ $lte: ['$$parsedNum', max] }] : []),
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  }

  return {
    $or: [
      { specs: { $elemMatch: { attr, $or: specElemOr } } },
      legacyPropCond,
    ],
  }
}

/**
 * شرط تطبیق یک ویژگی — با `$elemMatch` استاندارد (نه `$expr`/`$map`).
 *
 * چرا مهم است: `$elemMatch` روی آرایه‌ی `properties`/`variants.options` و
 * ایندکس چندکلیدی `facetKeys` از ایندکس Multikey استفاده می‌کند.
 *
 * هر آیتم `properties` می‌تواند `{ label, value, normLabel, normValue }` باشد؛
 * شاخه‌ی دوم برای داده‌ی قدیمی (فقط label/value) است.
 */
function propertyMatchQuery(criterion) {
  if (criterion && criterion.kind === 'range') {
    return rangeMatchQuery(criterion)
  }
  const normLabel = { $in: criterion.labelKeys }
  const normValue = { $in: criterion.matchValues }
  const rawLabel = { $in: criterion.rawLabelCandidates }
  const rawValue = { $in: criterion.matchValues }
  const branches = []
  if (Array.isArray(criterion.facetKeys) && criterion.facetKeys.length) {
    branches.push({ facetKeys: { $in: criterion.facetKeys } })
  }
  branches.push(
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
  )
  return { $or: branches }
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
  return Array.isArray(criteria) && criteria.some((c) => c && c.kind !== 'range')
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
function variantCouplingStages(rawCriteria, options = {}) {
  const criteria = (Array.isArray(rawCriteria) ? rawCriteria : []).filter((c) => c && c.kind !== 'range')
  if (!criteria.length) return []
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
 * منبع حقیقتِ شمارش فست‌ها = `properties` (باکت‌شده در زمان ذخیره).
 *
 * `prepareProductSpecsAndDescription` گزینه‌های متغیر را هم نرمال‌شده وارد
 * `properties` می‌کند، اما خودِ `variants[].options` با مقدار *خام* می‌ماند. اگر
 * هر دو منبع با هم شمرده شوند، یک واقعیت دو بار می‌آید («بدون ریموت» خام +
 * «ندارد» باکت‌شده، یا «پلاستیک فشرده (ABS)» + «پلاستیک»). برای برچسب
 * چندکلمه‌ای هم کلید برچسب دو منبع فرق دارد (`normLabel` بدون فاصله، `name` خام
 * با فاصله) و در ادغام نهایی شمارش‌ها جمع می‌شوند و از تعداد واقعی محصولات
 * بیشتر می‌شود.
 *
 * بنابراین گزینه‌های خام متغیر فقط برای محصولی شمرده می‌شوند که هنوز هیچ
 * `properties` ندارد (داده‌ی قدیمیِ نرمال‌نشده).
 */
const hasNormalizedProperties = { $gt: [{ $size: { $ifNull: ['$properties', []] } }, 0] }

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
    { $project: { pairs: { $cond: [hasNormalizedProperties, propPairs, variantPairs] } } },
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
 * (برچسب، مقدار) را از `properties` می‌شمارد؛ `variants.options` فقط برای
 * محصولِ بدون `properties` (داده‌ی قدیمی) جایگزین می‌شود — توضیح در
 * `hasNormalizedProperties`.
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
    { $project: { pairs: { $cond: [hasNormalizedProperties, propPairs, variantPairs] } } },
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
 *  ۶) در دسته‌ی مادر (غیربرگ) قواعد زیرشاخه‌ها «پیکربندی‌شده» حساب نمی‌شوند و
 *     فست کم‌پوشش یا تک‌مقداری زیرشاخه به سایدبار مادر نشت نمی‌کند
 */

/**
 * امتیاز ریاضی فست بر پایه‌ی پوشش (Coverage)، آنتروپی نرمال‌شده‌ی شانون با
 * تصحیح میلر-مادو (Miller-Madow) و ضریب کاردینالیتی S(k).
 */
function computeFacetUtilityScore(values, totalItems, { isCore = false, isConfigured = false, isPinned = false } = {}) {
  const live = (Array.isArray(values) ? values : []).filter((v) => (Number(v.count) || 0) > 0)
  const k = live.length
  if (k === 0) return 0
  const n = live.reduce((sum, v) => sum + (Number(v.count) || 0), 0)
  const denom = Math.max(Number(totalItems) || 0, n, 1)
  const coverage = Math.min(1, n / denom)

  if (k === 1) {
    // ویژگی تک‌مقداره (Entropy = 0) قدرت تفکیک ندارد و نباید بالاتر از ویژگی‌های چندمقداره‌ی تفکیک‌کننده بنشیند
    return (isPinned ? 0.85 : isCore ? 0.65 : isConfigured ? 0.35 : 0.15) * coverage
  }

  let H = 0
  for (const item of live) {
    const p = (Number(item.count) || 0) / n
    if (p > 0) H -= p * Math.log2(p)
  }
  const mmCorrection = (k - 1) / (2 * n * Math.LN2)
  const hNorm = Math.min(1, (H + mmCorrection) / Math.log2(k))
  const sCard = k <= 12 ? 1.0 : Math.max(0.2, 1 - (k - 12) / 10)
  const boost = isPinned ? 2.5 : isConfigured ? 1.8 : isCore ? 1.5 : 1.0

  return boost * Math.pow(coverage, 1.2) * (0.65 * hNorm + 0.35 * sCard)
}

function rankAndFormatPropertyFacets({
  bucketsByLabel = new Map(),
  rules = [],
  directRuleKeys = null,
  selected = new Map(),
  totalItems = 0,
  isLeafCategory = true,
  maxValues = 40,
  maxAutoFacets = 10,
  openCount = 5,
} = {}) {
  // `mergeCategoryRules` برچسب نرمال‌شده (`key`) را می‌سازد، اما این تابع نباید
  // به آن وابسته باشد: قواعد خام (مثلاً از تست یا فراخوانی مستقیم) هم باید کار کنند.
  const ruleByKey = new Map(
    filterableRules(rules).map((rule) => [rule.key || normCompareKey(rule.name), rule]),
  )
  // قواعد «مستقیم» = خود دسته + والدها. بدون این مجموعه همه‌ی قواعد مستقیم‌اند (رفتار قبلی).
  const directSet = directRuleKeys instanceof Set ? directRuleKeys : new Set(ruleByKey.keys())
  const labels = new Set([...bucketsByLabel.keys(), ...selected.keys()])

  const result = []
  for (const label of labels) {
    const labelKey = normCompareKey(label)
    const rule = ruleByKey.get(labelKey) || null
    const isDirectRule = Boolean(rule && directSet.has(labelKey))
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

    // گزینه‌های تعریف‌شده‌ی ادمین (فقط برای قواعد مستقیم همین دسته/والدها)
    const ruleOptions = isDirectRule && rule ? rule.options : []
    for (const option of ruleOptions) {
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
      ...ruleOptions.map(keyOfValue),
    ])
    const trimmed = values.filter((v, index) => index < maxValues || pinned.has(keyOfValue(v.value)))
    const liveValues = trimmed.filter((item) => (Number(item.count) || 0) > 0)
    const totalCoverage = trimmed.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
    const isCore = isCoreIdentityKey(label)
    const isPinned = Boolean(isDirectRule && rule && rule.isPinned)
    const attrDef = resolveAttributeDef(label)

    result.push({
      name: label,
      ...(attrDef ? { key: attrDef.key } : {}),
      unit: rule ? rule.unit : (attrDef?.unit?.label || ''),
      isConfigured: isDirectRule,
      isPinned,
      order: isDirectRule && rule ? rule.order : Number.MAX_SAFE_INTEGER,
      hasUserSelection: selectedValues.length > 0,
      liveValueCount: liveValues.length,
      isCoreIdentity: isCore,
      totalCoverage,
      utilityScore: computeFacetUtilityScore(trimmed, totalItems || totalCoverage, {
        isCore,
        isConfigured: isDirectRule,
        isPinned,
      }),
      values: trimmed,
    })
  }

  // ------------------------------------------------------------
  // حاکمیت ضدشلوغی سایدبار (Anti-Clutter Governance + Shannon Entropy)
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
    // هیچ مقدار زنده‌ای ندارد ⇒ بی‌فایده؛ بیش از ۱۸ مقدار ⇒ سایدبار غیرقابل استفاده.
    //
    // نکته‌ی مهم (Single-Product Identity): در دسته‌ی برگ ویژگی تک‌مقداره حذف
    // نمی‌شود؛ اگر دسته فقط یک محصول داشته باشد، همان یک مقدار «هویت» کالاست.
    if (entry.liveValueCount === 0 || entry.liveValueCount > 18) continue

    // در دسته‌ی مادر (غیربرگ) با چند محصول، فست‌های کم‌پوشش یا تک‌گزینه‌ای
    // زیرشاخه‌ها نباید به سایدبار مادر نشت کنند.
    if (!isLeafCategory && totalItems >= 4) {
      const cov = entry.totalCoverage / totalItems
      if (entry.liveValueCount < 2 || cov < 0.5) continue
    }
    autos.push(entry)
  }

  configured.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, 'fa'))
  userSelected.sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  // رتبه‌بندی: چندمقداره‌ی هویتی > هویتیِ تک‌مقداره > چندمقداره > بقیه؛
  // سپس امتیاز آنتروپی، پوشش و الفبا.
  autos.sort((a, b) => {
    const aTier = (a.liveValueCount >= 2 ? 2 : 0) + (a.isCoreIdentity ? 1 : 0)
    const bTier = (b.liveValueCount >= 2 ? 2 : 0) + (b.isCoreIdentity ? 1 : 0)
    if (bTier !== aTier) return bTier - aTier
    if (b.utilityScore !== a.utilityScore) return b.utilityScore - a.utilityScore
    return (b.totalCoverage - a.totalCoverage) || a.name.localeCompare(b.name, 'fa')
  })

  const limit = Number.isFinite(Number(maxAutoFacets)) ? Math.max(0, Number(maxAutoFacets)) : 10
  const open = Number.isFinite(Number(openCount)) ? Math.max(0, Number(openCount)) : 5
  return [...configured, ...userSelected, ...autos.slice(0, limit)].map((entry, idx) => ({
    ...entry,
    defaultOpen: entry.hasUserSelection || idx < open,
  }))
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
  computeFacetUtilityScore,
  INTERNAL,
}
