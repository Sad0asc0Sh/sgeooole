/**
 * 🏆 Controller برای بخش پرفروش‌ترین‌ها
 * 
 * Endpoints:
 * - GET /api/v1/products/bestsellers - دریافت پرفروش‌ترین‌ها
 * - POST /api/v1/tracking/impression - ثبت impression
 * - GET /api/v1/bestsellers/stats - آمار بخش (ادمین)
 */

const ProductScore = require('../models/ProductScore')
const Product = require('../models/Product')
const ProductView = require('../models/ProductView')
const SalesEvent = require('../models/SalesEvent')
const { recalculateAllScores } = require('../services/bestsellersScoreEngine')
const redis = require('../utils/redis')

// ============================================
// دریافت پرفروش‌ترین‌ها
// ============================================

exports.getBestsellers = async (req, res) => {
  try {
    const { limit = 8, category = null, in_stock = true, fresh = false } = req.query

    // ساخت کلید کش
    const cacheKey = `bestsellers:${category}:${in_stock}:${limit}`

    // بررسی کش (مگر اگر fresh=true)
    if (!fresh && redis) {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log('[BestSellers] 📦 نتیجه از کش برگردانده شد')
        return res.json({
          success: true,
          data: JSON.parse(cached),
          source: 'cache',
        })
      }
    }

    // Query پایه
    const query = {
      stock_available: in_stock === 'true' || in_stock === true,
    }

    // فیلتر دسته‌بندی (اگر مشخص شده باشد)
    if (category && category !== 'null') {
      query.category_id = category
    }

    // دریافت پرفروش‌ترین‌ها
    const bestsellers = await ProductScore.find(query)
      .sort({ decayed_score: -1 })
      .limit(parseInt(limit) || 8)
      .populate({
        path: 'product_id',
        select: 'name slug productCode sku image images price compareAtPrice discount isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme properties stock countInStock average_rating review_count variants category categoryPath brand',
        populate: {
          path: 'category',
          select: 'name slug',
        },
      })
      .lean()

    // تحویل محصولات در فرمت مورد نیاز Frontend
    const result = bestsellers.map((score) => {
      const product = score.product_id || {}
      return {
        ...product, // Include all fields mapped by product schema
        _id: product._id,
        bestsellers_score: {
          decayed_score: score.decayed_score,
          final_score: score.final_score,
          trend_score: score.trend_score,
          is_new: score.is_new_product,
          trend_up: score.trend_score > 0.5,
        }
      }
    })

    // ذخیره در کش (TTL: 15 دقیقه)
    if (redis) {
      await redis.setex(cacheKey, 900, JSON.stringify(result))
    }

    res.json({
      success: true,
      data: result,
      source: 'database',
      count: result.length,
    })
  } catch (error) {
    console.error('[BestSellers] ❌ خطا:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت پرفروش‌ترین‌ها',
      error: error.message,
    })
  }
}

// ============================================
// ثبت Impression (بازدید محصول)
// ============================================

exports.trackImpression = async (req, res) => {
  try {
    const { product_id, section = 'bestsellers', position = 0 } = req.body

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id الزامی است',
      })
    }

    // دریافت session_id از cookie یا header
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.ip

    // ثبت ProductView
    const view = new ProductView({
      product_id,
      session_id: sessionId,
      user_id: req.user?._id || null,
      source: section,
      position: position,
      viewed_at: new Date(),
    })

    await view.save()

    res.json({
      success: true,
      message: 'Impression ثبت شد',
    })
  } catch (error) {
    console.error('[BestSellers] ❌ خطا در ثبت Impression:', error)
    // خطاهای ردیابی نباید درخواست را شکست دهند
    res.status(200).json({
      success: true,
      message: 'Impression با خطا ثبت شد',
    })
  }
}

// ============================================
// ثبت رویداد فروش
// ============================================

