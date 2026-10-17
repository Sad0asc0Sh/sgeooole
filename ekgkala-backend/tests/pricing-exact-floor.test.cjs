// تست گارد «کف قطعی» مغز قیمت‌گذاری (ai-driven-competitive-pricing-system نسخه 4.1) — آفلاین، بدون MongoDB
// پوشش:
//  ۱) ادغام pricingMeta در همگام‌سازی: exactFloorPrice / hardFloorPrice / syncedAt / needsRefresh
//  ۲) عضویت Sale با $setOnInsert.autoManaged=true (کمپین‌های مغز قیمت‌گذاری قابل پاک‌سازی‌اند)
//  ۳) پاک‌سازی خودکار کمپین‌های autoManaged خالی/منقضی + عدم دست‌زدن به کمپین‌های دستی ادمین
//  ۴) اتصال cleanup به runSaleCleanup و مسیر خروج محصول از عضویت
//  ۵) گارد S4 در جزئیات محصول (clamp روی ریشه و واریانت‌ها) و S5 (بازگشت به کف قطعی پس از انقضا)
//  ۶) آینه‌های pipeline لیست (با mingo): clamp تخفیف، بازگردانی تایمر منقضی (legacy اولویت دارد)
//     و بازگردانی پس از پایان Sale بدون تایمر (بدون meta دقیقاً رفتار قبلی)
// قرارداد کف قطعی: price ثبت‌شده (سقف معیار) فقط مبنای ریاضی درصد تخفیف است؛ قیمت «واقعیِ» فروش
// exactFloorPrice است. هیچ نمایشی نباید زیر این کف برود و پس از پایان پروموشن باید به همین
// کف برگردد، نه به سقفی که مبنای درصد بود.
const assert = require('node:assert/strict')
const test = require('node:test')
const mongoose = require('mongoose')
require('mingo/init/system')
const { aggregate } = require('mingo')

const {
  managedExactFloorPrice,
  clampToManagedExactFloor,
  restoreManagedExactFloor,
  applyPromotionOverlay,
} = require('../services/pricingService')
const {
  validatePricingSyncPayload,
  syncProductTimedSaleMembership,
  cleanupEmptyAutoManagedSales,
} = require('../services/competitivePricingSyncService')
const { runSaleCleanup } = require('../services/promotionLifecycleService')
const { parseListingQuery, buildListingPipeline } = require('../services/productListingService')

const now = new Date('2026-10-12T12:00:00.000Z')
const past = new Date('2026-10-01T12:00:00.000Z')
const future = new Date('2026-10-20T12:00:00.000Z')
const oid = (n) => new mongoose.Types.ObjectId(n.toString(16).padStart(24, '0'))

// ---------------------------------------------------------------- helper های گارد
test('managedExactFloorPrice: بدون meta یا مقدار خراب => 0 (رفتار قبلی)', () => {
  assert.equal(managedExactFloorPrice({}), 0)
  assert.equal(managedExactFloorPrice({ pricingMeta: null }), 0)
  assert.equal(managedExactFloorPrice({ pricingMeta: { exactFloorPrice: 0 } }), 0)
  assert.equal(managedExactFloorPrice({ pricingMeta: { exactFloorPrice: -5 } }), 0)
  assert.equal(managedExactFloorPrice({ pricingMeta: { exactFloorPrice: 'abc' } }), 0)
  assert.equal(managedExactFloorPrice(null), 0)
  assert.equal(managedExactFloorPrice({ pricingMeta: { exactFloorPrice: 2000000 } }), 2000000)
})

test('clampToManagedExactFloor: ریشه و واریانت مشمول به کف قطعی محدود می‌شوند و واریانت مستثنی دست‌نخورده می‌ماند', () => {
  const p = {
    price: 1750000,
    compareAtPrice: 2500000,
    pricingMeta: { exactFloorPrice: 2000000 },
    variants: [
      { _id: 'v1', price: 1400000, compareAtPrice: 2000000 },
      { _id: 'v2', price: 1900000, excludeFromPromotion: true },
    ],
  }
  clampToManagedExactFloor(p)
  assert.equal(p.price, 2000000)
  // مقایسه ریشه خط‌خورده‌ای که کمتر از کف قطعی می‌شود جعلی است — باید حداقلِ کف بماند؛
  // مقایسه معتبرِ بالای کف دست‌نخورده می‌ماند.
  assert.equal(p.compareAtPrice, 2500000)
  assert.equal(p.variants[0].price, 2000000)
  assert.equal(p.variants[0].compareAtPrice, undefined)
  assert.equal(p.variants[1].price, 1900000)
})

