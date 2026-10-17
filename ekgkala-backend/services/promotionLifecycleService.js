// ============================================
// چرخه‌ی عمر پیشنهاد لحظه‌ای / شگفت‌انگیزِ خودِ محصول (لایه‌ی داده)
// --------------------------------------------
// قاعده (هم‌راستا با pricingService.isOwnPromotionLive):
//   فیلد discount محصول فقط همراه با یک پیشنهاد لحظه‌ای یا شگفت‌انگیزِ «زنده» معنا دارد.
//   به محض غیرفعال‌شدن (دستیِ ادمین، دکمه‌ی غیرفعال‌سازی گروهی یا پایان تایمر):
//     - isFlashDeal / isSpecialOffer خاموش و زمان‌های پایان پاک می‌شوند؛
//     - discount صفر می‌شود (تخفیف از روی محصول برداشته می‌شود)؛
//     - اگر price از قبل تخفیف‌خورده ذخیره شده بود (داده‌ی قدیمی)، به قیمت پایه برمی‌گردد
//       تا با صفر شدن discount، قیمت تخفیفی به‌صورت دائمی روی محصول باقی نماند.
//   توجه: توابع سطحِ محصولِ این ماژول تخفیف زمان‌دار (Sale / بخش مالی) را لمس نمی‌کنند؛
//   آن کمپین‌ها درصد خودشان را مستقل از فیلد discount محصول اعمال می‌کنند.
//   چرخه‌ی عمر خودِ سند Sale (غیرفعال‌شدن خودکار بعد از endDate) در runSaleCleanup است.
// ============================================

const { resolveBasePrice, isTimerLive } = require('./pricingService')
const { cleanupEmptyAutoManagedSales } = require('./competitivePricingSyncService')

const toPlain = (v) => (v && typeof v.toObject === 'function' ? v.toObject() : v)

const hasValue = (v) => v !== undefined && v !== null && v !== ''

/**
 * بازگرداندن قیمت پایه‌ی داده‌ی قدیمی (price ≈ compareAtPrice × (1 − storedDiscount/100)).
 * فقط وقتی تغییری می‌دهد که price واقعاً تخفیف‌خورده ذخیره شده باشد؛ دقیقاً همان چیزی که
 * restoreBasePriceOnObject هنگام نمایش انجام می‌دهد، این بار به‌صورت ماندگار.
 *
 * @returns {{ set: object, unset: object }}
 */
function buildLegacyBaseRestore({ price, compareAtPrice, variants } = {}, storedDiscount = 0) {
  const set = {}
  const unset = {}
  const d = Number(storedDiscount) || 0
  if (!(d > 0)) return { set, unset }

  const p = Number(price) || 0
  if (p > 0 && hasValue(compareAtPrice)) {
    const base = resolveBasePrice(p, compareAtPrice, d)
    if (base !== p) {
      set.price = base
      unset.compareAtPrice = ''
    }
  }

  if (Array.isArray(variants) && variants.length > 0) {
    let changed = false
    const next = variants.map((v) => {
      const obj = { ...toPlain(v) }
      const vp = Number(obj.price) || 0
      if (vp > 0 && hasValue(obj.compareAtPrice)) {
        const vb = resolveBasePrice(vp, obj.compareAtPrice, d)
        if (vb !== vp) {
          obj.price = vb
          delete obj.compareAtPrice
          changed = true
        }
      }
      return obj
    })
    if (changed) set.variants = next
  }

  return { set, unset }
}

/** آپدیت کاملِ غیرفعال‌سازی پیشنهاد لحظه‌ای/شگفت‌انگیز + حذف تخفیف برای یک سند محصول. */
function buildDeactivationUpdate(product) {
  const { set, unset } = buildLegacyBaseRestore(product, product && product.discount)
  return {
    $set: { ...set, isFlashDeal: false, isSpecialOffer: false, discount: 0 },
    $unset: { ...unset, flashDealEndTime: '', specialOfferEndTime: '' },
  }
}

/**
 * برنامه‌ی پاک‌سازی یک محصول در لحظه‌ی now:
 *  - هیچ‌کدام زنده نیست و ردّی از پروموشن (فلگ یا تخفیف) مانده ⇒ غیرفعال‌سازی کامل؛
 *  - یکی زنده و دیگری منقضی (داده‌ی ناسازگار) ⇒ فقط فلگ منقضی خاموش می‌شود و تخفیف می‌ماند؛
 *  - در غیر این صورت null.
 */
