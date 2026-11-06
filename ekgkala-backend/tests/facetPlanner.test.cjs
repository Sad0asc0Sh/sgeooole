// ============================================================
// تست‌های ناوردای برنامه‌ریز خالص فست (tests/facetPlanner.test.cjs)
// پوشش کامل ۹ ناوردای طراحی + nextQuestion + relaxations + اریب NMI
// ============================================================
const assert = require('node:assert/strict')
const test = require('node:test')

const {
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
} = require('../services/facetPlanner')

// مولد اعداد شبه‌تصادفی قطعی (Mulberry32) برای تکرارپذیری ۱۰۰٪ داده‌ی مصنوعی ۵۷۰ دوربین
function createRng(seed = 20261106) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted(rng, entries) {
  const total = entries.reduce((acc, [, w]) => acc + w, 0)
  let r = rng() * total
  for (const [val, w] of entries) {
    r -= w
    if (r <= 0) return val
  }
  return entries[entries.length - 1][0]
}

/**
 * ساخت مجموعه‌داده‌ی مصنوعی ۵۷۰ دوربین در سه زیرشاخه:
 *  - ip-camera: 320 محصول
 *  - ptz-camera: 90 محصول
 *  - analog-camera: 160 محصول
 */
function buildSyntheticCatalog(seed = 42) {
  const rng = createRng(seed)
  const brands = [
    ['hikvision', 24],
    ['dahua', 22],
    ['uniview', 14],
    ['tiandy', 10],
    ['imou', 9],
    ['ezviz', 8],
    ['hilook', 7],
    ['axis', 4],
    ['brand_j', 2],
  ]

  const makeCamera = (subCategory, index) => {
    const brand = pickWeighted(rng, brands)
    const resolution_mp = pickWeighted(rng, [
      ['2', 32],
      ['4', 34],
      ['5', 14],
      ['8', 15],
      ['12', 5],
    ])
    const form = subCategory === 'ptz-camera'
      ? pickWeighted(rng, [['speed_dome', 65], ['mini_ptz', 35]])
      : pickWeighted(rng, [['bullet', 42], ['dome', 38], ['turret', 15], ['cube', 5]])
    const ir_range_m = pickWeighted(rng, [
      [20, 20],
      [30, 30],
      [40, 22],
      [50, 16],
      [80, 12],
    ])
    const lens_mm = pickWeighted(rng, [
      ['2.8', 45],
      ['3.6', 25],
      ['4', 15],
      ['2.8-12', 15],
    ])
    // برند J عمداً با ترکیب 8MP + turret + IP67 هیچ محصولی ندارد (برای آزمون نتیجه‌ی صفر)
    let ip_rating = pickWeighted(rng, [
      ['ip67', 52],
      ['ip66', 33],
      ['indoor', 15],
    ])
    if (brand === 'brand_j' && resolution_mp === '8' && form === 'turret' && ip_rating === 'ip67') {
      ip_rating = 'ip66'
    }

    const body_material = pickWeighted(rng, [
      ['metal', 48],
      ['plastic', 28],
      ['metal_plastic', 24],
    ])

    const camera = {
      id: `${subCategory}-${index}`,
      sub_category: subCategory,
      brand,
      resolution_mp,
      form,
      ir_range_m,
      lens_mm,
      ip_rating,
      body_material,
      warranty_months: pickWeighted(rng, [['12', 25], ['18', 30], ['24', 35], ['36', 10]]),
      dimensions_mm: `${110 + (index % 30)}x${90 + (index % 20)}`,
      operating_temp_c: '-30~60',
    }

    if (subCategory === 'ip-camera' || subCategory === 'ptz-camera') {
      const power = pickWeighted(rng, [['poe', 72], ['12v', 28]])
      // همبستگی ۱۰۰٪ بین power و poe (NMI = 1) برای آزمون حذف افزونگی
      camera.power = power
      camera.poe = power === 'poe' ? '1' : '0'
      camera.codec = pickWeighted(rng, [['h265_plus', 50], ['h265', 35], ['h264', 15]])
      camera.wdr = pickWeighted(rng, [['true_wdr_120db', 55], ['dwdr', 45]])
      camera.mic = pickWeighted(rng, [['1', 60], ['0', 40]])
      camera.sd_slot = pickWeighted(rng, [['1', 68], ['0', 32]])
      camera.onvif = '1' // تک‌مقداری در کل دسته
      if (Number(resolution_mp) >= 4) {
        camera.color_night = pickWeighted(rng, [['warmlight', 45], ['starlight', 35], ['ir_only', 20]])
      }
      camera.smart_features = rng() < 0.7
        ? [pickWeighted(rng, [['human_detect', 50], ['vehicle_detect', 30], ['line_crossing', 20]])]
        : ['none']
    }

    if (subCategory === 'ptz-camera') {
      // ویژگی‌های اختصاصی زیرشاخه‌ی PTZ (پوشش کل در والد = 90/570 ≈ 0.16)
      camera.optical_zoom = pickWeighted(rng, [['15x', 25], ['25x', 45], ['32x', 30]])
      camera.pan_range_deg = pickWeighted(rng, [['360_endless', 70], ['0_355', 30]])
    }

    if (subCategory === 'analog-camera') {
      camera.analog_signal = pickWeighted(rng, [['hdcvi', 40], ['hdtvi', 35], ['ahd', 25]])
      camera.power = '12v'
      camera.poe = '0'
    }

    return camera
  }

  const ipProducts = Array.from({ length: 320 }, (_, i) => makeCamera('ip-camera', i))
  // تضمین وجود حداقل ۲ محصول با 8MP + turret + IP67 در برند غیر از brand_j برای سناریوی relaxations
  ipProducts[0] = {
    ...ipProducts[0],
    brand: 'hikvision',
    resolution_mp: '8',
    form: 'turret',
    ip_rating: 'ip67',
  }
  ipProducts[1] = {
    ...ipProducts[1],
    brand: 'dahua',
    resolution_mp: '8',
    form: 'turret',
    ip_rating: 'ip67',
  }

  const ptzProducts = Array.from({ length: 90 }, (_, i) => makeCamera('ptz-camera', i))
  const analogProducts = Array.from({ length: 160 }, (_, i) => makeCamera('analog-camera', i))

  return {
    ipProducts,
    ptzProducts,
    analogProducts,
    allProducts: [...ipProducts, ...ptzProducts, ...analogProducts],
  }
}

