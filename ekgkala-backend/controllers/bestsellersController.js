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
    const { limit = 8, category = null, in_stock = true, fresh = false, nocache = false } = req.query
    const bypassCache = fresh === true || fresh === 'true' || nocache === true || nocache === 'true'

    // ساخت کلید کش
    const cacheKey = `bestsellers:${category}:${in_stock}:${limit}`

    // بررسی کش؛ کارت‌های محصول زمان‌دار می‌توانند صریحاً دادهٔ تازه درخواست کنند.
    if (!bypassCache && redis) {
      const cached = await redis.getCache(cacheKey)
      if (cached) {
        console.log('[BestSellers] 📦 نتیجه از کش برگردانده شد')
        return res.json({
          success: true,
          data: JSON.parse(cached),
          source: 'cache',
        })
      }
    }

    // بررسی آیا ProductScore داده‌ای دارد
    const scoreCount = await ProductScore.countDocuments()

    let result = []

    // Product.price is the stored base price. Match the public product endpoint:
    // expose a discounted price plus the original compareAtPrice when a discount exists.
    const buildPromotionPrice = (product) => {
      const basePrice = Number(product.price) || 0
      const discount = Number(product.discount) || 0
      const hasDiscount = basePrice > 0 && discount > 0 && discount < 100

      return {
        price: hasDiscount ? Math.round(basePrice * (1 - discount / 100)) : basePrice,
        compareAtPrice: hasDiscount ? basePrice : product.compareAtPrice,
      }
    }

    if (scoreCount > 0) {
      // ===== مسیر اصلی: استفاده از ProductScore =====
      const query = {
        stock_available: in_stock === 'true' || in_stock === true,
      }

      // فیلتر دسته‌بندی (اگر مشخص شده باشد)
      if (category && category !== 'null') {
        query.category_id = category
      }

      // دریافت پرفروش‌ترین‌ها از ProductScore
      const bestsellers = await ProductScore.find(query)
        .sort({ decayed_score: -1 })
        .limit(parseInt(limit) || 8)
        .populate({
          path: 'product_id',
          select: 'name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme',
          populate: {
            path: 'category',
            select: 'name slug',
          },
        })
        .lean()

      // تحویل محصولات در فرمت مورد نیاز Frontend
      result = bestsellers
        .filter((score) => score.product_id) // فیلتر محصولات حذف شده
        .map((score) => {
          const product = score.product_id
          const promotionPrice = buildPromotionPrice(product)

          // Extract image URL from images array
          let imageData = null
          if (product.images && product.images.length > 0) {
            const img = product.images[0]
            if (typeof img === 'string') {
              imageData = img
            } else if (img && img.url) {
              imageData = img
            }
          }

          return {
            _id: product._id,
            name: product.name,
            slug: product.slug,
            image: imageData,
            price: promotionPrice.price,
            discount: product.discount || 0,
            compareAtPrice: promotionPrice.compareAtPrice,
            isFlashDeal: Boolean(product.isFlashDeal),
            flashDealEndTime: product.flashDealEndTime || null,
            isSpecialOffer: Boolean(product.isSpecialOffer),
            specialOfferEndTime: product.specialOfferEndTime || null,
            campaignLabel: product.campaignLabel || null,
            campaignTheme: product.campaignTheme || null,
            average_rating: product.rating || 0,
            review_count: product.numReviews || 0,
            stock: product.stock || 0,
            bestsellers_score: {
              decayed_score: score.decayed_score,
              final_score: score.final_score,
              trend_score: score.trend_score,
              is_new: score.is_new_product,
              trend_up: score.trend_score > 0.5,
            },
            category: product.category,
          }
        })

      console.log(`[BestSellers] ✅ ${result.length} محصول از ProductScore برگردانده شد`)
    } else {
      // ===== Fallback: ProductScore خالی است =====
      // ابتدا از SalesEvent استفاده می‌کنیم (داده‌های واقعی فروش)
      console.log('[BestSellers] ⚠️ ProductScore خالی است، استفاده از fallback')

      const parsedLimit = parseInt(limit) || 8

      // مرحله 1: سعی کن از SalesEvent واقعی استفاده کنی
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const topSellingProducts = await SalesEvent.aggregate([
        { $match: { sold_at: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$product_id',
            total_quantity: { $sum: '$quantity' },
            total_revenue: { $sum: '$revenue' },
            last_sale: { $max: '$sold_at' },
          },
        },
        { $sort: { total_quantity: -1 } },
        { $limit: parsedLimit * 2 }, // Get extra to filter
      ])

      let fallbackProducts = []

      if (topSellingProducts.length > 0) {
        // SalesEvent data exists - use it
        const productIds = topSellingProducts.map((s) => s._id)
        const stockFilter = (in_stock === 'true' || in_stock === true) ? { stock: { $gt: 0 } } : {}

        const products = await Product.find({
          _id: { $in: productIds },
          isActive: true,
          ...stockFilter,
        })
          .select('name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme')
          .populate('category', 'name slug')
          .lean()

        // Maintain the sales order
        const productMap = {}
        products.forEach((p) => { productMap[p._id.toString()] = p })

        fallbackProducts = topSellingProducts
          .filter((s) => productMap[s._id.toString()])
          .slice(0, parsedLimit)
          .map((s) => productMap[s._id.toString()])

        console.log(`[BestSellers] ✅ ${fallbackProducts.length} محصول از SalesEvent fallback`)
      }

      // مرحله 2: اگر SalesEvent هم خالی بود، از salesCount استفاده کن
      if (fallbackProducts.length === 0) {
        const productQuery = { isActive: true, salesCount: { $gt: 0 } }
        if (in_stock === 'true' || in_stock === true) {
          productQuery.stock = { $gt: 0 }
        }

        fallbackProducts = await Product.find(productQuery)
          .sort({ salesCount: -1 })
          .limit(parsedLimit)
          .select('name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme salesCount')
          .populate('category', 'name slug')
          .lean()

        console.log(`[BestSellers] ${fallbackProducts.length > 0 ? '✅' : '⚠️'} ${fallbackProducts.length} محصول از salesCount fallback`)
      }

      // مرحله 3: آخرین fallback - محصولات با بیشترین بازدید + امتیاز
      // این مرحله فقط وقتی اجرا می‌شود که هیچ داده فروشی وجود ندارد
      if (fallbackProducts.length === 0) {
        const productQuery = { isActive: true }
        if (in_stock === 'true' || in_stock === true) {
          productQuery.stock = { $gt: 0 }
        }

        fallbackProducts = await Product.find(productQuery)
          .sort({ views: -1, rating: -1 })
          .limit(parsedLimit)
          .select('name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme views')
          .populate('category', 'name slug')
          .lean()

        console.log(`[BestSellers] ⚠️ هیچ داده فروشی وجود ندارد - ${fallbackProducts.length} محصول از views/rating fallback`)
      }

      result = fallbackProducts.map((product) => {
        const promotionPrice = buildPromotionPrice(product)
        let imageData = null
        if (product.images && product.images.length > 0) {
          const img = product.images[0]
          if (typeof img === 'string') {
            imageData = img
          } else if (img && img.url) {
            imageData = img
          }
        }

        return {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          image: imageData,
          price: promotionPrice.price,
          discount: product.discount || 0,
          compareAtPrice: promotionPrice.compareAtPrice,
          isFlashDeal: Boolean(product.isFlashDeal),
          flashDealEndTime: product.flashDealEndTime || null,
          isSpecialOffer: Boolean(product.isSpecialOffer),
          specialOfferEndTime: product.specialOfferEndTime || null,
          campaignLabel: product.campaignLabel || null,
          campaignTheme: product.campaignTheme || null,
          average_rating: product.rating || 0,
          review_count: product.numReviews || 0,
          stock: product.stock || 0,
          bestsellers_score: {
            decayed_score: 0,
            final_score: 0,
            trend_score: 0,
            is_new: false,
            trend_up: false,
          },
          category: product.category,
        }
      })

      // شروع محاسبه امتیازات در پس‌زمینه (بدون بلاک کردن ریکوئست)
      recalculateAllScores().catch((err) => {
        console.error('[BestSellers] خطا در محاسبه اولیه امتیازات:', err.message)
      })
    }

    // ذخیره در کش (TTL: 15 دقیقه)، مگر آن‌که مصرف‌کننده دادهٔ تازه خواسته باشد.
    if (!bypassCache && redis && result.length > 0) {
      await redis.setCache(cacheKey, result, 900)
    }

    res.json({
      success: true,
      data: result,
      source: scoreCount > 0 ? 'scoring_engine' : 'fallback_salescount',
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
    await redis.deleteCachePattern('bestsellers:*')
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
