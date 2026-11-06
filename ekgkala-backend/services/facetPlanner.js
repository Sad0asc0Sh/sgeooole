/**
 * ============================================================
 * Pure Template-Driven Facet Planner (services/facetPlanner.js)
 * ============================================================
 * برنامه‌ریز خالص و قطعی چیدمان، بودجه‌بندی، حذف افزونگی، «سؤال بعدی» و
 * بازیابی نتیجه‌ی صفر بر پایه‌ی قالب مشخصات دسته و شمارش‌های Disjunctive.
 *
 * مراجع طراحی:
 *  - Vandic, Aanen, Frasincar, Kaymak (IEEE TKDE 2017): پوشش × ناخالصی جینی
 *  - Baymard Institute: سقف بودجه‌ی نمایش، باز بودن ۵ فیلتر نخست، مسیر خروج از صفر نتیجه
 *
 * هیچ وابستگی به پایگاه داده یا وضعیت خارجی ندارد تا هم در مسیر آنلاین
 * (صرفاً با شمارش‌های موجود `$facet`) و هم در پیش‌نمایش ادمین و تست‌ها اجرا شود.
 * ============================================================
 */

const WEIGHT = Object.freeze({
  high: 1.5,
  normal: 1,
  low: 0.6,
})

const MAX_UI_VALUES = 12

const LEAF_DEFAULTS = Object.freeze({
  minCov: 0.25,
  budget: 10,
  openN: 5,
  redSkip: 0.85,
})

const PARENT_DEFAULTS = Object.freeze({
  minCov: 0.8,
  budget: 8,
  openN: 5,
  redSkip: 0.85,
})

/**
 * تبدیل ورودی توزیع شمارش به `Map(valueKey -> positiveCount)`؛
 * گزینه‌های دارای شمارش صفر حذف می‌شوند تا تک‌مقداری‌های واقعی تشخیص داده شوند.
 */
function toDistMap(dist) {
  const map = new Map()
  if (!dist) return map
  if (dist instanceof Map) {
    for (const [k, v] of dist.entries()) {
      const n = Number(v)
      if (k !== undefined && k !== null && String(k) !== '' && Number.isFinite(n) && n > 0) {
        map.set(String(k), n)
      }
    }
    return map
  }
  if (Array.isArray(dist)) {
    for (const item of dist) {
      if (!item) continue
      const key = item.key ?? item.value
      const n = Number(item.count)
      if (key !== undefined && key !== null && String(key) !== '' && Number.isFinite(n) && n > 0) {
        map.set(String(key), (map.get(String(key)) || 0) + n)
      }
    }
    return map
  }
  if (typeof dist === 'object') {
    for (const [k, v] of Object.entries(dist)) {
      const n = Number(v)
      if (k !== '' && Number.isFinite(n) && n > 0) {
        map.set(k, n)
      }
    }
  }
  return map
}

