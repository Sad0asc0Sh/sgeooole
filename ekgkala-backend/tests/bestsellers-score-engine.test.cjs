/**
 * Offline regression tests for the bestsellers score engine logic.
 *
 * Run: node --test tests/bestsellers-score-engine.test.cjs
 *
 * Covers the defects that made the «پرفروش‌ترین‌ها» rail static/wrong:
 *  - RatingScore aggregated Review by the wrong field ($product_id instead
 *    of $product), so it was always 0.
 *  - RevenueScore multiplied revenue by margin_pct, which is always recorded
 *    as 0, so it was always 0.
 *  - DecayedScore divided by (hours + 2)^1.8, crushing the score to ~1e-6 so
 *    ranking was decided by the hour of the last sale, not by sales volume.
 *  - total_units_sold counted sale EVENTS, not units.
 *  - One failing product aborted the whole recalculation, freezing the rest.
 * Mongoose models are stubbed through the require cache (no DB needed),
 * mirroring the style of bestsellers-product-code.test.cjs.
 */
const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')

const backendRoot = path.join(__dirname, '..')
const NOW = new Date('2026-10-10T00:00:00Z')

// ---------- captured state ----------
const savedScores = {}
const captured = { ratingPipeline: null, revenuePipeline: null }
let productFindCalls = 0

// ---------- model stubs ----------
const salesEventStub = {
  aggregate: async (pipeline) => {
    const s = JSON.stringify(pipeline)
    if (s.includes('weighted_sales')) return [{ _id: 'A', total_quantity: 7, weighted_sales: 7 }]
    if (s.includes('sale_count')) return []
    if (s.includes('total_revenue')) {
      captured.revenuePipeline = pipeline
      return [
        { _id: 'A', total_revenue: 1000 },
        { _id: 'B', total_revenue: 500 },
      ]
    }
    if (s.includes('this_week_sales')) return []
    if (s.includes('last_sale_at')) return [{ _id: 'A', last_sale_at: NOW }]
    if (s.includes('"units"')) return [{ _id: 'A', units: 7, revenue: 7000 }]
    return []
  },
}

const productViewStub = {
  aggregate: async (pipeline) => {
    const s = JSON.stringify(pipeline)
    if (s.includes('view_count')) return []
    if (s.includes('"views"')) return [{ _id: 'A', views: 42 }]
    return []
  },
}

const reviewStub = {
  aggregate: async (pipeline) => {
    captured.ratingPipeline = pipeline
    return [
      { _id: 'A', weighted_rating: 2 },
      { _id: 'B', weighted_rating: 3 },
    ]
  },
}

const productStub = {
  find: async () => {
    productFindCalls++
    const old = new Date('2025-01-01T00:00:00Z')
    return [
      { _id: 'A', name: 'Seller', rating: 4.5, createdAt: old, stock: 5 },
      { _id: 'C', name: 'Broken', rating: 0, createdAt: old, stock: 1 },
      { _id: 'B', name: 'NeverSoldButRated', rating: 5, createdAt: old, stock: 3 },
    ]
  },
}

const productScoreStub = {
  findOneAndUpdate: async (query, update) => {
    if (query.product_id === 'C') throw new Error('boom: bad product')
    savedScores[query.product_id] = update
    return update
  },
}

function stubModule(relPath, exportsObj) {
  const resolved = require.resolve(path.join(backendRoot, relPath))
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj }
}

stubModule('models/ProductScore.js', productScoreStub)
stubModule('models/SalesEvent.js', salesEventStub)
stubModule('models/ProductView.js', productViewStub)
stubModule('models/Product.js', productStub)
stubModule('models/Review.js', reviewStub)

const engine = require(path.join(backendRoot, 'services/bestsellersScoreEngine.js'))

// ---------- component pipelines ----------

test('rating score aggregates Review by its real field "product"', async () => {
  const scores = await engine.calculateRatingScore()
  assert.equal(captured.ratingPipeline[0].$group._id, '$product')
  assert.ok(scores.B > 0, 'rated product must get a rating score')
  assert.equal(scores.B, 1) // highest weighted rating normalizes to 1
})

test('revenue score uses revenue itself (margin_pct is always 0 in the data)', async () => {
  const scores = await engine.calculateRevenueScore()
  assert.ok(!JSON.stringify(captured.revenuePipeline).includes('margin'), 'pipeline must not use margin')
  assert.equal(scores.A, 1)
  assert.equal(scores.B, 0.5)
})

// ---------- recency / decayed score ----------

test('decayed score: bounded recency factor, never-sold always last', () => {
  const day = 24 * 60 * 60 * 1000
  assert.equal(engine.computeDecayedScore(0.6, NOW, NOW), 0.6) // sold today
  assert.equal(engine.computeDecayedScore(0.6, new Date(NOW - 30 * day), NOW), 0.3) // 30d → half
  assert.equal(engine.computeDecayedScore(0.6, new Date(NOW - 90 * day), NOW), 0.15) // 90d → quarter
  assert.equal(engine.computeDecayedScore(0.6, null, NOW), 0.6 * 0.02) // never sold

  // A never-sold product must not outrank a product that actually sold,
  // even with a perfect rating-only final score.
  const neverSold = engine.computeDecayedScore(0.1, null, NOW)
  const soldOnce = engine.computeDecayedScore(0.2, new Date(NOW - 20 * day), NOW)
  assert.ok(soldOnce > neverSold, `sold (${soldOnce}) must beat never-sold (${neverSold})`)

  // Volume stays meaningful over days: the old (hours+2)^1.8 formula put a
  // 5-day-old score ~16x below a 1-day-old one regardless of final score.
  const strongSeller5d = engine.computeDecayedScore(0.8, new Date(NOW - 5 * day), NOW)
  const weakSeller1d = engine.computeDecayedScore(0.2, new Date(NOW - 1 * day), NOW)
  assert.ok(strongSeller5d > weakSeller1d)
})

// ---------- full recalculation ----------

test('recalculateAllScores: units summed, views bulk-counted, one bad product cannot freeze the rest', async () => {
  const updated = await engine.recalculateAllScores()
  assert.equal(updated, 2) // A and B updated; C failed but did not abort the run

  const a = savedScores.A
  assert.ok(a, 'seller score saved')
  assert.equal(a.total_units_sold, 7) // sum of quantity, not event count
  assert.equal(a.total_views_14d, 42)
  assert.equal(a.last_sale_at.getTime(), NOW.getTime())
  assert.ok(Math.abs(a.final_score - (0.4 + 0.15 + 0.1 * (2 / 3))) < 1e-9, `final ${a.final_score}`)
  assert.equal(a.decayed_score, a.final_score) // sold today → recency factor 1

  const b = savedScores.B
  assert.ok(b, 'never-sold score saved')
  assert.equal(b.last_sale_at, null)
  assert.equal(b.decayed_score, b.final_score * 0.02)
  assert.ok(b.decayed_score < a.decayed_score)
})

test('scheduleRecalculation debounces repeated sale triggers into one run', async () => {
  const before = productFindCalls
  engine.scheduleRecalculation(10)
  engine.scheduleRecalculation(10)
  engine.scheduleRecalculation(10)
  await new Promise((r) => setTimeout(r, 120))
  assert.equal(productFindCalls - before, 1)
})
