/**
 * ============================================================
 * Spec & Description Service  (Phase 2.2 / 2.3 / 2.4)
 * ============================================================
 * موتور استخراج و نرمال‌سازی مشخصات فنی محصول، مشترک بین:
 *   - ذخیره‌ی محصول (create / update / variant)
 *   - درون‌ریزی CSV/Excel
 *   - Backfill دسته‌بندی (discovered-specs / sync-discovered-properties)
 *   - موتور فستینگ (productListingService)
 *
 * سه اصل غیرقابل‌مذاکره:
 *   1) «غیرمخرب»: توضیحات HTML ادمین (عکس، لینک، ویدیو، استایل) هرگز
 *      strip و بازنویسی نمی‌شود. استخراج مشخصات فقط خواندنی است.
 *   2) «بدون حذف مقدار معتبر»: normalizeBucketValue هرگز برای مقدار
 *      غیراستاندارد null برنمی‌گرداند.
 *   3) «اولویت ادمین»: هر ویژگی که در category.properties تعریف شده و
 *      isFilterable !== false باشد، قطعاً قابل فیلتر است.
 * ============================================================
 */

const {
  normalizeText,
  normCompareKey,
  toValueKey,
  normalizeBucketValue,
  isNonFilterableKey,
  NON_FILTERABLE_KEYS_BASE,
  PREVIOUSLY_BLOCKED_KEYS,
} = require('./specNormalization')

// نگهبان نفی برای سازگاری با مصرف‌کننده‌های خارجی
// (همان الگوی یونیکدِ specNormalization؛ `\b` کنار حروف فارسی کار نمی‌کند)
const NEGATION_GUARD = /(?<!\p{L})(?:فاقد|ندارد|بدون|غیر\s*فعال|خیر|no|without)(?!\p{L})/iu

// ------------------------------------------------------------
// ۱) ابزارهای HTML
// ------------------------------------------------------------
const HTML_ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&zwnj;': '\u200c', '&raquo;': '»', '&laquo;': '«',
}

