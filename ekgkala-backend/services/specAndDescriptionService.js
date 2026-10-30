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
  normalizeFacetValue,
  canonicalizeSpecLabel,
  isNonFilterableKey,
  NON_FILTERABLE_KEYS_BASE,
  PREVIOUSLY_BLOCKED_KEYS,
  SPEC_TABLE_ONLY_KEYS,
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

// عنوان‌هایی که یک جدول را «جدول مشخصات فنی» می‌کنند
const SPEC_HEADING_TEXT = /(?:مشخصات\s*فنی|جدول\s*مشخصات(?:\s*فنی)?|مشخصات\s*محصول)/iu

/** تبدیل `<h1>` به `<h2>` — تک‌بودن h1 صفحه حفظ می‌شود (هم‌طول، پس ایندکس‌ها می‌مانند) */
function demoteDescriptionH1(html) {
  if (typeof html !== 'string' || !/<h1\b/i.test(html)) return html
  return html.replace(/<h1(\b[^>]*)>([\s\S]*?)<\/h1>/gi, '<h2$1>$2</h2>')
}

/** ایندکس بسته‌شدن `</div>` متناظر با یک `<div ...>` (با شمارش تودرتویی) */
function findMatchingDivClose(html, openIndex) {
  const tagRe = /<\/?div\b[^>]*>/gi
  tagRe.lastIndex = openIndex
  let depth = 0
  let match
  while ((match = tagRe.exec(html)) !== null) {
    if (match[0].startsWith('</')) depth -= 1
    else depth += 1
    if (depth === 0) return match.index + match[0].length
  }
  return -1
}

/**
 * محدوده‌ی کامل بلوک «مشخصات فنی» را پیدا می‌کند:
 * کامنت `<!-- Technical Specifications -->` + کانتینر `<div>` + تیتر `<h2>` + `<table>`.
 */
