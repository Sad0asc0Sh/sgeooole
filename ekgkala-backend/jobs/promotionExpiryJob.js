const Product = require('../models/Product')
const { clearCacheByPrefix } = require('../middleware/cache')
const { runPromotionCleanup } = require('../services/promotionLifecycleService')

/**
 * غیرفعال‌سازی خودکار پیشنهاد لحظه‌ای / شگفت‌انگیز بعد از پایان تایمر.
 *
 * بدون این job، محصولِ منقضی در دیتابیس همچنان isFlashDeal/isSpecialOffer = true و
 * discount > 0 داشت؛ سایت با محاسبه‌ی زمان آن را مخفی می‌کرد اما پنل ادمین هنوز تیک
 * «فعال» و درصد تخفیف را نشان می‌داد. این job هر دقیقه همان وضعیت را در دیتابیس هم
 * اعمال می‌کند (فلگ خاموش، تایمر پاک، تخفیف صفر) تا پنل ادمین خودکار به‌روز باشد.
 * همچنین تخفیف‌های بی‌پشتوانه (discount > 0 بدون هیچ پیشنهاد فعال) را یک‌بار پاک می‌کند.
 *
 * تخفیف‌های زمان‌دار (Sale) را لمس نمی‌کند.
 */
const INTERVAL_MS = 60 * 1000
let running = false

const checkExpiredPromotions = async () => {
  if (running) return
  running = true
  try {
    const { scanned, modified } = await runPromotionCleanup(Product, { now: new Date() })
    if (scanned > 0) {
      // حتی اگر worker دیگری زودتر اعمال کرده باشد، کش همین پروسه هم باید تازه شود
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')
    }
    if (modified > 0) {
      console.log(`[PROMOTION-EXPIRY] ${modified} محصول: پیشنهاد لحظه‌ای/شگفت‌انگیز غیرفعال و تخفیف حذف شد.`)
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