function decodeEntities(input) {
  return String(input).replace(/&[a-z#0-9]+;/gi, (entity) => {
    const known = HTML_ENTITIES[entity.toLowerCase()]
    if (known !== undefined) return known
    const numeric = entity.match(/^&#(\d+);$/)
    if (numeric) {
      const code = Number(numeric[1])
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity
    }
    return entity
  })
}

/** متن یک تکه HTML (فقط برای *خواندن* مقدار مشخصه، هرگز برای توضیحات) */
function stripTagsToText(html) {
  if (html === null || html === undefined) return ''
  return normalizeText(
    decodeEntities(
      String(html)
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
}

// تگ‌هایی که نشان می‌دهند توضیحات «HTML غنی ادمین» است
const RICH_HTML_RE = /<\s*(img|a|video|audio|iframe|picture|source|table|ul|ol|li|strong|b|em|i|u|h[1-6]|p|br|div|span|figure|blockquote|hr)\b/i

/**
 * آیا این توضیحات HTML غنی است که نباید هرگز تخریب شود؟
 * (تصویر، لینک، ویدیو، تگ فرمت‌بندی، استایل)
 */
function hasRichHtml(description) {
  if (typeof description !== 'string' || !description.trim()) return false
  if (/style\s*=|<style\b/i.test(description)) return true
  return RICH_HTML_RE.test(description)
}

/** تکرار جدول مشخصات فنی در بدنه‌ی توضیحات (برای حذف اختیاری) */
const SPEC_TABLE_MARKER = /(مشخصات\s*فنی|ویژگی\s*های\s*فنی|مشخصات\s*محصول|specifications?|tech(nical)?\s*specs?)/iu

/**
 * استخراج جفت‌های (label, value) از HTML — کاملاً خواندنی.
 * پشتیبانی: <table><tr><th/><td/></tr></table>، <dl><dt/><dd/></dl>،
 *           <li><strong>label:</strong> value</li>، و ردیف‌های <div>label</div><div>value</div>
 */
function extractSpecsFromHtml(html) {
  const pairs = []
  if (typeof html !== 'string' || !html.trim()) return pairs

  const push = (label, value) => {
    const cleanLabel = stripTagsToText(label).replace(/[:：]\s*$/, '').trim()
    const cleanValue = stripTagsToText(value).replace(/^[:：]\s*/, '').trim()
    if (!cleanLabel || !cleanValue) return
    if (cleanLabel.length > 80 || cleanValue.length > 400) return
    pairs.push({ label: cleanLabel, value: cleanValue })
  }

  // --- جدول‌ها ---
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi
  let table
  while ((table = tableRe.exec(html)) !== null) {
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
    let row
    while ((row = rowRe.exec(table[1])) !== null) {
      const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi
      const cells = []
      let cell
      while ((cell = cellRe.exec(row[1])) !== null) cells.push(cell[2])
      if (cells.length === 2) push(cells[0], cells[1])
      else if (cells.length === 4) {
        // جدول چهار ستونه: label | value | label | value
        push(cells[0], cells[1])
        push(cells[2], cells[3])
      }
    }
  }

  // --- definition list ---
  const dlRe = /<dl\b[^>]*>([\s\S]*?)<\/dl>/gi
  let dl
  while ((dl = dlRe.exec(html)) !== null) {
    const itemRe = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi
    let item
    while ((item = itemRe.exec(dl[1])) !== null) push(item[1], item[2])
  }

  // --- لیست «برچسب: مقدار» ---
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
  let li
  while ((li = liRe.exec(html)) !== null) {
    const text = stripTagsToText(li[1])
    const match = text.match(/^([^:：]{2,60})\s*[:：]\s*(.{1,300})$/u)
    if (match) push(match[1], match[2])
  }

  return pairs
}

/**
 * حذف «فقط» جدول مشخصات فنی تکراری از توضیحات، بدون لمس بقیه‌ی DOM.
 * پیش‌فرض خاموش است و فقط وقتی ادمین صریحاً بخواهد اجرا می‌شود.
 */
function removeDuplicateSpecTables(html) {
  if (typeof html !== 'string' || !html.includes('<table')) return html
  const tableRe = /<table\b[^>]*>[\s\S]*?<\/table>/gi
  let result = ''
  let lastIndex = 0
  let match
  while ((match = tableRe.exec(html)) !== null) {
    // نشانگر ممکن است در عنوان بالای جدول باشد (رایج) یا در اولین ردیف خودِ
    // جدول (مثلاً <th>مشخصات فنی</th>). هر دو پذیرفته می‌شود، ولی حذف فقط
    // روی همین یک جدول انجام می‌شود.
    const before = html.slice(Math.max(0, match.index - 400), match.index)
    const markerBefore = SPEC_TABLE_MARKER.test(stripTagsToText(before))
    const markerInside = SPEC_TABLE_MARKER.test(stripTagsToText(match[0].slice(0, 300)))
    if (markerBefore || markerInside) {
      result += html.slice(lastIndex, match.index)
    } else {
      result += html.slice(lastIndex, match.index + match[0].length)
    }
    lastIndex = match.index + match[0].length
  }
  result += html.slice(lastIndex)
  return result
}

// ------------------------------------------------------------
// ۲) قالب HTML ساختاریافته (فقط با درخواست صریح ادمین)
// ------------------------------------------------------------
function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * قالب پیش‌فرض «مشخصات فنی». فقط زمانی فراخوانی می‌شود که ادمین دکمه‌ی
 * «درج قالب پیش‌فرض» را زده باشد (applyStructuredTemplate === true).
 */
function buildStructuredHtmlDescription({ name, properties = [], intro = '' } = {}) {
  const rows = properties
    .filter((item) => item && item.label && item.value)
    .map((item) => `      <tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`)
    .join('\n')

  const section = rows
    ? `<section class="spec-section">
  <h2>مشخصات فنی</h2>
  <table class="spec-table">
    <tbody>
${rows}
    </tbody>
  </table>
</section>`
    : ''

  const introBlock = intro ? `<p>${escapeHtml(intro)}</p>` : ''
  const heading = name ? `<h1>${escapeHtml(name)}</h1>` : ''
  return [heading, introBlock, section].filter(Boolean).join('\n')
}

// ------------------------------------------------------------
// ۳) نرمال‌سازی جفت (label, value)
// ------------------------------------------------------------
function toSpecPairs(specifications) {
  if (!specifications) return []
  if (Array.isArray(specifications)) {
    return specifications
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const label = item.label ?? item.name ?? item.key ?? item.title
        const value = item.value ?? item.val ?? item.text
        if (label === undefined || value === undefined) return null
        if (value !== null && typeof value === 'object') return null
        return { label, value }
      })
      .filter(Boolean)
  }
  if (typeof specifications === 'string') {
    const trimmed = specifications.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return toSpecPairs(JSON.parse(trimmed))
      } catch {
        return []
      }
    }
    return []
  }
  if (typeof specifications === 'object') {
    return Object.entries(specifications)
      .filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object')
      .map(([label, value]) => ({ label, value }))
  }
  return []
}

