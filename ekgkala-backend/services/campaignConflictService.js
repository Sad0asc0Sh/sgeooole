const mongoose = require('mongoose')
const Product = require('../models/Product')
const Sale = require('../models/Sale')

/**
 * تشخیص تداخل بین «تخفیف‌های زمان‌دار» (بخش مالی / مدل Sale) و کمپین‌هایی که
 * قبلاً توسط بخش‌های خودشان روی محصول فعال شده‌اند:
 *   - flash   : پیشنهاد لحظه‌ای  (Product.isFlashDeal)
 *   - special : شگفت‌انگیز        (Product.isSpecialOffer)
 *
 * یک محصول نباید همزمان در یکی از این دو کمپین و در یک تخفیف زمان‌دار باشد.
 */

const CAMPAIGN_LABELS = {
  flash: 'پیشنهاد لحظه‌ای',
  special: 'شگفت‌انگیز',
}

const toObjectId = (value) => {
  const raw = value && typeof value === 'object' && value._id ? value._id : value
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(String(raw)) : null
}

const uniqueObjectIds = (values = []) => {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const oid = toObjectId(value)
    if (oid && !seen.has(String(oid))) {
      seen.add(String(oid))
      result.push(oid)
    }
  }
  return result
}

// کمپین وقتی «فعال» است که فلگ روشن باشد و یا زمان پایان نداشته باشد یا پایانش بعد از `from` باشد.
const activeAfter = (flag, endField, from) => ({
  [flag]: true,
  $or: [{ [endField]: null }, { [endField]: { $gt: from } }],
})

/**
 * @param {Array} productIds  اگر خالی باشد همه محصولاتِ دارای کمپین فعال برگردانده می‌شوند
 * @param {Object} options
 * @param {Date}   options.windowStart  شروع بازه‌ی تخفیف زمان‌دار (اگر در آینده باشد، کمپین‌هایی که قبل از آن تمام می‌شوند تداخل حساب نمی‌شوند)
 * @param {Array}  options.exemptProductIds  محصولاتی که از بررسی مستثنی هستند (مثلاً اعضای فعلی همان تخفیف در حال ویرایش)
 * @param {Date}   options.now
 * @returns {Promise<Array<{productId:string,name:string,sku:string,conflicts:Array<{type:string,label:string,endTime:Date|null}>}>>}
 */
async function findProductCampaignConflicts(productIds = [], options = {}) {
  const now = options.now || new Date()
  const from = options.windowStart && options.windowStart > now ? options.windowStart : now
  const ids = uniqueObjectIds(productIds)
  const exempt = new Set(uniqueObjectIds(options.exemptProductIds || []).map(String))

  const filter = {
    $or: [activeAfter('isFlashDeal', 'flashDealEndTime', from), activeAfter('isSpecialOffer', 'specialOfferEndTime', from)],
  }
  if (productIds.length) {
    if (!ids.length) return []
    filter._id = { $in: ids }
  }

  const products = await Product.find(filter)
    .select('name sku isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime')
    .lean()

  const isLive = (flag, end) => Boolean(flag) && (!end || new Date(end) > from)

  return products
    .filter((p) => !exempt.has(String(p._id)))
    .map((p) => {
      const conflicts = []
      if (isLive(p.isFlashDeal, p.flashDealEndTime)) {
        conflicts.push({ type: 'flash', label: CAMPAIGN_LABELS.flash, endTime: p.flashDealEndTime || null })
      }
      if (isLive(p.isSpecialOffer, p.specialOfferEndTime)) {
        conflicts.push({ type: 'special', label: CAMPAIGN_LABELS.special, endTime: p.specialOfferEndTime || null })
      }
      return { productId: String(p._id), name: p.name, sku: p.sku || '', conflicts }
    })
    .filter((row) => row.conflicts.length > 0)
}

/**
 * محصولاتی که هم‌اکنون عضو یک تخفیف زمان‌دار ذخیره‌شده هستند (برای مستثنی‌کردن هنگام ویرایش).
 */
async function getSaleProductIds(saleId) {
  const oid = toObjectId(saleId)
  if (!oid) return []
  const sale = await Sale.findById(oid).select('products').lean()
  return (sale?.products || []).map(String)
}

/**
 * تخفیف‌های زمان‌دارِ فعال یا آینده که این محصول (مستقیم یا از طریق دسته‌بندی) عضو آن‌هاست.
 * برای جلوگیری از فعال‌کردن «لحظه‌ای/شگفت‌انگیز» روی محصولی که در تخفیف زمان‌دار است.
 */
async function findActiveSalesForProduct(productId, categoryId, now = new Date()) {
  const or = []
  const pid = toObjectId(productId)
  const cid = toObjectId(categoryId)
  if (pid) or.push({ products: pid })
  if (cid) or.push({ categories: cid })
  if (!or.length) return []
  return Sale.find({ isActive: true, endDate: { $gt: now }, $or: or }).select('name startDate endDate').lean()
}

/**
 * شناسه‌ی محصولاتی که عضو یک تخفیف زمان‌دارِ فعال یا آینده هستند:
 * عضویت مستقیم (آرایه‌ی products) یا از طریق دسته‌ی مستقیم (آرایه‌ی categories).
 * برای عملیات گروهی (مثل «تایمر گروهی» شگفت‌انگیز/لحظه‌ای) استفاده می‌شود تا
 * تایمرِ کمپین مالی به‌اشتباه روی اعضای تخفیف زمان‌دار اعمال نشود.
 *
 * محدودیت آگاهانه: زیردسته‌ها (includeSubcategories) در اینجا گسترش داده نمی‌شوند؛
 * یعنی محصولی که فقط از طریق زیردسته‌ی یک تخفیف عضو است، از این فهرست جا می‌ماند
 * (اما با همان منطق، تغییر تایمر گروهی روی او اثر «عضویتی» جدیدی ایجاد نمی‌کند).
 */
async function getSaleMemberProductIds(now = new Date()) {
  const sales = await Sale.find({ isActive: true, endDate: { $gt: now } }, 'products categories').lean()
  const directIds = []
  const categoryIds = []
  for (const sale of sales || []) {
    for (const p of sale.products || []) directIds.push(p)
    for (const c of sale.categories || []) categoryIds.push(c)
  }
  const or = []
  if (directIds.length) or.push({ _id: { $in: uniqueObjectIds(directIds) } })
  if (categoryIds.length) or.push({ category: { $in: uniqueObjectIds(categoryIds) } })
  if (!or.length) return []
  const rows = await Product.find({ $or: or }, '_id').lean()
  return uniqueObjectIds(rows.map((r) => r._id))
}

/**
 * پیام خوانا برای پاسخ 409
 */
function buildConflictMessage(conflicts) {
  const names = conflicts.slice(0, 5).map((row) => {
    const labels = row.conflicts.map((c) => c.label).join(' و ')
    return `«${row.name}» (${labels})`
  })
  const more = conflicts.length > 5 ? ` و ${conflicts.length - 5} محصول دیگر` : ''
  return `این محصولات قبلاً در کمپین دیگری فعال شده‌اند و نمی‌توانند در تخفیف زمان‌دار قرار بگیرند: ${names.join('، ')}${more}`
}

module.exports = {
  CAMPAIGN_LABELS,
  findProductCampaignConflicts,
  findActiveSalesForProduct,
  getSaleProductIds,
  getSaleMemberProductIds,
  buildConflictMessage,
  uniqueObjectIds,
}