const IP_TEMPLATE_FIELDS = [
  { attr: 'brand', group: 'quick', importance: 'pin', roles: { table: true, filter: true } },
  { attr: 'resolution_mp', group: 'image', importance: 'high', discrete: true, roles: { table: true, filter: true } },
  { attr: 'form', group: 'body', importance: 'high', roles: { table: true, filter: true } },
  { attr: 'ir_range_m', group: 'image', type: 'number', importance: 'high', roles: { table: true, filter: true } },
  { attr: 'lens_mm', group: 'image', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'ip_rating', group: 'body', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'power', group: 'power', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'poe', group: 'power', importance: 'low', roles: { table: true, filter: true } },
  { attr: 'codec', group: 'image', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'wdr', group: 'image', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'mic', group: 'audio', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'sd_slot', group: 'storage', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'color_night', group: 'image', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'smart_features', group: 'smart', importance: 'low', roles: { table: true, filter: true } },
  { attr: 'body_material', group: 'body', importance: 'low', roles: { table: true, filter: true } },
  { attr: 'warranty_months', group: 'general', importance: 'low', roles: { table: true, filter: true } },
  { attr: 'onvif', group: 'network', importance: 'low', roles: { table: true, filter: true } },
  { attr: 'dimensions_mm', group: 'physical', importance: 'hidden', roles: { table: true, filter: false } },
  { attr: 'operating_temp_c', group: 'physical', importance: 'normal', roles: { table: true, filter: false } },
]