test('clampToManagedExactFloor: قیمت بالای کف یا محصول بدون meta دست‌نخورده می‌ماند', () => {
  const noMeta = { price: 1000000, variants: [{ _id: 'v', price: 900000 }] }
  clampToManagedExactFloor(noMeta)
  assert.equal(noMeta.price, 1000000)
  assert.equal(noMeta.variants[0].price, 900000)

  const ok = { price: 2500000, pricingMeta: { exactFloorPrice: 2000000 }, variants: [{ _id: 'v', price: 2100000 }] }
  clampToManagedExactFloor(ok)
  assert.equal(ok.price, 2500000)
  assert.equal(ok.variants[0].price, 2100000)
})

test('restoreManagedExactFloor: بازگشت نمایش از سقف معیار به کف قطعی پس از انقضای پروموشن', () => {
  const p = { price: 2500000, pricingMeta: { exactFloorPrice: 2100000 } }
  restoreManagedExactFloor(p)
  assert.equal(p.price, 2100000)

  // قیمت حتی پایین‌تر از کف (ورودی خراب) هرگز بالا برده نمی‌شود
  const low = { price: 1900000, pricingMeta: { exactFloorPrice: 2100000 } }
  restoreManagedExactFloor(low)
  assert.equal(low.price, 1900000)

  const noMeta = { price: 2500000 }
  restoreManagedExactFloor(noMeta)
  assert.equal(noMeta.price, 2500000)
})

// ---------------------------------------------------------------- ادغام pricingMeta در همگام‌سازی
test('همگام‌سازی: pricingMeta کف قطعی/خط قرمز/syncedAt/needsRefresh دارد و داده‌های قبلی حفظ می‌شوند', () => {
  const payload = {
    finalPrice: 2100000,
    basePrice: 2500000,
    costPrice: 1900000,
    campaignType: 'timed_sale',
    timedSale: { enabled: true, name: 'فروش ویژه هوشمند', discountPercentage: 16, endDate: future },
    pricingMeta: { engineVersion: '4.1', syncCorrelationId: 'E2E-1' },
  }
  const existingProduct = { costPrice: 1000000, hardFloorPrice: 0, pricingMeta: { monitoredMarketCeiling: 2400000 } }
  const check = validatePricingSyncPayload(payload, existingProduct)

  assert.equal(check.valid, true)
  const meta = check.updateDoc.pricingMeta
  assert.equal(check.discountPct, 16)
  assert.equal(calibrateRoundTrip(2500000, 16), 2100000)
  assert.equal(meta.exactFloorPrice, 2100000)
  // خط قرمز کف فروش از max(existing, cost+1000): 1900000+1000 = 1901000
  assert.equal(meta.hardFloorPrice, 1901000)
  assert.equal(meta.engineVersion, '4.1')
  assert.equal(meta.syncCorrelationId, 'E2E-1')
  // سقف بازار در هر همگام‌سازی تازه‌سازی می‌شود: چون payload ارسال نکرده، از سقف کالیبره می‌آید
  assert.equal(meta.monitoredMarketCeiling, 2500000)
  assert.equal(meta.needsRefresh, false)
  assert.equal(meta.syncedAt instanceof Date, true)
  assert.equal(meta.exactFloorPriceAt instanceof Date, true)
  assert.equal(check.finalPrice, 2100000)
  assert.equal(check.basePrice, 2500000)
})

// 2500000 * (100 - 16) / 100 به‌صورت رُند باید همان 2100000 را بدهد — دنیای همسانی کالیبراسیون
function calibrateRoundTrip(ceiling, pct) {
  return Math.round(ceiling * (1 - pct / 100))
}