exports.recordSaleEvent = async (req, res) => {
  try {
    const { product_id, order_id, quantity, revenue, margin_pct = 0 } = req.body

    if (!product_id || !quantity || !revenue) {
      return res.status(400).json({
        success: false,
        message: 'product_id، quantity و revenue الزامی هستند',
      })
    }

    // ثبت SalesEvent
    const saleEvent = new SalesEvent({
      product_id,
      order_id,
      quantity,
      revenue,
      margin_pct,
      sold_at: new Date(),
    })

    await saleEvent.save()

    // invalidate کش
    invalidateBestsellersCache()

    res.json({
      success: true,
      message: 'رویداد فروش ثبت شد',
    })
  } catch (error) {
    console.error('[BestSellers] ❌ خطا در ثبت فروش:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت رویداد فروش',
      error: error.message,
    })
  }
}

// ============================================
// آمار و Dashboard (ادمین)
// ============================================

exports.getBestsellerStats = async (req, res) => {
  try {
    // بررسی دسترسی ادمین
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'دسترسی رد شد',
      })
    }

    // تعداد محصولات در لیست
    const totalBestsellers = await ProductScore.countDocuments({ stock_available: true })

    // میانگین امتیاز
    const stats = await ProductScore.aggregate([
      {
        $match: { stock_available: true },
      },
      {
        $group: {
          _id: null,
          avg_final_score: { $avg: '$final_score' },
          avg_decayed_score: { $avg: '$decayed_score' },
          max_score: { $max: '$decayed_score' },
          min_score: { $min: '$decayed_score' },
        },
      },
    ])

    // توزیع بر اساس دسته‌بندی
    const categoryDistribution = await ProductScore.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      {
        $unwind: '$product',
      },
      {
        $match: { 'product.is_active': true },
      },
      {
        $group: {
          _id: '$product.category_id',
          count: { $sum: 1 },
          avg_score: { $avg: '$decayed_score' },
        },
      },
    ])

    // محصولات جدید در لیست
    const newProducts = await ProductScore.countDocuments({ is_new_product: true })

    // آخرین بروزرسانی
    const lastUpdate = await ProductScore.findOne().sort({ last_calculated_at: -1 }).lean()

    res.json({
      success: true,
      data: {
        totalBestsellers,
        stats: stats[0] || {},
        categoryDistribution,
        newProducts,
        lastCalculatedAt: lastUpdate?.last_calculated_at || null,
      },
    })
  } catch (error) {
    console.error('[BestSellers] ❌ خطا:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار',
      error: error.message,
    })
  }
}

// ============================================
// بروزرسانی دستی امتیازات (ادمین)
// ============================================

exports.recalculateScores = async (req, res) => {
  try {
    // بررسی دسترسی ادمین
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'دسترسی رد شد',
      })
    }

    // اجرای محاسبه امتیازات
    const updated = await recalculateAllScores()

    // invalidate کش
    invalidateBestsellersCache()

    res.json({
      success: true,
      message: `${updated} محصول بروزرسانی شد`,
      updated,
    })
  } catch (error) {
    console.error('[BestSellers] ❌ خطا:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در بروزرسانی امتیازات',
      error: error.message,
    })
  }
}

// ============================================
// توابع کمکی
// ============================================

/**
 * invalidate تمام کش‌های پرفروش‌ترین‌ها
 */
async function invalidateBestsellersCache() {
  if (!redis) return

  try {
    // پاک کردن تمام کلیدهای bestsellers:*
    const keys = await redis.keys('bestsellers:*')
    if (keys.length > 0) {
      await redis.del(keys)
      console.log(`[BestSellers] 🗑️ ${keys.length} کلید کش پاک شد`)
    }
  } catch (error) {
    console.error('[BestSellers] خطا در invalidate کش:', error)
  }
}

module.exports = {
  getBestsellers: exports.getBestsellers,
  trackImpression: exports.trackImpression,
  recordSaleEvent: exports.recordSaleEvent,
  getBestsellerStats: exports.getBestsellerStats,
  recalculateScores: exports.recalculateScores,
}