const PARENT_UNION_FIELDS = [
  { attr: 'sub_category', group: 'nav', importance: 'pin', roles: { table: false, filter: true } },
  ...IP_TEMPLATE_FIELDS,
  { attr: 'optical_zoom', group: 'ptz', importance: 'high', roles: { table: true, filter: true } },
  { attr: 'pan_range_deg', group: 'ptz', importance: 'normal', roles: { table: true, filter: true } },
  { attr: 'analog_signal', group: 'signal', importance: 'high', roles: { table: true, filter: true } },
]

// ------------------------------------------------------------
// ناوردای ۱: هیچ فیلتر «فقط جدول» در برنامه نیست
// ------------------------------------------------------------
test('Invariant 1: table-only fields (importance=hidden or roles.filter=false) never appear in plan', () => {
  const { ipProducts } = buildSyntheticCatalog()
  const { map: redundancy, bins } = computeRedundancyMatrix(ipProducts, IP_TEMPLATE_FIELDS)
  const plan = planFacetsFromProducts(ipProducts, IP_TEMPLATE_FIELDS, { redundancy, binsByAttr: bins })

  for (const tableOnlyAttr of ['dimensions_mm', 'operating_temp_c']) {
    assert.equal(plan.open.includes(tableOnlyAttr), false)
    assert.equal(plan.visible.includes(tableOnlyAttr), false)
    assert.equal(plan.more.includes(tableOnlyAttr), false)
    assert.equal(plan.ranked.some((r) => r.attr === tableOnlyAttr), false)
    assert.equal(plan.dropped[tableOnlyAttr], 'table-only')
  }
  assert.ok(plan.visible.length <= 10)
  assert.ok(plan.open.length <= 5)
})

// ------------------------------------------------------------
// ناوردای ۲: برند (pin) اول است و سنجاق‌شده‌ها به ترتیب قالب‌اند نه به ترتیب امتیاز
// ------------------------------------------------------------
test('Invariant 2: pinned fields always appear first and strictly preserve template order regardless of raw score', () => {
  const fields = [
    // فیلد pin اول با پوشش کمتر و توزیع نامتوازن‌تر (امتیاز خام پایین‌تر)
    { attr: 'product_type', group: 'quick', importance: 'pin', roles: { table: true, filter: true } },
    // فیلد pin دوم با پوشش ۱۰۰٪ و توزیع کاملاً متوازن (امتیاز خام بسیار بالاتر)
    { attr: 'brand', group: 'quick', importance: 'pin', roles: { table: true, filter: true } },
    // فیلد high با امتیاز بالا
    { attr: 'resolution_mp', group: 'image', importance: 'high', roles: { table: true, filter: true } },
  ]
  const dists = {
    product_type: new Map([['dome', 90], ['bullet', 10]]),
    brand: new Map([['hikvision', 25], ['dahua', 25], ['uniview', 25], ['tiandy', 25]]),
    resolution_mp: new Map([['2', 34], ['4', 33], ['8', 33]]),
  }
  const covered = { product_type: 40, brand: 100, resolution_mp: 100 }

  // امتیاز خام brand و resolution_mp از product_type بزرگ‌تر است، اما ترتیب قالب باید حفظ شود
  const rawType = scoreFacet(fields[0], dists.product_type, 40, 100)
  const rawBrand = scoreFacet(fields[1], dists.brand, 100, 100)
  assert.ok(rawBrand.score > rawType.score)

  const plan = planFacets({ fields, dists, covered, total: 100 })
  assert.deepEqual(plan.visible.slice(0, 2), ['product_type', 'brand'])
  assert.equal(plan.open[0], 'product_type')
  assert.equal(plan.open[1], 'brand')
})

