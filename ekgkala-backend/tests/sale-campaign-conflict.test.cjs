// Offline: mocks Product/Sale model methods; no MongoDB connection.
//
// NOTE on the mocks below: they EVALUATE the Mongo filter shapes emitted by
// campaignConflictService (the $or / $gt time branches), instead of returning
// rows blindly. If the service's query shape regresses, these tests fail.
const assert = require('node:assert/strict')
const test = require('node:test')
const mongoose = require('mongoose')
const Product = require('../models/Product')
const Sale = require('../models/Sale')
const {
  findProductCampaignConflicts,
  findActiveSalesForProduct,
  getSaleMemberProductIds,
  buildConflictMessage,
} = require('../services/campaignConflictService')

const id = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'))
const now = new Date('2026-09-29T10:00:00Z')
const future = new Date('2026-10-05T10:00:00Z')
const past = new Date('2026-09-20T10:00:00Z')

const after = (value, operand) => value !== null && value !== undefined && new Date(value) > new Date(operand)

// Faithful mini-evaluator for the filter shape emitted by findProductCampaignConflicts:
//   { $or: [ { isFlashDeal: true, $or: [{flashDealEndTime: null}, {flashDealEndTime: {$gt: from}}] },
//             { isSpecialOffer: true, $or: [...] } ],
//     _id?: { $in: [...] } }
const stubProducts = (rows) => {
  Product.find = (filter) => ({
    select: () => ({
      lean: async () =>
        rows.filter((r) => {
          if (filter._id && !(filter._id.$in || []).some((x) => String(x) === String(r._id))) return false
          return (filter.$or || []).some((branch) => {
            const flag = branch.isFlashDeal === true ? 'isFlashDeal' : branch.isSpecialOffer === true ? 'isSpecialOffer' : null
            if (!flag || r[flag] !== true) return false
            const endField = flag === 'isFlashDeal' ? 'flashDealEndTime' : 'specialOfferEndTime'
            return (branch.$or || []).some((cond) => {
              const v = cond[endField]
              if (v === null) return r[endField] === null || r[endField] === undefined
              if (v && typeof v === 'object' && '$gt' in v) return after(r[endField], v.$gt)
              return false
            })
          })
        }),
    }),
  })
}

test('flags flash + special products, ignores expired and exempt ones', async () => {
  stubProducts([
    { _id: id(1), name: 'A', isFlashDeal: true, flashDealEndTime: future },
    { _id: id(2), name: 'B', isSpecialOffer: true, specialOfferEndTime: future },
    { _id: id(3), name: 'C', isFlashDeal: true, flashDealEndTime: past },
    { _id: id(4), name: 'D', isSpecialOffer: true, specialOfferEndTime: null },
  ])
  const all = await findProductCampaignConflicts([], { now })
  assert.deepEqual(all.map((r) => r.productId).sort(), [id(1), id(2), id(4)].map(String).sort())
  assert.equal(all.find((r) => r.productId === String(id(1))).conflicts[0].type, 'flash')
  assert.equal(all.find((r) => r.productId === String(id(2))).conflicts[0].type, 'special')

  const some = await findProductCampaignConflicts([id(1), id(3)], { now })
  assert.deepEqual(some.map((r) => r.productId), [String(id(1))])

  const exempt = await findProductCampaignConflicts([], { now, exemptProductIds: [id(1)] })
  assert.ok(!exempt.some((r) => r.productId === String(id(1))))
})

test('a product with both campaigns reports both conflicts', async () => {
  stubProducts([{ _id: id(1), name: 'A', isFlashDeal: true, flashDealEndTime: future, isSpecialOffer: true, specialOfferEndTime: future }])
  const rows = await findProductCampaignConflicts([id(1)], { now })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].conflicts.map((c) => c.type).sort(), ['flash', 'special'])
})

test('a campaign that ends before the sale window starts is not a conflict', async () => {
  stubProducts([{ _id: id(1), name: 'A', isFlashDeal: true, flashDealEndTime: new Date('2026-10-01T00:00:00Z') }])
  const later = await findProductCampaignConflicts([id(1)], { now, windowStart: new Date('2026-10-02T00:00:00Z') })
  assert.equal(later.length, 0)
  const overlapping = await findProductCampaignConflicts([id(1)], { now, windowStart: new Date('2026-09-30T00:00:00Z') })
  assert.equal(overlapping.length, 1)
})

