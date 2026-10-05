const Product = require('../models/Product')
const Sale = require('../models/Sale')
const { clearCacheByPrefix } = require('../middleware/cache')
const { runPromotionCleanup, runSaleCleanup } = require('../services/promotionLifecycleService')
const redis = require('../utils/redis')

/**
 * غیرفعال‌سازی خودکار تخفیف‌ها بعد از پایان زمانشان (هر ۶۰ ثانیه).
 *
 * ۱) پیشنهاد لحظه‌ای / شگفت‌انگیزِ خودِ محصول: فلگ خاموش، تایمر پاک و تخفیف صفر می‌شود
 *    (با بازیابی قیمت پایه برای داده‌ی قدیمی) تا نه سایت و نه پنل ادمین تخفیفِ منقضی را
 *    «فعال» نشان ندهند. تخفیف‌های بی‌پشتوانه (discount > 0 بدون پیشنهاد فعال) هم پاک می‌شوند.
 * ۲) تخفیف زمان‌دار (Sale / بخش مالی): سندِ منقضی isActive=false می‌شود تا انقضا در سطح
 *    داده هم نهایی شود؛ در پنل ادمین دیگر «فعال» دیده نمی‌شود و اگر مسیر آینده‌ای فقط
 *    isActive را چک کند، تخفیف منقضی برنمی‌گردد.
 *
 * بعد از هر تغییری، کش محصولات (node-cache) و کش Redis پرفروش‌ترین‌ها باطل می‌شود تا
 * قیمت/لیبل منقضی در هیچ خروجی‌ای بیش از چند ثانیه باقی نماند.
 */
const INTERVAL_MS = 60 * 1000
let running = false

const invalidateBestsellersCache = async () => {
  if (!redis || typeof redis.deleteCachePattern !== 'function') return
  try {
    await redis.deleteCachePattern('bestsellers:*')
  } catch (error) {
    console.warn('[PROMOTION-EXPIRY] Could not invalidate bestsellers cache:', error.message)
  }
}

const checkExpiredPromotions = async () => {
  if (running) return
  running = true
  try {
    const now = new Date()
    const { scanned, modified } = await runPromotionCleanup(Product, { now })
    const deactivatedSales = await runSaleCleanup(Sale, { now })

    if (scanned > 0 || deactivatedSales > 0) {
      // حتی اگر worker دیگری زودتر اعمال کرده باشد، کش همین پروسه هم باید تازه شود
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')
      await invalidateBestsellersCache()
    }
    if (modified > 0) {
      console.log(`[PROMOTION-EXPIRY] ${modified} محصول: پیشنهاد لحظه‌ای/شگفت‌انگیز غیرفعال و تخفیف حذف شد.`)
    }
    if (deactivatedSales > 0) {
      console.log(`[PROMOTION-EXPIRY] ${deactivatedSales} تخفیف زمان‌دارِ منقضی غیرفعال شد.`)
    }
  } catch (error) {
    console.error('[PROMOTION-EXPIRY] Error while deactivating expired promotions:', error.message)
  } finally {
    running = false
  }
}

const startPromotionExpiryJob = () => {
  console.log('Promotion Expiry Job Started')
  checkExpiredPromotions()
  setInterval(checkExpiredPromotions, INTERVAL_MS)
}

module.exports = { startPromotionExpiryJob, checkExpiredPromotions }