// ------------------------------------------------------------
// ناوردای ۳: دو فیلتر افزونه هر دو فعال نیستند
// ------------------------------------------------------------
test('Invariant 3: redundant facets (NMI >= 0.85) are never both active; higher-scored facet wins', () => {
  const { ipProducts } = buildSyntheticCatalog()
  const { map: redundancy, pairs, bins } = computeRedundancyMatrix(ipProducts, IP_TEMPLATE_FIELDS)

  const nmiPowerPoe = computeNMI(ipProducts, 'power', 'poe')
  assert.ok(nmiPowerPoe >= 0.99, `expected NMI(power, poe) ~ 1, got ${nmiPowerPoe}`)

  const plan = planFacetsFromProducts(ipProducts, IP_TEMPLATE_FIELDS, { redundancy, binsByAttr: bins })
  const allActive = [...plan.visible, ...plan.more]
  assert.equal(allActive.includes('power') && allActive.includes('poe'), false)
  assert.equal(allActive.includes('power'), true)
  assert.equal(allActive.includes('poe'), false)
  assert.equal(plan.dropped.poe, 'redundant-with:power')

  // پشتیبانی همزمان از فرمت آرایه‌ی مدل FacetPlan.redundancy ([{ a, b, nmi }])
  const planFromPairs = planFacetsFromProducts(ipProducts, IP_TEMPLATE_FIELDS, { redundancy: pairs, binsByAttr: bins })
  assert.deepEqual(planFromPairs.visible, plan.visible)
  assert.equal(planFromPairs.dropped.poe, 'redundant-with:power')
})

// ------------------------------------------------------------
// ناوردای ۴: پس از اعمال فیلتر، فیلتر تک‌مقداری نمایش داده نمی‌شود
// ------------------------------------------------------------
test('Invariant 4: single-value facets disappear after filtering (including zero-count sibling buckets)', () => {
  const { ipProducts } = buildSyntheticCatalog()
  const { map: redundancy, bins } = computeRedundancyMatrix(ipProducts, IP_TEMPLATE_FIELDS)

  const filtered8Mp = ipProducts.filter((p) => p.resolution_mp === '8')
  assert.ok(filtered8Mp.length > 20)

  const summary = summarizeProducts(filtered8Mp, IP_TEMPLATE_FIELDS, { binsByAttr: bins })
  // حتی اگر در ورودی، گزینه‌های خواهر با شمارش ۰ هم وجود داشته باشند، فقط ۱ مقدار زنده هست
  summary.dists.resolution_mp.set('2', 0)
  summary.dists.resolution_mp.set('4', 0)

  const plan = planFacets({
    fields: IP_TEMPLATE_FIELDS,
    dists: summary.dists,
    covered: summary.covered,
    total: summary.total,
    redundancy,
  })

  assert.equal(plan.visible.includes('resolution_mp'), false)
  assert.equal(plan.more.includes('resolution_mp'), false)
  assert.equal(plan.dropped.resolution_mp, 'single-value')
  // ویژگی تک‌مقداری ذاتی (onvif = '1' در کل دسته) نیز حذف می‌شود
  assert.equal(plan.dropped.onvif, 'single-value')
})

// ------------------------------------------------------------
// ناوردای ۵: در گرهِ غیربرگ فیلتر مختص یک زیرشاخه ظاهر نمی‌شود و فیلتر مشترک ظاهر می‌شود
// ------------------------------------------------------------
test('Invariant 5: non-leaf parent node suppresses child-only facets and keeps shared facets within budget=8', () => {
  const { allProducts } = buildSyntheticCatalog()
  const { map: redundancy, bins } = computeRedundancyMatrix(allProducts, PARENT_UNION_FIELDS)

  const parentPlan = planFacetsFromProducts(allProducts, PARENT_UNION_FIELDS, {
    isLeaf: false, // minCov = 0.80, budget = 8
    redundancy,
    binsByAttr: bins,
  })

  // بودجه‌ی گره والد حداکثر ۸ فیلتر است
  assert.ok(parentPlan.visible.length <= 8)

  // فیلترهای مختص زیرشاخه‌ی PTZ یا Analog به والد نشت نمی‌کنند
  for (const childSpecific of ['optical_zoom', 'pan_range_deg', 'analog_signal']) {
    assert.equal(parentPlan.visible.includes(childSpecific), false)
    assert.equal(parentPlan.more.includes(childSpecific), false)
    assert.match(String(parentPlan.dropped[childSpecific]), /^low-coverage /)
  }

  // فیلترهای مشترک با پوشش بالا در والد حضور دارند
  for (const sharedAttr of ['brand', 'resolution_mp', 'form', 'ir_range_m', 'ip_rating']) {
    assert.equal(parentPlan.visible.includes(sharedAttr), true, `expected shared facet ${sharedAttr} in parent visible`)
  }
})

