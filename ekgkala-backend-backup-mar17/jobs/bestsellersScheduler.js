/**
 * ⏰ Cron Job برای محاسبه دوره‌ای امتیازات پرفروش‌ترین‌ها
 * 
 * زمان‌بندی:
 * - هر 30 دقیقه: محاسبه دوباره تمام امتیازات
 * - هر 6 ساعت: پاک‌کردی کش‌های قدیمی
 * - هر روز: لاگ و backup امتیازات
 */

const cron = require('node-cron')
const { recalculateAllScores } = require('../services/bestsellersScoreEngine')
const ProductScore = require('../models/ProductScore')
const logger = require('../utils/logger')

// ============================================
// کار اصلی: محاسبه امتیازات هر 30 دقیقه
// ============================================

const calculateScoresJob = cron.schedule('*/30 * * * *', async () => {
  try {
    logger.info('[BestSellers Cron] شروع محاسبه امتیازات')
    const startTime = Date.now()

    await recalculateAllScores()

    const duration = Date.now() - startTime
    logger.info(`[BestSellers Cron] ✅ محاسبه تمام شد (${duration}ms)`)
  } catch (error) {
    logger.error('[BestSellers Cron] ❌ خطا:', error)
  }
})

// ============================================
// کار دوم: پاک‌کردی کش‌های قدیمی
// ============================================

const cleanupCacheJob = cron.schedule('0 */6 * * *', async () => {
  try {
    logger.info('[BestSellers Cleanup] شروع پاک‌کردی کش')

    const redis = require('../utils/redis')
    if (!redis) {
      logger.warn('[BestSellers Cleanup] Redis در دسترس نیست')
      return
    }

    const keys = await redis.keys('bestsellers:*')
    if (keys.length > 0) {
      await redis.del(keys)
      logger.info(`[BestSellers Cleanup] ✅ ${keys.length} کلید پاک شد`)
    }
  } catch (error) {
    logger.error('[BestSellers Cleanup] ❌ خطا:', error)
  }
})

// ============================================
// کار سوم: لاگ و آمار روزانه
// ============================================

const dailyStatsJob = cron.schedule('0 0 * * *', async () => {
  try {
    logger.info('[BestSellers Daily Stats] شروع آمار روزانه')

    const totalScores = await ProductScore.countDocuments()
    const avgScore = await ProductScore.aggregate([
      {
        $group: {
          _id: null,
          avg: { $avg: '$decayed_score' },
        },
      },
    ])

    const stats = {
      totalProducts: totalScores,
      avgScore: avgScore[0]?.avg || 0,
      timestamp: new Date(),
    }

    logger.info(`[BestSellers Daily Stats] ✅ ${totalScores} محصول با میانگین ${stats.avgScore.toFixed(4)}`)

    // ذخیره آمار (اختیاری - برای تحلیل)
    // await saveStats(stats)
  } catch (error) {
    logger.error('[BestSellers Daily Stats] ❌ خطا:', error)
  }
})

// ============================================
// شروع تمام کارها
// ============================================

function startBestsellersJobs() {
  logger.info('[BestSellers Cron] شروع Jobs')
  // calculateScoresJob.start()
  // cleanupCacheJob.start()
  // dailyStatsJob.start()
}

// ============================================
// توقف تمام کارها
// ============================================

function stopBestsellersJobs() {
  logger.info('[BestSellers Cron] توقف Jobs')
  calculateScoresJob.stop()
  cleanupCacheJob.stop()
  dailyStatsJob.stop()
}

module.exports = {
  startBestsellersJobs,
  stopBestsellersJobs,
  calculateScoresJob,
  cleanupCacheJob,
  dailyStatsJob,
}