function planPromotionCleanup(product, now = new Date()) {
  if (!product) return null
  const flashLive = isTimerLive(product.isFlashDeal, product.flashDealEndTime, now)
  const specialLive = isTimerLive(product.isSpecialOffer, product.specialOfferEndTime, now)

  if (!flashLive && !specialLive) {
    const hasTrace = Boolean(product.isFlashDeal || product.isSpecialOffer || (Number(product.discount) || 0) > 0)
    return hasTrace ? buildDeactivationUpdate(product) : null
  }

  const $set = {}
  const $unset = {}
  if (product.isFlashDeal && !flashLive) {
    $set.isFlashDeal = false
    $unset.flashDealEndTime = ''
  }
  if (product.isSpecialOffer && !specialLive) {
    $set.isSpecialOffer = false
    $unset.specialOfferEndTime = ''
  }
  return Object.keys($set).length ? { $set, $unset } : null
}

/** فیلتر کاندیداهای پاک‌سازی: تایمر گذشته، یا تخفیف بدون هیچ پیشنهاد فعال. */
const staleCandidatesFilter = (now = new Date()) => ({
  $or: [
    { isFlashDeal: true, flashDealEndTime: { $ne: null, $lte: now } },
    { isSpecialOffer: true, specialOfferEndTime: { $ne: null, $lte: now } },
    { isFlashDeal: { $ne: true }, isSpecialOffer: { $ne: true }, discount: { $gt: 0 } },
  ],
})

const CLEANUP_FIELDS = 'price compareAtPrice variants discount isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime updatedAt'

/**
 * اجرای پاک‌سازی روی دیتابیس. با updatedAt قفل خوش‌بینانه دارد تا اگر ادمین هم‌زمان
 * محصول را ذخیره کرد (یا در حالت cluster یک worker دیگر زودتر اعمال کرد)، چیزی بازنویسی نشود.
 *
 * @returns {Promise<{ scanned: number, modified: number }>}
 */
async function runPromotionCleanup(Product, { now = new Date(), batchSize = 500 } = {}) {
  const candidates = await Product.find(staleCandidatesFilter(now))
    .select(CLEANUP_FIELDS)
    .limit(batchSize)
    .lean()

  let modified = 0
  for (const doc of candidates) {
    const plan = planPromotionCleanup(doc, now)
    if (!plan) continue
    const update = { $set: plan.$set }
    if (Object.keys(plan.$unset).length) update.$unset = plan.$unset
    const filter = { _id: doc._id, updatedAt: doc.updatedAt === undefined ? null : doc.updatedAt }
    const res = await Product.updateOne(filter, update)
    modified += res.modifiedCount || 0
  }
  return { scanned: candidates.length, modified }
}

/**
 * غیرفعال‌سازی خودکار تخفیف‌های زمان‌دارِ منقضی (Sale / بخش مالی).
 * همه‌ی مسیرهای خواندن، Sale را با isActive + بازه‌ی زمانی فیلتر می‌کنند، اما تا وقتی
 * سندِ منقضی isActive=true بماند در پنل ادمین «فعال» دیده می‌شود و هر مسیر آینده‌ای که
 * فقط isActive را چک کند دوباره تخفیف را اعمال خواهد کرد. با غیرفعال‌کردن سندِ منقضی،
 * انقضا در سطح داده هم نهایی می‌شود و «منقضی شده اما فعال» دیگر اتفاق نمی‌افتد.
 *
 * @returns {Promise<number>} تعداد تخفیف‌های زمان‌داری که تازه غیرفعال شدند
 */
async function runSaleCleanup(Sale, { now = new Date() } = {}) {
  const result = await Sale.updateMany(
    { isActive: true, endDate: { $lte: now } },
    { $set: { isActive: false } },
  )
  // کمپین‌های خودکار مغز قیمت‌گذاری (autoManaged): منقضی‌ها غیرفعال و سبدهای خالی حذف می‌شوند؛
  // کمپین‌های دستی ادمین فقط در همان شاخه‌ی بالا غیرفعال می‌شوند و هرگز حذف نمی‌شوند.
  await cleanupEmptyAutoManagedSales(Sale, { now })
  return result.modifiedCount || 0
}