// ------------------------------------------------------------
// ناوردای ۶: زیردسته در گرهِ والد سنجاق و اول است
// ------------------------------------------------------------
test('Invariant 6: child category facet (sub_category) is pinned and ranked first in parent node', () => {
  const { allProducts } = buildSyntheticCatalog()
  const { map: redundancy, bins } = computeRedundancyMatrix(allProducts, PARENT_UNION_FIELDS)

  const parentPlan = planFacetsFromProducts(allProducts, PARENT_UNION_FIELDS, {
    isLeaf: false,
    redundancy,
    binsByAttr: bins,
  })

  assert.equal(parentPlan.visible[0], 'sub_category')
  assert.equal(parentPlan.open[0], 'sub_category')
  assert.equal(parentPlan.visible[1], 'brand')
})

// ------------------------------------------------------------
// ناوردای ۷: برنامه‌ریز قطعی است — دو اجرای یکسان خروجی یکسان می‌دهد
// ------------------------------------------------------------
test('Invariant 7: planner is deterministic across repeated runs and shuffled distribution map insertion order', () => {
  const { ipProducts } = buildSyntheticCatalog()
  const { map: redundancy, bins } = computeRedundancyMatrix(ipProducts, IP_TEMPLATE_FIELDS)
  const summary = summarizeProducts(ipProducts, IP_TEMPLATE_FIELDS, { binsByAttr: bins })

  const runA = planFacets({
    fields: IP_TEMPLATE_FIELDS,
    dists: summary.dists,
    covered: summary.covered,
    total: summary.total,
    redundancy,
  })

  // برعکس کردن ترتیب کلیدهای داخل هر Map برای اطمینان از عدم وابستگی به ترتیب درج کلیدها
  const reversedDists = {}
  for (const [attr, map] of Object.entries(summary.dists)) {
    reversedDists[attr] = new Map([...map.entries()].reverse())
  }

  const runB = planFacets({
    fields: IP_TEMPLATE_FIELDS,
    dists: reversedDists,
    covered: summary.covered,
    total: summary.total,
    redundancy,
  })

  assert.deepEqual(runA.open, runB.open)
  assert.deepEqual(runA.visible, runB.visible)
  assert.deepEqual(runA.more, runB.more)
  assert.deepEqual(runA.dropped, runB.dropped)
  assert.deepEqual(runA.groups, runB.groups)
})