test('همگام‌سازی: بدون خط قرمز و بدون قیمت خرید، کلید hardFloorPrice در pricingMeta نوشته نمی‌شود', () => {
  const check = validatePricingSyncPayload({ finalPrice: 1500000 })
  assert.equal(check.valid, true)
  assert.equal(check.updateDoc.hardFloorPrice, undefined)
  assert.equal('hardFloorPrice' in check.updateDoc, false)
  assert.equal('hardFloorPrice' in check.updateDoc.pricingMeta, false)
  assert.equal(check.updateDoc.pricingMeta.exactFloorPrice, 1500000)
  assert.equal(check.campaignType, 'none')
})

// ---------------------------------------------------------------- عضویت Sale با autoManaged
const makeSaleStub = () => {
  const calls = { updateMany: [], deleteMany: [], findOneAndUpdate: [] }
  const model = {
    calls,
    updateMany: async (filter, update) => {
      calls.updateMany.push({ filter, update })
      return { modifiedCount: 1 }
    },
    deleteMany: async (filter) => {
      calls.deleteMany.push({ filter })
      return { deletedCount: 1 }
    },
    findOneAndUpdate: async (filter, update, options) => {
      calls.findOneAndUpdate.push({ filter, update, options })
      return { _id: 'sale-1', products: ['P1'] }
    },
  }
  return model
}

test('عضویت: کمپین Sale با $setOnInsert.autoManaged=true ساخته می‌شود وisActive فعال می‌ماند', async () => {
  const model = makeSaleStub()
  const saleDoc = await syncProductTimedSaleMembership(model, 'P1', {
    enabled: true,
    name: 'فروش ویژه هوشمند',
    discountPercentage: 16,
    endDate: future,
    badgeTheme: 'green-orange',
    showInFeatured: true,
  })
  assert.equal(saleDoc._id, 'sale-1')
  assert.equal(model.calls.findOneAndUpdate.length, 1)
  const upsert = model.calls.findOneAndUpdate[0]
  assert.equal(upsert.filter.name, 'فروش ویژه هوشمند')
  assert.equal(upsert.filter.discountPercentage, 16)
  assert.equal(upsert.filter.autoManaged, true)
  assert.equal(upsert.update.$setOnInsert.autoManaged, true)
  assert.equal('autoManaged' in upsert.update.$set, false)
  assert.equal(upsert.update.$set.isActive, true)
  assert.equal(upsert.update.$setOnInsert.includeSubcategories, true)
  // ۴.۱.۱: endDate فقط هنگام ساخت نوشته می‌شود؛ upsert تکراری نباید تایمر Sale مشترک را جلو ببرد
  assert.equal('endDate' in upsert.update.$set, false)
  assert.equal(upsert.update.$setOnInsert.endDate, future)
})

test('عضویت: خروج محصول از کمپین (کمپین none) سبد خالیِ autoManaged را بلافاصله پاک می‌کند', async () => {
  const model = makeSaleStub()
  const result = await syncProductTimedSaleMembership(model, 'P1', { enabled: false })
  assert.equal(result, null)
  const pull = model.calls.updateMany[0]
  assert.deepEqual(pull.filter, { products: 'P1', isActive: true, autoManaged: true })
  assert.deepEqual(pull.update, { $pull: { products: 'P1' } })
  assert.equal(model.calls.deleteMany.length, 1)
  assert.deepEqual(model.calls.deleteMany[0].filter, {
    autoManaged: true,
    isActive: true,
    products: { $size: 0 },
  })
})

test('عضویت: حذف از Saleهای ناهمخوان فقط روی autoManaged انجام می‌شود (Sale دستی ادمین محافظت می‌شود)', async () => {
  const model = makeSaleStub()
  await syncProductTimedSaleMembership(model, 'P1', {
    enabled: true,
    name: 'فروش ویژه هوشمند',
    discountPercentage: 16,
    endDate: future,
    badgeTheme: 'green-orange',
    showInFeatured: true,
  })
  const pull = model.calls.updateMany.find((c) => c.update && c.update.$pull)
  assert.ok(pull, 'باید یک updateMany از نوع $pull فراخوانی شود')
  assert.equal(pull.filter.products, 'P1')
  assert.equal(pull.filter.autoManaged, true)
  assert.ok(Array.isArray(pull.filter.$or))
})