function findSpecTableBlocks(html) {
  const blocks = []
  if (typeof html !== 'string' || !/<table\b/i.test(html)) return blocks

  const tableRe = /<table\b[^>]*>[\s\S]*?<\/table>/gi
  let table
  let previousTableEnd = 0
  while ((table = tableRe.exec(html)) !== null) {
    const tableStart = table.index
    const tableEnd = tableStart + table[0].length
    // پنجره‌ی نگاه‌به‌عقب نباید از جدول قبلی عبور کند، وگرنه نشانگر «مشخصات فنی»
    // جدول قبلی، جدول‌های بعدی را هم بی‌دلیل حذف می‌کند.
    const windowStart = Math.max(previousTableEnd, tableStart - 900)
    previousTableEnd = tableEnd
    const before = html.slice(windowStart, tableStart)
    const markerBefore = SPEC_TABLE_MARKER.test(stripTagsToText(before))
    const markerInside = SPEC_TABLE_MARKER.test(stripTagsToText(table[0].slice(0, 400)))
    if (!markerBefore && !markerInside) continue

    let start = tableStart

    // ۱) تیتر بلافاصله بالای جدول (حتی بدون div اختصاصی)
    const headings = [...before.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    const lastHeading = headings.at(-1)
    if (lastHeading) {
      const headingStartAbs = tableStart - before.length + lastHeading.index
      const headingEndAbs = headingStartAbs + lastHeading[0].length
      if (/^\s*$/.test(html.slice(headingEndAbs, tableStart)) && SPEC_HEADING_TEXT.test(stripTagsToText(lastHeading[0]))) {
        start = headingStartAbs
      }
    }

    // ۲) کانتینر <div> بلافاصله قبل از تیتر/جدول
    let containerOpen = -1
    const beforeStart = html.slice(Math.max(0, start - 400), start)
    const openDivs = [...beforeStart.matchAll(/<div\b[^>]*>/gi)]
    const lastOpenDiv = openDivs.at(-1)
    if (lastOpenDiv) {
      const divStartAbs = start - beforeStart.length + lastOpenDiv.index
      if (/^\s*$/.test(html.slice(divStartAbs + lastOpenDiv[0].length, start))) {
        containerOpen = divStartAbs
        start = divStartAbs
      }
    }

    // ۳) کامنت <!-- Technical Specifications --> قبل از بلوک
    const beforeComment = html.slice(Math.max(0, start - 400), start)
    const comments = [...beforeComment.matchAll(/<!--[\s\S]*?-->/g)]
    const lastComment = comments.at(-1)
    if (lastComment) {
      const commentStartAbs = start - beforeComment.length + lastComment.index
      const commentEndAbs = commentStartAbs + lastComment[0].length
      if (/^\s*$/.test(html.slice(commentEndAbs, start))) start = commentStartAbs
    }

    // ۴) پایان بلوک: اگر کانتینر داشتیم، تا بسته‌شدن همان div
    let end = tableEnd
    if (containerOpen >= 0) {
      const close = findMatchingDivClose(html, containerOpen)
      if (close > 0) end = close
    }

    blocks.push({ start, end })
  }
  return blocks
}

/**
 * حذف «کل بلوک» جدول مشخصات فنی از توضیحات — نه فقط تگ `<table>`.
 *
 * این تابع عمداً محافظه‌کار است: فقط بلوکی حذف می‌شود که نشانگر «مشخصات فنی»
 * داشته باشد، و محدوده‌ی حذف دقیقاً تا بسته‌شدن کانتینر همان بلوک است. سایر
 * بخش‌های قالب (هدر، معرفی محصول، کارت‌های ۰۱..۰۶، کاربردها، تصاویر و لینک‌ها)
 * با تمام استایل‌های اینلاین دست‌نخورده می‌مانند.
 *
 * همچنین `<h1>` داخل توضیحات به `<h2>` تبدیل می‌شود تا سئوی صفحه (تک‌بودن h1) حفظ شود.
 */
function removeDuplicateSpecTables(html) {
  if (typeof html !== 'string' || !html) return html

  const blocks = findSpecTableBlocks(html)
  let cleaned = html
  if (blocks.length) {
    // از انتها به ابتدا حذف می‌کنیم تا ایندکس‌های قبلی معتبر بمانند
    for (const block of [...blocks].sort((a, b) => b.start - a.start)) {
      cleaned = cleaned.slice(0, block.start) + cleaned.slice(block.end)
    }
    // فاصله‌ی خالی باقی‌مانده در انتها را جمع کن (باکس خالی نساز)
    cleaned = cleaned.replace(/(?:\s|<br\s*\/?>)+$/gi, '').trim()
  }

  return demoteDescriptionH1(cleaned)
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
 * تصمیم نهایی «قابل فیلتر بودن» یک ویژگی + ساخت جفت (label, value) استاندارد.
 *
 * دو لایه:
 *  - `value`    : متن کامل و خام (برای جدول specifications صفحه محصول)
 *  - `normValue`: باکت کوتاه و خوانا (برای چیپ فست سایدبار)
 *
 * اولویت مطلق با ادمین است: تعریف در دسته + isFilterable !== false بر تمام
 * لیست‌های سیاه داخلی (از جمله SPEC_TABLE_ONLY_KEYS) مقدم است.
 */
function normalizeFilterFacetPair({ label, value, categoryRules } = {}) {
  const rawLabel = normalizeText(label)
  if (!rawLabel) return null
  const rawValue = normalizeText(value)
  if (!rawValue) return null

  const canonicalLabel = canonicalizeSpecLabel(rawLabel, categoryRules)
  const explicitlyEnabledByAdmin =
    isExplicitlyEnabledByAdmin(canonicalLabel, categoryRules) ||
    isExplicitlyEnabledByAdmin(rawLabel, categoryRules)

  const { bucket, filterable: bucketFilterable } = normalizeFacetValue(canonicalLabel, value)
  if (bucket === null) return null

  const rule = Array.isArray(categoryRules)
    ? categoryRules.find((item) => item && normCompareKey(item.name) === normCompareKey(canonicalLabel))
    : null

  return {
    label: canonicalLabel,
    rawLabel,
    // متن کامل برای specifications
    value: rawValue,
    rawValue,
    // باکت کوتاه برای properties / سایدبار
    normValue: bucket,
    bucket,
    explicitlyEnabledByAdmin,
    filterable: explicitlyEnabledByAdmin ? true : bucketFilterable,
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
// برچسب‌هایی که مقدارشان می‌تواند فیلد `guarantee` محصول را پر کند
const GUARANTEE_LABEL_KEYS = new Set(
  ['گارانتی', 'مدت گارانتی', 'ضمانت', 'مدت ضمانت'].map(normCompareKey),
)

/**
 * آماده‌سازی مشخصات و توضیحات یک محصول.
 *
 * @param {object} product محصول (سند Mongoose، شیء ساده یا payload ادمین)
 * @param {Array}  categoryRules قواعد properties دسته‌بندی (با ارث‌بری)
 * @param {object} options
 *   - removeDuplicateSpecTable: حذف کل بلوک جدول مشخصات از توضیحات (پیش‌فرض true)
 *   - applyStructuredTemplate: درج قالب پیش‌فرض (پیش‌فرض false)
 *   - extractFromDescription: استخراج مشخصات از HTML توضیحات (پیش‌فرض true)
 * @returns {{properties: Array, specifications: object, description: string, guarantee: string, extracted: Array}}
 */
function prepareProductSpecsAndDescription(product, categoryRules = [], options = {}) {
  const source = product || {}
  const {
    removeDuplicateSpecTable = true,
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
  let extractedFromDesc = []
  if (extractFromDescription && descriptionInput) {
    extractedFromDesc = extractSpecsFromHtml(descriptionInput)
    for (const pair of extractedFromDesc) add(pair.label, pair.value, 'description')
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

  // ------------------------------------------------------------
  // لایه‌ی اول: specifications — جدول کامل صفحه محصول (متن کامل)
  // ------------------------------------------------------------
  // همه‌ی آیتم‌ها وارد می‌شوند، حتی `filterable: false` (مثل «مدت ضبط پیام»
  // یا «تعداد مدیران سیستم») تا تب «مشخصات فنی» هیچ ردیفی را از دست ندهد.
  // برچسب این لایه «خام» است (وفاداری به سند اصلی)؛ برچسب استانداردشده فقط
  // در لایه‌ی دوم (properties) استفاده می‌شود.
  const specifications = {}
  for (const item of collected) {
    const label = item.rawLabel || item.label
    if (!(label in specifications)) specifications[label] = item.value
  }

  // ------------------------------------------------------------
  // لایه‌ی دوم: properties — فقط فست‌های کوتاه و قابل فیلتر سایدبار
  // ------------------------------------------------------------
  // `value` = باکت خوانا (با نیم‌فاصله) — `normValue` = کلید مقایسه‌ای.
  // کلیدهای صرفاً جدولی و جمله‌های بلند اینجا حذف می‌شوند.
  const properties = collected
    .filter((item) => item.filterable)
    .map((item) => ({
      label: item.label,
      value: item.normValue,
      normLabel: normCompareKey(item.label),
      normValue: toValueKey(item.normValue),
      bucket: item.normValue,
    }))

  // ---- گارانتی: از مشخصات استخراج‌شده اگر فیلد اختصاصی خالی بود ----
  let guarantee = normalizeText(source.guarantee || '')
  if (!guarantee) {
    const found = collected.find((item) => GUARANTEE_LABEL_KEYS.has(normCompareKey(item.rawLabel || item.label)))
    if (found) guarantee = found.value
  }

  // ---- توضیحات: غیرمخرب ----
  let description = descriptionInput
  // پیش‌فرض روشن: اگر از جدول مشخصات فنیِ توضیحات حداقل یک جفت استخراج شد،
  // کل بلوک (کامنت + کانتینر + تیتر + جدول) حذف می‌شود تا با تب مشخصات فنی
  // تکرار نشود و باکس سفید خالی در انتهای توضیحات نماند.
  if (description && removeDuplicateSpecTable && extractedFromDesc.length > 0) {
    description = removeDuplicateSpecTables(description)
  } else if (description) {
    // حتی وقتی جدولی برای حذف نیست، h1 داخلی باید به h2 تبدیل شود
    description = demoteDescriptionH1(description)
  }
  if (applyStructuredTemplate) {
    // فقط با درخواست صریح ادمین؛ و فقط وقتی توضیحات خالی است یا ادمین
    // واقعاً خواسته قالبنشود. محتوای موجود هرگز دور ریخته نمی‌شود.
    const template = buildStructuredHtmlDescription({
      name: source.name,
      properties: collected
        .filter((item) => item.filterable)
        .map((item) => ({ label: item.label, value: item.normValue })),
    })
    description = description && description.trim() ? `${description}\n${template}` : template
  }

  return {
    properties,
    specifications,
    description,
    guarantee,
    extracted: collected.map(({ label, value, normValue, filterable, source: sourceTag }) => ({
      label,
      value,
      bucket: normValue,
      filterable,
      source: sourceTag,
    })),
    extractedFromDescriptionCount: extractedFromDesc.length,
  }
}

/**
 * فقط استخراج (بدون تغییر توضیحات) — برای Backfill و endpointهای دسته‌بندی.
 * توجه: توضیحات این‌جا دست‌نخورده برمی‌گردد (removeDuplicateSpecTable=false)
 * تا Backfill هرگز متن ادمین را تغییر ندهد.
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
      { removeDuplicateSpecTable: options.removeDuplicateSpecTable !== false },
    ),
  buildStructuredHtmlDescription,
  extractSpecsFromHtml,
  removeDuplicateSpecTables,
  findSpecTableBlocks,
  demoteDescriptionH1,
  stripTagsToText,
  hasRichHtml,
  toSpecPairs,
  variantOptionPairs,
  attributePairs,
  normalizeFilterFacetPair,
  isExplicitlyEnabledByAdmin,
  NEGATION_GUARD,
  GUARANTEE_LABEL_KEYS,
  SPEC_TABLE_ONLY_KEYS,
  NON_FILTERABLE_KEYS: NON_FILTERABLE_KEYS_BASE,
  PREVIOUSLY_BLOCKED_KEYS,
}