test('windowStart in the past still measures liveness from now', async () => {
  stubProducts([
    { _id: id(1), name: 'A', isFlashDeal: true, flashDealEndTime: future },
    { _id: id(2), name: 'B', isFlashDeal: true, flashDealEndTime: past },
  ])
  const rows = await findProductCampaignConflicts([id(1), id(2)], { now, windowStart: past })
  assert.deepEqual(rows.map((r) => r.productId), [String(id(1))])
})

test('DB-level time branch is honored: ended campaigns never reach the service filter', async () => {
  // If the service forgot the { $gt: from } branch, the stub would return row 3 and the
  // service-side isLive would still drop it — this test pins the DB shape explicitly.
  let seenFrom
  const rows = [{ _id: id(1), name: 'A', isFlashDeal: true, flashDealEndTime: past }]
  Product.find = (filter) => {
    seenFrom = filter.$or[0].$or[1].flashDealEndTime.$gt
    return { select: () => ({ lean: async () => rows }) }
  }
  const out = await findProductCampaignConflicts([id(1)], { now })
  assert.ok(seenFrom instanceof Date)
  assert.equal(out.length, 0)
})

test('findActiveSalesForProduct queries active, unexpired sales by product or category', async () => {
  let captured
  Sale.find = (q) => { captured = q; return { select: () => ({ lean: async () => [{ name: 'X' }] }) } }
  const sales = await findActiveSalesForProduct(id(1), id(9), now)
  assert.equal(sales.length, 1)
  assert.equal(captured.isActive, true)
  assert.deepEqual(captured.endDate, { $gt: now })
  assert.equal(captured.$or.length, 2)
  assert.deepEqual(await findActiveSalesForProduct('bad', null, now), [])
})

test('findActiveSalesForProduct works with only a category id', async () => {
  let captured
  Sale.find = (q) => { captured = q; return { select: () => ({ lean: async () => [] }) } }
  await findActiveSalesForProduct(null, id(9), now)
  assert.equal(captured.$or.length, 1)
  assert.deepEqual(captured.$or[0], { categories: id(9) })
})

test('getSaleMemberProductIds collects direct + direct-category members of live sales', async () => {
  const liveSale = { _id: id(901), products: [id(1), id(2)], categories: [id(9)] }
  let saleQuery
  Sale.find = (q) => {
    saleQuery = q
    return { lean: async () => [liveSale] }
  }
  const products = [
    { _id: id(1), category: id(7) }, // عضو مستقیم
    { _id: id(2), category: id(9) }, // عضو مستقیم + دسته‌ای
    { _id: id(5), category: id(9) }, // فقط دسته‌ای
    { _id: id(6), category: id(8) }, // نامرتبط
  ]
  Product.find = (q) => ({
    lean: async () =>
      products.filter((p) =>
        (q.$or || []).some(
          (branch) =>
            (branch._id && branch._id.$in.some((x) => String(x) === String(p._id))) ||
            (branch.category && branch.category.$in.some((x) => String(x) === String(p.category)))
        )
      ),
  })
  const ids = await getSaleMemberProductIds(now)
  assert.equal(saleQuery.isActive, true)
  assert.ok(saleQuery.endDate.$gt instanceof Date)
  assert.deepEqual(ids.map(String).sort(), [id(1), id(2), id(5)].map(String).sort())
})

test('getSaleMemberProductIds returns [] without touching Product when no live sale exists', async () => {
  Sale.find = () => ({ lean: async () => [] })
  let touched = false
  Product.find = () => { touched = true; return { lean: async () => [] } }
  assert.deepEqual(await getSaleMemberProductIds(now), [])
  assert.equal(touched, false)
})

test('buildConflictMessage lists Persian labels and product names', async () => {
  const msg = buildConflictMessage([
    { productId: String(id(1)), name: 'دوربین A', sku: 'SKU1', conflicts: [{ type: 'flash', label: 'پیشنهاد لحظه‌ای', endTime: null }] },
  ])
  assert.ok(msg.includes('دوربین A'))
  assert.ok(msg.includes('پیشنهاد لحظه‌ای'))
})