// ---------------------------------------------------------------- پاک‌سازی کمپین‌های autoManaged
test('cleanupEmptyAutoManagedSales: فقط کمپین‌های autoManaged منقضی/خالی را می‌زند', async () => {
  const model = makeSaleStub()
  const result = await cleanupEmptyAutoManagedSales(model, { now })
  assert.deepEqual(result, { deactivated: 1, deleted: 1 })
  assert.deepEqual(model.calls.updateMany[0].filter, {
    autoManaged: true,
    isActive: true,
    endDate: { $lte: now },
  })
  assert.deepEqual(model.calls.updateMany[0].update, { $set: { isActive: false } })
  assert.equal(model.calls.deleteMany.length, 1)
  assert.deepEqual(model.calls.deleteMany[0].filter, {
    autoManaged: true,
    isActive: true,
    products: { $size: 0 },
  })
})

test('cleanupEmptyAutoManagedSales: بدون deleteMany یا بدون مدل کرش نمی‌کند', async () => {
  const partial = {
    updateMany: async () => ({ modifiedCount: 0 }),
  }
  assert.deepEqual(await cleanupEmptyAutoManagedSales(partial, { now }), { deactivated: 0, deleted: 0 })
  assert.deepEqual(await cleanupEmptyAutoManagedSales(null, { now }), { deactivated: 0, deleted: 0 })
})

test('runSaleCleanup: غیرفعال‌سازی منقضی‌ها + پاک‌سازی autoManaged خالی در یک گذر', async () => {
  const model = makeSaleStub()
  const affected = await runSaleCleanup(model, { now })
  assert.equal(affected, 1)
  // اولی: غیرفعال‌سازی منقضی‌ها؛ دومی: غیرفعال‌سازی autoManaged منقضی؛ deleteMany: سبد خالی
  assert.equal(model.calls.updateMany.length, 2)
  assert.deepEqual(model.calls.updateMany[0].filter, { isActive: true, endDate: { $lte: now } })
  assert.deepEqual(model.calls.updateMany[1].filter, {
    autoManaged: true,
    isActive: true,
    endDate: { $lte: now },
  })
  assert.equal(model.calls.deleteMany.length, 1)
  assert.deepEqual(model.calls.deleteMany[0].filter, {
    autoManaged: true,
    isActive: true,
    products: { $size: 0 },
  })
})

// ---------------------------------------------------------------- جزئیات محصول (S4/S5)
const sale = { name: 'فروش ویژه عید', discountPercentage: 30, badgeTheme: 'red-purple', endDate: future }

test('جزئیات S4: تخفیف عمیق Sale زیر کف قطعی نمی‌رود (کالیبراسیون مغز=فقط مبنای درصد)', () => {
  const p = {
    _id: 'p1', name: 'x', productType: 'simple',
    price: 2500000, discount: 0,
    pricingMeta: { exactFloorPrice: 2000000, calibratedCeiling: 2500000 },
  }
  applyPromotionOverlay(p, { activeSale: sale, now })
  assert.equal(p.discount, 30)
  assert.equal(p.campaignLabel, 'فروش ویژه عید')
  assert.equal(p.compareAtPrice, 2500000)
  // 2500000×0.7=1750000 زیرِ کف قطعی 2000000 است => دقیقاً روی کف قطعی نمایش داده می‌شود
  assert.equal(p.price, 2000000)
})

test('جزئیات S4: محصول متغیر — واریانت مشمول به کف می‌رسد، مستثنی دست‌نخورده، مقایسه جعلی حذف', () => {
  const p = {
    _id: 'p2', name: 'x', productType: 'variable',
    price: 2500000, discount: 0,
    pricingMeta: { exactFloorPrice: 2000000 },
    variants: [{ _id: 'v1', price: 2600000 }, { _id: 'v2', price: 2100000, excludeFromPromotion: true }],
  }
  applyPromotionOverlay(p, { activeSale: sale, now })
  assert.equal(p.variants[0].price, 2000000) // 2600000×0.7=1820000 => کف 2000000، مقایسه حذف
  assert.equal(p.variants[0].compareAtPrice, undefined)
  assert.equal(p.variants[1].price, 2100000) // مستثنی
})

