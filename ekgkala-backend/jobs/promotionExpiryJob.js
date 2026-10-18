const Product = require('../models/Product')
const Sale = require('../models/Sale')
const { clearCacheByPrefix } = require('../middleware/cache')
const { runPromotionCleanup, runSaleCleanup } = require('../services/promotionLifecycleService')
const {
  MANAGED_EXACT_FLOOR_WARN_AGE_DAYS,
  MANAGED_EXACT_FLOOR_MAX_AGE_DAYS,
} = require('../services/pricingService')

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
 * بعد از هر تغییری، کش محصولات باطل می‌شود؛ clearCacheByPrefix برای prefix محصولات،
 * کش Redis پرفروش‌ترین‌ها را هم باطل می‌کند تا قیمت/لیبل منقضی در هیچ خروجی‌ای نماند.
 */
const INTERVAL_MS = 60 * 1000
const FLOOR_WARN_INTERVAL_MS = 60 * 60 * 1000
let running = false
let lastFloorWarnAt = 0

/**
 * ۴.۱.۲ (N5): هشدار پیش از خاموش‌شدن گارد کف قطعی.
 * اگر sync ترب بیش از آستانه‌ی هشدار (پیش‌فرض ۷ روز) متوقف شود، کف قدیمی می‌شود و
 * پس از MANAGED_EXACT_FLOOR_MAX_AGE_DAYS (پیش‌فرض ۱۴ روز) گارد fail-closed خاموش
 * می‌شود؛ آن‌وقت نمایش به سقف معیار برمی‌گردد. این تابع فقط لاگ هشدار می‌دهد
 * (یک‌بار در ساعت) تا اپراتور پیش از رسیدن به مرز، sync را تازه کند.
 */
const warnAgingManagedFloors = async (now = new Date()) => {
  if (Date.now() - lastFloorWarnAt < FLOOR_WARN_INTERVAL_MS) return
  lastFloorWarnAt = Date.now()
  try {
    const warnCutoff = new Date(now.getTime() - MANAGED_EXACT_FLOOR_WARN_AGE_DAYS * 86_400_000)
    const maxCutoff = new Date(now.getTime() - MANAGED_EXACT_FLOOR_MAX_AGE_DAYS * 86_400_000)
    const [aging, expired] = await Promise.all([
      Product.countDocuments({
        'pricingMeta.exactFloorPrice': { $gt: 0 },
        'pricingMeta.exactFloorPriceAt': { $lte: warnCutoff, $gt: maxCutoff },
      }),
      Product.countDocuments({
        'pricingMeta.exactFloorPrice': { $gt: 0 },
        'pricingMeta.exactFloorPriceAt': { $lte: maxCutoff },
      }),
    ])
    if (aging > 0 || expired > 0) {
      console.warn(
        `[PRICING-FLOOR] ${aging} محصول کف قطعی بین ${MANAGED_EXACT_FLOOR_WARN_AGE_DAYS} تا ${MANAGED_EXACT_FLOOR_MAX_AGE_DAYS} روز است و ${expired} محصول از مرز ${MANAGED_EXACT_FLOOR_MAX_AGE_DAYS} روز گذشته (گارد کف خاموش). sync ترب را اجرا کنید.`,
      )
    }
  } catch (error) {
    console.error('[PRICING-FLOOR] خطا در شمارش کف‌های کهنه:', error.message)
  }
}

const checkExpiredPromotions = async () => {
  if (running) return
  running = true
  try {
    const now = new Date()
    const { scanned, modified } = await runPromotionCleanup(Product, { now })
    const deactivatedSales = await runSaleCleanup(Sale, { now })
    await warnAgingManagedFloors(now)

    if (scanned > 0 || deactivatedSales > 0) {
      // حتی اگر worker دیگری زودتر اعمال کرده باشد، کش همین پروسه هم باید تازه شود
      // (برای prefix محصولات، کش Redis پرفروش‌ترین‌ها هم خودکار باطل می‌شود)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')
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