// ------------------------------------------------------------
// ناوردای ۸: با بالارفتن usage امتیاز یک فیلتر کم نمی‌شود
// ------------------------------------------------------------
test('Invariant 8: facet score is monotonically non-decreasing with usage telemetry', () => {
  const field = { attr: 'ir_range_m', importance: 'normal', roles: { filter: true } }
  const dist = new Map([['20', 40], ['30', 80], ['40', 60], ['50', 20]])
  const steps = [0, 0.05, 0.2, 0.5, 0.75, 0.9, 1.0]

  let prevScore = -Infinity
  for (const u of steps) {
    const res = scoreFacet(field, dist, 200, 220, { ir_range_m: u })
    assert.ok(res.score >= prevScore, `score decreased at usage=${u}: ${res.score} < ${prevScore}`)
    prevScore = res.score
  }

  // بررسی آستانه‌ی ۲۰۰ نمایش در computeUsageFromStats برای جلوگیری از نویز نمونه‌ی کوچک
  const usage = computeUsageFromStats([
    { attr: 'rare_attr', impressions: 50, applies: 45 }, // زیر ۲۰۰ نمایش ← نادیده گرفته می‌شود
    { attr: 'ir_range_m', impressions: 400, applies: 80 }, // 0.20
    { attr: 'resolution_mp', impressions: 500, applies: 200 }, // 0.40 (max)
  ])
  assert.equal(usage.rare_attr, undefined)
  assert.equal(usage.resolution_mp, 1)
  assert.equal(usage.ir_range_m, 0.5)
})

// ------------------------------------------------------------
// ناوردای ۹: خروجی کد مبتنی بر شمارش با خروجی نمونه‌ی مرجع مبتنی بر آرایه‌ی محصول یکی است
// ------------------------------------------------------------
test('Invariant 9: count-based planner matches independent product-array reference implementation identically', () => {
  const { ipProducts, allProducts } = buildSyntheticCatalog(99)

  // پیاده‌سازی مرجع مستقل مبتنی بر پیمایش مستقیم آرایه‌ی محصولات (بدون استفاده از summarizeProducts داخلی)
  function referencePlanFromProductArray(products, fields, { redundancy = {}, minCov = 0.25, budget = 10, openN = 5, redSkip = 0.85 } = {}) {
    const binsByAttr = {}
    for (const f of fields) {
      if (f.type === 'number' && !f.discrete) {
        const vals = products.map((p) => p[f.attr]).filter((v) => typeof v === 'number')
        binsByAttr[f.attr] = buildEqualWidthBins(vals, 5)
      }
    }

    const dropped = {}
    const pool = []
    const total = products.length

    fields.forEach((f, idx) => {
      if (f.importance === 'hidden' || (f.roles && f.roles.filter === false)) {
        dropped[f.attr] = 'table-only'
        return
      }
      const counts = new Map()
      let covCount = 0
      for (const p of products) {
        const raw = p[f.attr]
        if (raw === undefined || raw === null || raw === '') continue
        const values = Array.isArray(raw)
          ? raw.map(String)
          : (f.type === 'number' && !f.discrete ? [binNumericValue(raw, binsByAttr[f.attr])] : [String(raw)])
        const uniq = [...new Set(values.filter(Boolean))]
        if (!uniq.length) continue
        covCount += 1
        for (const v of uniq) counts.set(v, (counts.get(v) || 0) + 1)
      }
      if (counts.size === 0) {
        dropped[f.attr] = 'no-data'
        return
      }
      if (counts.size < 2) {
        dropped[f.attr] = 'single-value'
        return
      }
      let sum = 0
      let sq = 0
      for (const c of counts.values()) {
        sum += c
        sq += c * c
      }
      const cov = covCount / total
      if (cov < minCov && f.importance !== 'pin') {
        dropped[f.attr] = `low-coverage ${cov.toFixed(2)}`
        return
      }
      const impurity = 1 - sq / (sum * sum)
      const ui = counts.size <= 12 ? 1 : 12 / counts.size
      const w = ({ high: 1.5, normal: 1, low: 0.6 })[f.importance] || 1
      pool.push({ ...f, idx, k: counts.size, cov, impurity, score: cov * impurity * ui * w })
    })

    const redOf = (a, b) => redundancy[a < b ? `${a}|${b}` : `${b}|${a}`] || 0
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
        c.sel = c.importance === 'pin' ? 1e6 - c.idx : c.adj
        if (!best || c.sel > best.sel) best = c
      }
      pool.splice(pool.indexOf(best), 1)
      if (best.importance !== 'pin' && best.red >= redSkip) {
        dropped[best.attr] = `redundant-with:${best.redWith}`
        continue
      }
      ranked.push(best)
    }

    const visible = ranked.slice(0, budget)
    const byGroup = new Map()
    for (const c of visible) {
      if (!byGroup.has(c.group)) byGroup.set(c.group, [])
      byGroup.get(c.group).push(c)
    }
    const groups = [...byGroup]
      .map(([key, list]) => ({ key, attrs: list.map((c) => c.attr), top: Math.max(...list.map((c) => c.adj)) }))
      .sort((a, b) => b.top - a.top)

    return {
      open: visible.slice(0, openN).map((c) => c.attr),
      visible: visible.map((c) => c.attr),
      more: ranked.slice(budget).map((c) => c.attr),
      dropped,
      groups,
    }
  }

  // ۱. همسانی روی دسته‌ی برگ (۳۲۰ دوربین IP)
  const { map: leafRed, bins: leafBins } = computeRedundancyMatrix(ipProducts, IP_TEMPLATE_FIELDS)
  const leafCounts = summarizeProducts(ipProducts, IP_TEMPLATE_FIELDS, { binsByAttr: leafBins })
  const countBasedLeaf = planFacets({
    fields: IP_TEMPLATE_FIELDS,
    dists: leafCounts.dists,
    covered: leafCounts.covered,
    total: leafCounts.total,
    redundancy: leafRed,
  })
  const refLeaf = referencePlanFromProductArray(ipProducts, IP_TEMPLATE_FIELDS, { redundancy: leafRed })

  assert.deepEqual(countBasedLeaf.open, refLeaf.open)
  assert.deepEqual(countBasedLeaf.visible, refLeaf.visible)
  assert.deepEqual(countBasedLeaf.more, refLeaf.more)
  assert.deepEqual(countBasedLeaf.dropped, refLeaf.dropped)
  assert.deepEqual(countBasedLeaf.groups, refLeaf.groups)

  // ۲. همسانی روی گره والد (۵۷۰ دوربین در ۳ زیرشاخه)
  const { map: parentRed, bins: parentBins } = computeRedundancyMatrix(allProducts, PARENT_UNION_FIELDS)
  const parentCounts = summarizeProducts(allProducts, PARENT_UNION_FIELDS, { binsByAttr: parentBins })
  const countBasedParent = planFacets({
    fields: PARENT_UNION_FIELDS,
    dists: parentCounts.dists,
    covered: parentCounts.covered,
    total: parentCounts.total,
    redundancy: parentRed,
    minCov: 0.8,
    budget: 8,
  })
  const refParent = referencePlanFromProductArray(allProducts, PARENT_UNION_FIELDS, {
    redundancy: parentRed,
    minCov: 0.8,
    budget: 8,
  })

  assert.deepEqual(countBasedParent.open, refParent.open)
  assert.deepEqual(countBasedParent.visible, refParent.visible)
  assert.deepEqual(countBasedParent.more, refParent.more)
  assert.deepEqual(countBasedParent.dropped, refParent.dropped)
  assert.deepEqual(countBasedParent.groups, refParent.groups)
})