function normalizeRedundancyLookup(redundancy) {
  const lookup = Object.create(null)
  if (!redundancy) return lookup
  if (Array.isArray(redundancy)) {
    for (const row of redundancy) {
      if (!row || !row.a || !row.b) continue
      const a = String(row.a)
      const b = String(row.b)
      const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`
      const nmi = Number(row.nmi)
      if (Number.isFinite(nmi) && nmi > 0) {
        lookup[pairKey] = Math.min(1, nmi)
      }
    }
    return lookup
  }
  if (redundancy instanceof Map) {
    for (const [pair, val] of redundancy.entries()) {
      const nmi = Number(val)
      if (Number.isFinite(nmi) && nmi > 0) lookup[String(pair)] = Math.min(1, nmi)
    }
    return lookup
  }
  if (typeof redundancy === 'object') {
    for (const [pair, val] of Object.entries(redundancy)) {
      const parts = pair.split('|')
      const nmi = Number(val)
      if (!Number.isFinite(nmi) || nmi <= 0) continue
      if (parts.length === 2) {
        const [a, b] = parts
        const canonical = a < b ? `${a}|${b}` : `${b}|${a}`
        lookup[canonical] = Math.min(1, nmi)
      } else {
        lookup[pair] = Math.min(1, nmi)
      }
    }
  }
  return lookup
}

/**
 * ۱) امتیازدهی یک ویژگی روی مجموعه‌ی نتایج فعلی (R)
 *
 * @param {object} field - تعریف فیلد قالب ({ attr, group, importance, roles, ... })
 * @param {Map|object|Array} rawDist - نگاشت مقدار زنده به شمارش
 * @param {number} covered - تعداد محصولات دارای حداقل یک مقدار برای این ویژگی در R
 * @param {number} total - کل نتایج فعلی |R|
 * @param {object} [usage={}] - نرخ تعامل نرمال‌شده در بازه [0, 1]
 */
function scoreFacet(field, rawDist, covered, total, usage = {}) {
  const dist = rawDist instanceof Map ? toDistMap(rawDist) : toDistMap(rawDist)
  const k = dist.size
  if (k < 2) return null // تک‌مقداری: چیزی را تفکیک نمی‌کند

  let sum = 0
  let sq = 0
  for (const c of dist.values()) {
    sum += c
    sq += c * c
  }
  if (sum <= 0) return null

  const safeCovered = Math.max(0, Math.min(Number(covered) || 0, Number(total) || 0))
  const cov = total > 0 ? safeCovered / total : 0
  const impurity = 1 - sq / (sum * sum)
  const ui = k <= MAX_UI_VALUES ? 1 : MAX_UI_VALUES / k

  let prior = 1
  if (usage && usage[field.attr] != null && Number.isFinite(Number(usage[field.attr]))) {
    const clampedUsage = Math.max(0, Math.min(1, Number(usage[field.attr])))
    prior = 0.5 + 0.5 * clampedUsage
  }

  const editorialWeight = WEIGHT[field.importance] || 1
  const score = cov * impurity * ui * prior * editorialWeight
  return { ...field, k, cov, impurity, ui, prior, score }
}

/**
 * ۲) برنامه‌ریزی کامل فست‌های سایدبار (انتخاب حریصانه + جریمه افزونگی + بودجه + سرفصل)
 */
function planFacets({
  fields = [],
  dists = {},
  covered = {},
  total = 0,
  redundancy = {},
  usage = {},
  applied = null,
  isLeaf = true,
  minCov,
  budget,
  openN,
  redSkip,
} = {}) {
  const defaults = isLeaf === false ? PARENT_DEFAULTS : LEAF_DEFAULTS
  const effectiveMinCov = minCov !== undefined ? minCov : defaults.minCov
  const effectiveBudget = budget !== undefined ? budget : defaults.budget
  const effectiveOpenN = openN !== undefined ? openN : defaults.openN
  const effectiveRedSkip = redSkip !== undefined ? redSkip : defaults.redSkip

  const appliedSet = applied instanceof Set
    ? applied
    : Array.isArray(applied)
      ? new Set(applied)
      : null

  const dropped = {}
  const pool = []

  fields.forEach((f, idx) => {
    if (!f || !f.attr) return
    if (f.importance === 'hidden' || (f.roles && f.roles.filter === false)) {
      dropped[f.attr] = 'table-only'
      return
    }
    if (f.dependsOn && (!appliedSet || !appliedSet.has(f.dependsOn))) {
      dropped[f.attr] = `depends-on:${f.dependsOn}`
      return
    }
    const rawDist = dists instanceof Map ? dists.get(f.attr) : dists[f.attr]
    const dist = toDistMap(rawDist)
    if (!dist || dist.size === 0) {
      dropped[f.attr] = 'no-data'
      return
    }
    const covCount = covered instanceof Map ? (covered.get(f.attr) || 0) : (covered[f.attr] || 0)
    const s = scoreFacet({ ...f, idx }, dist, covCount, total, usage)
    if (!s) {
      dropped[f.attr] = 'single-value'
      return
    }
    if (s.cov < effectiveMinCov && f.importance !== 'pin') {
      dropped[f.attr] = `low-coverage ${s.cov.toFixed(2)}`
      return
    }
    pool.push(s)
  })

  const redLookup = normalizeRedundancyLookup(redundancy)
  const redOf = (a, b) => redLookup[a < b ? `${a}|${b}` : `${b}|${a}`] || 0

  const ranked = []
  while (pool.length) {
    let best = null
    for (const c of pool) {
      c.red = 0
      c.redWith = null
      for (const s of ranked) {
        const v = redOf(c.attr, s.attr)
        if (v > c.red) {
          c.red = v
          c.redWith = s.attr
        }
      }
      c.adj = c.score * (1 - 0.8 * c.red)
      // فیلدهای سنجاق‌شده (pin) همیشه اول و دقیقاً به ترتیب قالب می‌آیند، نه به ترتیب امتیاز
      c.sel = c.importance === 'pin' ? 1e6 - c.idx : c.adj
      if (
        !best
        || c.sel - best.sel > 1e-12
        || (Math.abs(c.sel - best.sel) <= 1e-12 && (c.idx < best.idx || (c.idx === best.idx && c.attr.localeCompare(best.attr) < 0)))
      ) {
        best = c
      }
    }
    pool.splice(pool.indexOf(best), 1)
    if (best.importance !== 'pin' && best.red >= effectiveRedSkip) {
      dropped[best.attr] = `redundant-with:${best.redWith}`
      continue
    }
    ranked.push(best)
  }

  const visible = ranked.slice(0, effectiveBudget)
  const byGroup = new Map()
  for (const c of visible) {
    const groupKey = c.group || 'general'
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, [])
    byGroup.get(groupKey).push(c)
  }
  const groups = [...byGroup]
    .map(([key, list]) => ({
      key,
      attrs: list.map((c) => c.attr),
      top: Math.max(...list.map((c) => c.adj)),
    }))
    .sort((a, b) => (b.top - a.top) || a.key.localeCompare(b.key))

  return {
    open: visible.slice(0, effectiveOpenN).map((c) => c.attr),
    visible: visible.map((c) => c.attr),
    more: ranked.slice(effectiveBudget).map((c) => c.attr),
    dropped,
    groups,
    ranked,
  }
}

/**
 * ۳) انتخاب «سؤال بعدی» برای باریک‌سازی تعاملی وقتی نتایج بیش از ۲۴ مورد است
 */
function nextQuestion(
  ranked = [],
  dists = {},
  applied = [],
  total = 0,
  { minResults = 24, minCov = 0.8, maxValues = 6 } = {},
) {
  if (total <= minResults) return null
  const appliedSet = applied instanceof Set ? applied : new Set(applied || [])
  const candidate = ranked.find((r) => !appliedSet.has(r.attr) && r.cov >= minCov && r.k <= maxValues)
  if (!candidate) return null

  const rawDist = dists instanceof Map ? dists.get(candidate.attr) : dists[candidate.attr]
  const dist = toDistMap(rawDist)
  if (!dist.size) return null

  let sum = 0
  let sq = 0
  for (const n of dist.values()) {
    sum += n
    sq += n * n
  }
  if (sum <= 0) return null

  return {
    attr: candidate.attr,
    expectedRemaining: sq / sum,
    options: [...dist.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => (b.count - a.count) || String(a.key).localeCompare(String(b.key))),
  }
}

/**
 * ۴) پیشنهادهای بازیابی نتیجه‌ی صفر (حداکثر ۳ فیلتر که حذفشان بیشترین نتیجه را برمی‌گرداند)
 */
function relaxations(activeAttrs = [], countWithout) {
  if (typeof countWithout !== 'function') return []
  return [...activeAttrs]
    .map((attr) => ({ remove: attr, total: Number(countWithout(attr)) || 0 }))
    .filter((r) => r.total > 0)
    .sort((a, b) => (b.total - a.total) || String(a.remove).localeCompare(String(b.remove)))
    .slice(0, 3)
}

/**
 * ساخت ۵ بازه‌ی هم‌پهنا برای ویژگی‌های عددی پیوسته در سطح دسته
 */
function buildEqualWidthBins(numbers = [], binCount = 5) {
  const valid = numbers.map(Number).filter((n) => Number.isFinite(n))
  if (!valid.length) return []
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  if (min === max) return [min, max]
  const step = (max - min) / binCount
  const edges = [min]
  for (let i = 1; i < binCount; i += 1) {
    edges.push(Number((min + step * i).toFixed(6)))
  }
  edges.push(max)
  return edges
}

function binNumericValue(value, edges = []) {
  const n = Number(value)
  if (!Number.isFinite(n) || !Array.isArray(edges) || edges.length < 2) return null
  if (edges.length === 2 && edges[0] === edges[1]) return `${edges[0]}`
  const lastIdx = edges.length - 2
  for (let i = 0; i <= lastIdx; i += 1) {
    const lo = edges[i]
    const hi = edges[i + 1]
    const inBin = i === lastIdx ? (n >= lo && n <= hi) : (n >= lo && n < hi)
    if (inBin) return `bin_${i}:${lo}..${hi}`
  }
  if (n < edges[0]) return `bin_0:${edges[0]}..${edges[1]}`
  return `bin_${lastIdx}:${edges[lastIdx]}..${edges[lastIdx + 1]}`
}

/**
 * استخراج مقدارهای یک ویژگی از رکورد محصول (برای خلاصه‌سازی مرجع و محاسبه‌ی آفلاین NMI)
 */
function extractProductAttrValues(product, field, binsByAttr = {}) {
  if (!product || !field || !field.attr) return []
  const attr = field.attr
  let raw = product.specs && typeof product.specs === 'object' && !Array.isArray(product.specs)
    ? product.specs[attr]
    : undefined

  if (raw === undefined && Array.isArray(product.specs)) {
    const entry = product.specs.find((s) => s && s.attr === attr)
    if (entry) {
      if (Array.isArray(entry.keys) && entry.keys.length) raw = entry.keys
      else if (entry.key !== undefined && entry.key !== null) raw = entry.key
      else if (typeof entry.bool === 'boolean') raw = entry.bool ? '1' : '0'
      else if (typeof entry.num === 'number') raw = entry.num
    }
  }

  if (raw === undefined) raw = product[attr]
  if (raw === undefined || raw === null || raw === '') return []

  const edges = field.bins || binsByAttr[attr]
  if (Array.isArray(raw)) {
    return raw
      .filter((v) => v !== undefined && v !== null && v !== '')
      .map((v) => (edges && typeof v === 'number' ? binNumericValue(v, edges) : String(v)))
      .filter(Boolean)
  }
  if (typeof raw === 'boolean') {
    return [raw ? '1' : '0']
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return []
    if (edges && edges.length >= 2 && field.discrete !== true) {
      const binned = binNumericValue(raw, edges)
      return binned ? [binned] : []
    }
    return [String(raw)]
  }
  return [String(raw)]
}

/**
 * خلاصه‌سازی شمارش‌ها و پوشش ویژگی‌ها مستقیماً از روی آرایه‌ی محصولات
 * (مرجع اعتبارسنجی هم‌ارزی شمارش مبتنی بر موتور با پیاده‌سازی مرجع آرایه‌ی محصول)
 */
function summarizeProducts(products = [], fields = [], { binsByAttr = {} } = {}) {
  const dists = {}
  const covered = {}
  const computedBins = { ...binsByAttr }

  for (const f of fields) {
    if (!f || !f.attr) continue
    if (!computedBins[f.attr] && f.type === 'number' && f.discrete !== true) {
      const nums = []
      for (const p of products) {
        const v = (p.specs && !Array.isArray(p.specs) ? p.specs[f.attr] : p[f.attr])
        if (typeof v === 'number' && Number.isFinite(v)) nums.push(v)
      }
      if (nums.length) computedBins[f.attr] = buildEqualWidthBins(nums, 5)
    }
    dists[f.attr] = new Map()
    covered[f.attr] = 0
  }

  for (const product of products) {
    for (const f of fields) {
      if (!f || !f.attr) continue
      const vals = [...new Set(extractProductAttrValues(product, f, computedBins))]
      if (!vals.length) continue
      covered[f.attr] += 1
      const dist = dists[f.attr]
      for (const v of vals) {
        dist.set(v, (dist.get(v) || 0) + 1)
      }
    }
  }

  return {
    dists,
    covered,
    total: products.length,
    bins: computedBins,
  }
}

/**
 * اجرای مرجع برنامه‌ریز مستقیماً روی آرایه‌ی محصولات
 */
function planFacetsFromProducts(products = [], fields = [], options = {}) {
  const summary = summarizeProducts(products, fields, { binsByAttr: options.binsByAttr })
  return planFacets({
    ...options,
    fields,
    dists: summary.dists,
    covered: summary.covered,
    total: summary.total,
  })
}

/**
 * محاسبه‌ی اطلاعات متقابل نرمال‌شده (Symmetric NMI) بین دو ویژگی روی محصولات دسته
 * فقط برای محاسبه‌ی آفلاین در `FacetPlan.redundancy` استفاده می‌شود (نه در هر درخواست کوچک).
 */
function computeNMI(products = [], fieldA, fieldB, { binsByAttr = {} } = {}) {
  const fA = typeof fieldA === 'string' ? { attr: fieldA } : fieldA
  const fB = typeof fieldB === 'string' ? { attr: fieldB } : fieldB

  const countA = new Map()
  const countB = new Map()
  const joint = new Map()
  let n = 0

  for (const p of products) {
    const valsA = extractProductAttrValues(p, fA, binsByAttr)
    const valsB = extractProductAttrValues(p, fB, binsByAttr)
    if (!valsA.length || !valsB.length) continue
    const a = valsA.length === 1 ? valsA[0] : [...valsA].sort().join(',')
    const b = valsB.length === 1 ? valsB[0] : [...valsB].sort().join(',')
    n += 1
    countA.set(a, (countA.get(a) || 0) + 1)
    countB.set(b, (countB.get(b) || 0) + 1)
    const jk = `${a}\u0000${b}`
    joint.set(jk, (joint.get(jk) || 0) + 1)
  }

  if (n < 2 || countA.size < 2 || countB.size < 2) return 0

  const entropy = (counts) => {
    let h = 0
    for (const c of counts.values()) {
      const prob = c / n
      if (prob > 0) h -= prob * Math.log(prob)
    }
    return h
  }

  const hA = entropy(countA)
  const hB = entropy(countB)
  if (hA + hB <= 0) return 0

  let mi = 0
  for (const [jk, cAB] of joint.entries()) {
    const sep = jk.indexOf('\u0000')
    const a = jk.slice(0, sep)
    const b = jk.slice(sep + 1)
    const pAB = cAB / n
    const pA = countA.get(a) / n
    const pB = countB.get(b) / n
    if (pAB > 0 && pA > 0 && pB > 0) {
      mi += pAB * Math.log(pAB / (pA * pB))
    }
  }

  return Math.max(0, Math.min(1, (2 * mi) / (hA + hB)))
}

/**
 * ساخت ماتریس افزونگی آفلاین برای ذخیره‌سازی در `FacetPlan.redundancy`
 */
function computeRedundancyMatrix(products = [], fields = [], { binsByAttr = {}, minNmi = 0.05 } = {}) {
  const summary = summarizeProducts(products, fields, { binsByAttr })
  const activeFields = fields.filter(
    (f) => f && f.attr && f.importance !== 'hidden' && (!f.roles || f.roles.filter !== false),
  )
  const pairs = []
  const map = Object.create(null)

  for (let i = 0; i < activeFields.length; i += 1) {
    for (let j = i + 1; j < activeFields.length; j += 1) {
      const fA = activeFields[i]
      const fB = activeFields[j]
      const nmi = computeNMI(products, fA, fB, { binsByAttr: summary.bins })
      if (nmi >= minNmi) {
        const [a, b] = fA.attr < fB.attr ? [fA.attr, fB.attr] : [fB.attr, fA.attr]
        const rounded = Number(nmi.toFixed(4))
        pairs.push({ a, b, nmi: rounded })
        map[`${a}|${b}`] = rounded
      }
    }
  }

  return { pairs, map, bins: summary.bins }
}

/**
 * محاسبه‌ی `usage(f)` از شمارنده‌های تلمتری `FacetStat` با آستانه‌ی حداقل ۲۰۰ نمایش
 */
function computeUsageFromStats(statRows = [], { minImpressions = 200 } = {}) {
  const agg = new Map()
  for (const row of statRows) {
    if (!row || !row.attr) continue
    const cur = agg.get(row.attr) || { impressions: 0, applies: 0 }
    cur.impressions += Number(row.impressions) || 0
    cur.applies += Number(row.applies) || 0
    agg.set(row.attr, cur)
  }

  let maxRate = 0
  const rates = new Map()
  for (const [attr, { impressions, applies }] of agg.entries()) {
    if (impressions < minImpressions) continue
    const rate = Math.min(1, applies / impressions)
    rates.set(attr, rate)
    if (rate > maxRate) maxRate = rate
  }

  const usage = {}
  if (maxRate <= 0) return usage
  for (const [attr, rate] of rates.entries()) {
    usage[attr] = Number((rate / maxRate).toFixed(4))
  }
  return usage
}

module.exports = {
  WEIGHT,
  MAX_UI_VALUES,
  LEAF_DEFAULTS,
  PARENT_DEFAULTS,
  toDistMap,
  scoreFacet,
  planFacets,
  nextQuestion,
  relaxations,
  buildEqualWidthBins,
  binNumericValue,
  summarizeProducts,
  planFacetsFromProducts,
  computeNMI,
  computeRedundancyMatrix,
  computeUsageFromStats,
}