test('جزئیات: بدون meta دقیقاً رفتار قبلی (تخفیف عمیق بدون clamp)', () => {
  const p = { _id: 'p3', name: 'x', productType: 'simple', price: 100000, discount: 0 }
  applyPromotionOverlay(p, { activeSale: { ...sale, discountPercentage: 30 }, now })
  assert.equal(p.price, 70000)
})

test('جزئیات S5: پایان پروموشن مغز — نمایش به کف قطعی برمی‌گردد نه سقف معیار', () => {
  const p = {
    _id: 'p4', name: 'x', productType: 'simple',
    price: 2500000, discount: 20,
    isFlashDeal: true, flashDealEndTime: past,
    pricingMeta: { exactFloorPrice: 2100000 },
  }
  applyPromotionOverlay(p, { activeSale: null, now })
  assert.equal(p.discount, 0)
  assert.equal(p.isFlashDeal, false)
  assert.equal(p.campaignLabel, undefined)
  assert.equal(p.compareAtPrice, undefined)
  assert.equal(p.price, 2100000)

  // محصول بدون پروموشنِ زنده ولی با meta (مثلاً Sale پایان‌یافته) هم به کف قطعی برمی‌گردد
  const afterSale = {
    _id: 'p5', name: 'x', productType: 'simple',
    price: 2500000, discount: 0,
    pricingMeta: { exactFloorPrice: 2100000 },
  }
  applyPromotionOverlay(afterSale, { activeSale: null, now })
  assert.equal(afterSale.price, 2100000)
})

// ---------------------------------------------------------------- pipeline لیست (mingo)
const run = (products, query = {}, campaigns = []) =>
  aggregate(products, buildListingPipeline(parseListingQuery(query), { campaigns }, now))[0]
const byName = (r, name) => r.data.find((p) => p.name === name)

const simpleManaged = () => ({
  _id: oid(1), name: 'M1', isActive: true, productType: 'simple',
  price: 2500000, discount: 0, stock: 3, rating: 4, createdAt: now, variants: [],
  pricingMeta: { exactFloorPrice: 2100000, calibratedCeiling: 2500000, campaignType: 'timed_sale' },
})

const campaign = { products: [oid(1)], categories: [], name: 'کمپین ۲۰٪', discountPercentage: 20, endDate: future, badgeTheme: 'green-orange', showInFeatured: true }

test('لیست S4: تخفیف ۲۰٪ روی سقف معیار ۲٪ زیر کف قطعی می‌رود => نمایش کف قطعی، مقایسه سقف', () => {
  const r = run([simpleManaged()], {}, [campaign])
  const doc = byName(r, 'M1')
  assert.equal(doc.discount, 20)
  assert.equal(doc.compareAtPrice, 2500000)
  // 2500000×0.8=2000000 < 2100000 => clamp
  assert.equal(doc.price, 2100000)
})

test('لیست S5 (کف منقضی): exactFloorPrice قدیمی‌تر از ۱۴ روز نادیده گرفته می‌شود', () => {
  const stale = {
    ...simpleManaged(),
    _id: oid(9),
    name: 'M-stale',
    pricingMeta: {
      exactFloorPrice: 2100000,
      exactFloorPriceAt: new Date(now.getTime() - 15 * 86_400_000),
    },
  }
  const r = run([stale], {}, [])
  const doc = byName(r, 'M-stale')
  assert.equal(doc.price, 2500000, 'کف منقضی نباید روی قیمت اثر بگذارد')
  assert.equal(doc.discount, 0)
})

test('لیست S5 (پایان Sale بدون تایمر): سقف معیار مانده به کف قطعی برمی‌گردد', () => {
  const r = run([simpleManaged()], {}, [])
  const doc = byName(r, 'M1')
  assert.equal(doc.price, 2100000)
  assert.equal(doc.discount, 0)
  // مقایسه جعلی برای محصول بدون تخفیف منتشر نمی‌شود
  assert.equal('compareAtPrice' in doc, false)
})