// ------------------------------------------------------------
// آزمون‌های تکمیلی: nextQuestion، relaxations، dependsOn و اریب نمونه‌ی کوچک NMI
// ------------------------------------------------------------
test('nextQuestion, zero-result relaxations, dependsOn gating, and small-sample NMI bias check', () => {
  const { ipProducts } = buildSyntheticCatalog()
  const { map: redundancy, bins } = computeRedundancyMatrix(ipProducts, IP_TEMPLATE_FIELDS)

  // ۱. nextQuestion پس از انتخاب 4MP + dome (بیش از ۲۴ نتیجه)
  const sub4MpDome = ipProducts.filter((p) => p.resolution_mp === '4' && p.form === 'dome')
  assert.ok(sub4MpDome.length > 24)
  const summarySub = summarizeProducts(sub4MpDome, IP_TEMPLATE_FIELDS, { binsByAttr: bins })
  const planSub = planFacets({
    fields: IP_TEMPLATE_FIELDS,
    dists: summarySub.dists,
    covered: summarySub.covered,
    total: summarySub.total,
    redundancy,
  })
  const q = nextQuestion(planSub.ranked, summarySub.dists, ['resolution_mp', 'form'], summarySub.total)
  assert.ok(q !== null)
  assert.ok(!['resolution_mp', 'form'].includes(q.attr))
  assert.ok(q.options.length >= 2 && q.options.length <= 6)
  assert.ok(q.expectedRemaining > 0 && q.expectedRemaining < summarySub.total)

  // زیر ۲۴ نتیجه، کارت سؤال بعدی نمایش داده نمی‌شود
  assert.equal(nextQuestion(planSub.ranked, summarySub.dists, [], 24), null)

  // ۲. بازیابی نتیجه‌ی صفر (8MP + turret + IP67 + brand_j => 0 نتیجه؛ حذف brand => >=2 نتیجه)
  const activeFilters = {
    resolution_mp: '8',
    form: 'turret',
    ip_rating: 'ip67',
    brand: 'brand_j',
  }
  const matchAll = ipProducts.filter((p) =>
    Object.entries(activeFilters).every(([k, v]) => p[k] === v),
  )
  assert.equal(matchAll.length, 0)

  const countWithout = (removedAttr) => ipProducts.filter((p) =>
    Object.entries(activeFilters).every(([k, v]) => k === removedAttr || p[k] === v),
  ).length

  const suggestions = relaxations(Object.keys(activeFilters), countWithout)
  assert.ok(suggestions.length >= 1 && suggestions.length <= 3)
  assert.equal(suggestions[0].remove, 'brand')
  assert.ok(suggestions[0].total >= 2)

  // ۳. گیت dependsOn: فیلد وابسته تا پیش از انتخاب والدش وارد برنامه نمی‌شود
  const depFields = [
    { attr: 'brand', group: 'quick', importance: 'pin', roles: { filter: true } },
    { attr: 'series', group: 'quick', importance: 'high', dependsOn: 'brand', roles: { filter: true } },
  ]
  const depDists = {
    brand: new Map([['hikvision', 30], ['dahua', 30]]),
    series: new Map([['pro', 30], ['lite', 30]]),
  }
  const depCovered = { brand: 60, series: 60 }
  const beforeBrand = planFacets({ fields: depFields, dists: depDists, covered: depCovered, total: 60, applied: [] })
  assert.equal(beforeBrand.visible.includes('series'), false)
  assert.equal(beforeBrand.dropped.series, 'depends-on:brand')

  const afterBrand = planFacets({ fields: depFields, dists: depDists, covered: depCovered, total: 60, applied: ['brand'] })
  assert.equal(afterBrand.visible.includes('series'), true)

  // ۴. اثبات اریب نمونه‌ی کوچک NMI (دلیل کش آفلاین در FacetPlan.redundancy)
  const fullNmi = computeNMI(ipProducts, 'brand', { attr: 'ir_range_m', type: 'number', bins: bins.ir_range_m })
  const rng = createRng(777)
  let sampleNmiSum = 0
  const trials = 100
  for (let t = 0; t < trials; t += 1) {
    const sample = []
    for (let k = 0; k < 47; k += 1) {
      sample.push(ipProducts[Math.floor(rng() * ipProducts.length)])
    }
    sampleNmiSum += computeNMI(sample, 'brand', { attr: 'ir_range_m', type: 'number', bins: bins.ir_range_m })
  }
  const meanSmallSampleNmi = sampleNmiSum / trials
  assert.ok(fullNmi < 0.08, `expected full-catalog NMI < 0.08, got ${fullNmi}`)
  assert.ok(meanSmallSampleNmi > fullNmi * 2.5, `expected upward bias on n=47 (${meanSmallSampleNmi} vs ${fullNmi})`)
})