/**
 * غیرفعال‌سازی گروهی یک کمپین (flash | special) از پنل ادمین: فلگ خاموش، تایمر پاک و
 * تخفیف محصولات حذف می‌شود. اعضای تخفیف زمان‌دار (excludedIds) لمس نمی‌شوند.
 *
 * @returns {Promise<{ matched: number, modified: number }>}
 */
async function deactivateCampaign(Product, kind, { excludedIds = [] } = {}) {
  const flag = kind === 'flash' ? 'isFlashDeal' : 'isSpecialOffer'
  const filter = { [flag]: true }
  if (excludedIds.length) filter._id = { $nin: excludedIds }

  const docs = await Product.find(filter).select(CLEANUP_FIELDS).lean()
  if (docs.length === 0) return { matched: 0, modified: 0 }

  const ops = docs.map((doc) => ({
    updateOne: { filter: { _id: doc._id }, update: buildDeactivationUpdate(doc) },
  }))
  const res = await Product.bulkWrite(ops, { ordered: false })
  return { matched: docs.length, modified: res.modifiedCount || 0 }
}

/**
 * اعمال قاعده روی payload ساخت/ویرایش محصول (بعد از syncOfferTimers صدا زده شود).
 * - فعال‌سازی با زمان پایانِ گذشته رد می‌شود (error برمی‌گردد).
 * - اگر بعد از این ذخیره هیچ‌کدام از لحظه‌ای/شگفت‌انگیز زنده نباشد ⇒ فلگ‌ها خاموش، تایمرها
 *   پاک، discount = 0 و قیمت تخفیف‌خورده‌ی قدیمی به قیمت پایه برمی‌گردد.
 *
 * @param {object} updates   فیلدهایی که $set می‌شوند (mutate می‌شود)
 * @param {object} unset     فیلدهایی که $unset می‌شوند (mutate می‌شود)
 * @param {object} current   سند فعلی (برای ساخت محصول جدید: {})
 * @returns {{ error?: string, deactivated: boolean }}
 */
function applyOwnPromotionRules(updates, unset = {}, current = {}, now = new Date()) {
  const pick = (k) => (updates[k] !== undefined ? updates[k] : toPlain(current)?.[k])

  const flashFlag = pick('isFlashDeal') === true
  const specialFlag = pick('isSpecialOffer') === true
  const flashEnd = pick('flashDealEndTime') || null
  const specialEnd = pick('specialOfferEndTime') || null

  const isPast = (end) => {
    if (!end) return false
    const d = new Date(end)
    return Number.isNaN(d.getTime()) || d <= now
  }
  if (updates.isFlashDeal === true && isPast(flashEnd)) {
    return { error: 'زمان پایان پیشنهاد لحظه‌ای باید در آینده باشد.', deactivated: false }
  }
  if (updates.isSpecialOffer === true && isPast(specialEnd)) {
    return { error: 'زمان پایان شگفت‌انگیز باید در آینده باشد.', deactivated: false }
  }

  const flashLive = isTimerLive(flashFlag, flashEnd, now)
  const specialLive = isTimerLive(specialFlag, specialEnd, now)

  if (!flashLive) {
    updates.isFlashDeal = false
    updates.flashDealEndTime = null
  }
  if (!specialLive) {
    updates.isSpecialOffer = false
    updates.specialOfferEndTime = null
  }
  if (flashLive || specialLive) return { deactivated: false }

  // هیچ پیشنهادی زنده نیست ⇒ تخفیف از روی محصول برداشته می‌شود
  updates.discount = 0
  const storedDiscount = Number(toPlain(current)?.discount) || 0
  if (storedDiscount > 0) {
    const compareAtPrice = unset.compareAtPrice !== undefined ? null : pick('compareAtPrice')
    const legacy = buildLegacyBaseRestore(
      { price: pick('price'), compareAtPrice, variants: pick('variants') },
      storedDiscount,
    )
    Object.assign(updates, legacy.set)
    if (legacy.unset.compareAtPrice !== undefined) {
      delete updates.compareAtPrice
      unset.compareAtPrice = ''
    }
  }
  return { deactivated: true }
}

module.exports = {
  buildLegacyBaseRestore,
  buildDeactivationUpdate,
  planPromotionCleanup,
  staleCandidatesFilter,
  runPromotionCleanup,
  runSaleCleanup,
  deactivateCampaign,
  applyOwnPromotionRules,
}