test('لیست S5 (تایمر منقضی): legacy اولویت دارد و meta مدیریت‌شده به کف برمی‌گردد', () => {
  const legacy = {
    _id: oid(2), name: 'L1', isActive: true, productType: 'simple',
    price: 970000, compareAtPrice: 1000000, discount: 3,
    isFlashDeal: true, flashDealEndTime: past, stock: 2, rating: 4, createdAt: now,
  }
  const managedExpired = {
    _id: oid(3), name: 'M2', isActive: true, productType: 'simple',
    price: 2500000, discount: 0,
    isFlashDeal: true, flashDealEndTime: past, stock: 2, rating: 4, createdAt: now,
    pricingMeta: { exactFloorPrice: 2100000 },
  }
  const r = run([legacy, managedExpired])
  const l = byName(r, 'L1'), m = byName(r, 'M2')
  // داده‌ی قدیمیِ همخوان با خط‌خورده: بازگشت به مقایسه (رفتار قبلی)
  assert.equal(l.price, 1000000)
  // داده‌ی مدیریت‌شده (قیمت=سقف، مقایسه هم‌سقف پس legacyMatch ندارد): بازگشت به کف قطعی
  assert.equal(m.price, 2100000)
})

test('لیست: محصول بدون meta دقیقاً رفتار قبلی (P7-style: price=0 و مقایسه مانده)', () => {
  const legacyDegenerate = { _id: oid(4), name: 'D1', isActive: true, productType: 'simple', price: 0, compareAtPrice: 5000, discount: 0, stock: 1, rating: 4, createdAt: now, variants: [] }
  const r = run([legacyDegenerate])
  const doc = byName(r, 'D1')
  assert.equal(doc.price, 0)
  assert.equal('compareAtPrice' in doc, false)
})

test('لیست: واریانت مشمول متغیر هم به کف قطعی می‌رسد و مستثنی دست‌نخورده می‌ماند', () => {
  const variableDoc = (id, name, exactFloor, v1Price, v2ExcludedPrice) => ({
    _id: oid(id), name, isActive: true, productType: 'variable',
    price: 2500000, discount: 0, stock: 5, rating: 4, createdAt: now,
    pricingMeta: { exactFloorPrice: exactFloor },
    variants: [
      { _id: oid(id * 10 + 1), price: v1Price, stock: 2 },
      { _id: oid(id * 10 + 2), price: v2ExcludedPrice, stock: 3, excludeFromPromotion: true },
    ],
  })
  const campaignFor = (id) => ({ products: [oid(id)], categories: [], name: 'کمپین ۲۰٪ واریانت', discountPercentage: 20, endDate: future, badgeTheme: 'green-orange', showInFeatured: true })

  // بالای کف: تخفیف مثل قبل اعمال می‌شود؛ مستثنی قیمت پایه می‌ماند
  const above = variableDoc(51, 'V1', 2000000, 2600000, 2400000)
  const r = run([above], {}, [campaignFor(51)])
  const doc = byName(r, 'V1')
  assert.deepEqual(doc.variants.map((v) => v.price), [2080000, 2400000])
  assert.equal(doc.price, 2080000)

  // دقیقاً روی کف: 2500000×0.8=2000000 === کف 2000000 (بدون تغییر)
  const exact = variableDoc(52, 'V2', 2000000, 2500000, 2200000)
  const r2 = run([exact], {}, [campaignFor(52)])
  const doc2 = byName(r2, 'V2')
  assert.equal(doc2.variants[0].price, 2000000)
  assert.equal(doc2.price, 2000000)

  // زیرِ کف: واریانت مشمول به کف clamp می‌شود؛ مستثنی دست‌نخورده
  const below = variableDoc(53, 'V3', 2100000, 2500000, 2150000)
  const r3 = run([below], {}, [campaignFor(53)])
  const doc3 = byName(r3, 'V3')
  assert.equal(doc3.variants[0].price, 2100000)
  assert.equal(doc3.variants[1].price, 2150000)
  assert.equal(doc3.price, 2100000)
})