/**
 * آیا این ویژگی در category.properties توسط ادمین تعریف شده و قابل فیلتر است؟
 * (Phase 2.3.4 — حتی اگر isPinned === false باشد)
 */
function isExplicitlyEnabledByAdmin(label, categoryRules) {
  if (!Array.isArray(categoryRules) || !categoryRules.length) return false
  const key = normCompareKey(label)
  if (!key) return false
  return categoryRules.some((rule) => {
    if (!rule || !rule.name) return false
    if (normCompareKey(rule.name) !== key) return false
    return rule.isFilterable !== false
  })
}

/**
 * تصمیم نهایی «قابل فیلتر بودن» یک ویژگی.
 * اولویت مطلق با ادمین است: تعریف در دسته + isFilterable !== false
 * بر تمام لیست‌های سیاه داخلی مقدم است.
 */
function normalizeFilterFacetPair({ label, value, categoryRules } = {}) {
  const cleanLabel = normalizeText(label)
  if (!cleanLabel) return null
  const explicitlyEnabledByAdmin = isExplicitlyEnabledByAdmin(cleanLabel, categoryRules)
  const filterable = explicitlyEnabledByAdmin ? true : !isNonFilterableKey(cleanLabel)
  const normValue = normalizeBucketValue(cleanLabel, value)
  if (normValue === null) return null
  const rule = Array.isArray(categoryRules)
    ? categoryRules.find((item) => item && normCompareKey(item.name) === normCompareKey(cleanLabel))
    : null
  return {
    label: cleanLabel,
    value: normalizeText(value),
    normValue,
    explicitlyEnabledByAdmin,
    filterable,
    isPinned: Boolean(rule && rule.isPinned),
    order: rule && Number.isFinite(Number(rule.order)) ? Number(rule.order) : null,
    unit: rule && rule.unit ? rule.unit : '',
  }
}

// ------------------------------------------------------------
// ۴) استخراج جفت‌ها از همه‌ی منابع محصول
// ------------------------------------------------------------
/** گزینه‌های متغیرها → ویژگی (Phase 2.1.1) */
function variantOptionPairs(variants) {
  const pairs = []
  for (const variant of Array.isArray(variants) ? variants : []) {
    if (!variant || !Array.isArray(variant.options)) continue
    for (const option of variant.options) {
      if (!option || !option.name || option.value === undefined || option.value === null) continue
      pairs.push({ label: option.name, value: option.value, source: 'variant' })
    }
  }
  return pairs
}

/** ویژگی‌های محصول (attributes[].values) → ویژگی */
function attributePairs(attributes) {
  const pairs = []
  for (const attribute of Array.isArray(attributes) ? attributes : []) {
    if (!attribute || !attribute.name) continue
    const values = Array.isArray(attribute.values) ? attribute.values : []
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue
      pairs.push({ label: attribute.name, value, source: 'attribute' })
    }
  }
  return pairs
}

// ------------------------------------------------------------
// ۵) موتور اصلی
// ------------------------------------------------------------
/**
 * آماده‌سازی مشخصات و توضیحات یک محصول.
 *
 * @param {object} product محصول (سند Mongoose، شیء ساده یا payload ادمین)
 * @param {Array}  categoryRules قواعد properties دسته‌بندی (با ارث‌بری)
 * @param {object} options
 *   - removeDuplicateSpecTable: حذف صریح جدول مشخصات تکراری (پیش‌فرض false)
 *   - applyStructuredTemplate: درج قالب پیش‌فرض (پیش‌فرض false)
 *   - extractFromDescription: استخراج مشخصات از HTML توضیحات (پیش‌فرض true)
 * @returns {{properties: Array, specifications: object, description: string, extracted: Array}}
 */
function prepareProductSpecsAndDescription(product, categoryRules = [], options = {}) {
  const source = product || {}
  const {
    removeDuplicateSpecTable = false,
    applyStructuredTemplate = false,
    extractFromDescription = true,
  } = options

  const collected = []
  const seen = new Set()
  const add = (label, value, sourceTag) => {
    const pair = normalizeFilterFacetPair({ label, value, categoryRules })
    if (!pair) return
    const key = `${normCompareKey(pair.label)}\u0000${normCompareKey(pair.normValue)}`
    if (seen.has(key)) return
    seen.add(key)
    collected.push({ ...pair, source: sourceTag })
  }

  // (۱) specifications — منبع رسمی «مشخصات فنی»
  for (const pair of toSpecPairs(source.specifications)) add(pair.label, pair.value, 'specifications')

  // (۲) properties موجود (ممکن است از قبل پر شده باشد)
  for (const pair of toSpecPairs(source.properties)) add(pair.label, pair.value, 'properties')

  // (۳) attributes محصول (Phase 2.1.1)
  for (const pair of attributePairs(source.attributes)) add(pair.label, pair.value, 'attributes')

  // (۴) گزینه‌های متغیرها (Phase 2.1.1) — رنگ/سایز/ظرفیت/گارانتی
  for (const pair of variantOptionPairs(source.variants)) add(pair.label, pair.value, 'variant')

  // (۵) استخراج خواندنی از HTML توضیحات (Phase 2.2.2)
  const descriptionInput = typeof source.description === 'string' ? source.description : ''
  if (extractFromDescription && descriptionInput) {
    for (const pair of extractSpecsFromHtml(descriptionInput)) add(pair.label, pair.value, 'description')
  }

  // ترتیب: ابتدا ترتیب دسته‌بندی، سپس الفبایی برای بقیه (پایدار)
  const orderOf = (label) => {
    const key = normCompareKey(label)
    const index = categoryRules.findIndex((rule) => rule && normCompareKey(rule.name) === key)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }
  collected.sort((a, b) => {
    const byOrder = orderOf(a.label) - orderOf(b.label)
    if (byOrder !== 0) return byOrder
    return normCompareKey(a.label).localeCompare(normCompareKey(b.label), 'fa')
  })

  // specifications استاندارد (شیء label → value؛ اولین مقدار برنده)
  const specifications = {}
  for (const item of collected) {
    if (!(item.label in specifications)) specifications[item.label] = item.value
  }

  // properties مخصوص موتور فستینگ (شامل مقادیر نرمال‌شده)
  // normLabel: کلید مقایسه‌ای برچسب — normValue: باکت استاندارد مقدار.
  // تطبیق کوئری هم دقیقاً از همین دو تابع عبور می‌کند (Phase 2.4.1).
  const properties = collected.map((item) => ({
    label: item.label,
    value: item.value,
    normLabel: normCompareKey(item.label),
    normValue: toValueKey(item.normValue),
    bucket: item.normValue,
  }))

  // ---- توضیحات: غیرمخرب ----
  let description = descriptionInput
  if (description && removeDuplicateSpecTable) {
    description = removeDuplicateSpecTables(description)
  }
  if (applyStructuredTemplate) {
    // فقط با درخواست صریح ادمین؛ و فقط وقتی توضیحات خالی است یا ادمین
    // واقعاً خواسته قالبنشود. محتوای موجود هرگز دور ریخته نمی‌شود.
    const template = buildStructuredHtmlDescription({
      name: source.name,
      properties: collected.map((item) => ({ label: item.label, value: item.value })),
    })
    description = description && description.trim() ? `${description}\n${template}` : template
  }

  return {
    properties,
    specifications,
    description,
    extracted: collected.map(({ label, value, bucket, source: sourceTag }) => ({ label, value, bucket, source: sourceTag })),
  }
}

/**
 * فقط استخراج (بدون تغییر توضیحات) — برای Backfill و endpointهای دسته‌بندی.
 */
function extractSpecsOnly(product, categoryRules = []) {
  return prepareProductSpecsAndDescription(product, categoryRules, {
    removeDuplicateSpecTable: false,
    applyStructuredTemplate: false,
    extractFromDescription: true,
  })
}

module.exports = {
  prepareProductSpecsAndDescription,
  extractSpecsOnly,
  parseAndCleanDescription: (description, options = {}) =>
    prepareProductSpecsAndDescription(
      { description, specifications: options.specifications },
      options.categoryRules || [],
      { removeDuplicateSpecTable: options.removeDuplicateSpecTable === true },
    ),
  buildStructuredHtmlDescription,
  extractSpecsFromHtml,
  removeDuplicateSpecTables,
  stripTagsToText,
  hasRichHtml,
  toSpecPairs,
  variantOptionPairs,
  attributePairs,
  normalizeFilterFacetPair,
  isExplicitlyEnabledByAdmin,
  NEGATION_GUARD,
  NON_FILTERABLE_KEYS: NON_FILTERABLE_KEYS_BASE,
  PREVIOUSLY_BLOCKED_KEYS,
}
