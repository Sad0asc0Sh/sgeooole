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
const {
  resolveBasePrice,
  getEffectiveOwnDiscount,
  isTimerLive,
  getActiveSalesCampaignContext,
  priceVariantsForCard,
  ttlUntil,
} = require('../services/pricingService')
const redis = require('../utils/redis')

// TTL پیش‌فرض کش Redis پرفروش‌ترین‌ها؛ هنگام ذخیره تا نزدیک‌ترین پایان پروموشن کوتاه می‌شود
const BESTSELLERS_CACHE_TTL = 900

// ============================================
// قیمت‌گذاری (قرارداد مرکزی + تخفیف زمان‌دار)
// ============================================

// قرارداد مرکزی قیمت: مبنای تخفیف همیشه price است مگر داده‌ی قدیمیِ از قبل تخفیف‌خورده.
// تخفیف زمان‌دار (Sale / بخش مالی) درصد خودش را جایگزین می‌کند و فقط وقتی اینجا می‌رسد که
// فعال و در بازه‌ی زمانی باشد (getActiveSalesCampaignContext فقط همین‌ها را برمی‌گرداند).
// تخفیف خودِ محصول فقط وقتی اعمال می‌شود که پیشنهاد لحظه‌ای یا شگفت‌انگیز زنده باشد.
const buildPromotionPrice = (product, now = new Date(), activeSale = null) => {
  const storedDiscount = Number(product.discount) || 0
  const basePrice = resolveBasePrice(product.price, product.compareAtPrice, storedDiscount)

  if (activeSale && Number(activeSale.discount) > 0 && basePrice > 0) {
    const pct = Math.min(100, Number(activeSale.discount))
    return {
      price: Math.round(basePrice * (1 - pct / 100)),
      compareAtPrice: basePrice,
      discount: pct,
      promotionEndsAt: activeSale.endDate || null,
    }
  }

  const effectiveDiscount = getEffectiveOwnDiscount(product, now)
  const hasDiscount = basePrice > 0 && effectiveDiscount > 0 && effectiveDiscount < 100
  const flashLive = isTimerLive(product.isFlashDeal, product.flashDealEndTime, now)
  const specialLive = isTimerLive(product.isSpecialOffer, product.specialOfferEndTime, now)

  return {
    price: hasDiscount ? Math.round(basePrice * (1 - effectiveDiscount / 100)) : basePrice,
    compareAtPrice: hasDiscount ? basePrice : undefined,
    discount: effectiveDiscount,
    promotionEndsAt: flashLive
      ? product.flashDealEndTime || null
      : specialLive
        ? product.specialOfferEndTime || null
        : null,
  }
}

// تخفیف زمان‌دارِ فعالِ مرتبط با محصول: اولویت با انتساب مستقیمِ محصول است، سپس دسته‌بندی
// (منطبق بر productListingService/pricingService: انتساب مستقیم بر دسته‌بندی ترجیح دارد)
const resolveActiveSale = (product, salesContext) => {
  if (!product || !salesContext) return null
  const pid = product._id && product._id.toString()
  if (pid && salesContext.campaignMap && salesContext.campaignMap.has(pid)) {
    return salesContext.campaignMap.get(pid)
  }
  const category = product.category
  const cid = category && typeof category === 'object'
    ? (category._id ? category._id.toString() : null)
    : category
      ? category.toString()
      : null
  if (cid && salesContext.categoryDiscountMap && salesContext.categoryDiscountMap.has(cid)) {
    return salesContext.categoryDiscountMap.get(cid)
  }
  return null
}

// برچسب/تم کمپین و وضعیت زنده‌ی پروموشن برای خروجی کارت محصول
const buildPromotionBadges = (product, now, activeSale) => {
  const flashLive = isTimerLive(product.isFlashDeal, product.flashDealEndTime, now)
  const specialLive = activeSale ? true : isTimerLive(product.isSpecialOffer, product.specialOfferEndTime, now)

  return {
    isFlashDeal: flashLive,
    flashDealEndTime: flashLive ? product.flashDealEndTime : null,
    isSpecialOffer: specialLive,
    specialOfferEndTime: activeSale
      ? activeSale.endDate || null
      : specialLive ? product.specialOfferEndTime : null,
    campaignLabel: activeSale
      ? activeSale.name || 'پیشنهاد شگفت‌انگیز'
      : flashLive
        ? product.campaignLabel || 'پیشنهاد لحظه‌ای'
        : specialLive ? product.campaignLabel : null,
    campaignTheme: activeSale
      ? activeSale.theme || 'green-orange'
      : (flashLive || specialLive) ? product.campaignTheme : null,
  }
}

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

    // ساعت مبنای همین پاسخ + زمینه‌ی تخفیف‌های زمان‌دارِ فعال (Sale) برای همه‌ی آیتم‌ها
    const now = new Date()
    const salesContext = await getActiveSalesCampaignContext(now)

    // نزدیک‌ترین پایان پروموشن بین آیتم‌ها؛ TTL کش تا همین لحظه کوتاه می‌شود تا
    // قیمت/لیبل منقضی در کش باقی نماند.
    let soonestPromotionEnd = null
    const trackPromotionEnd = (end) => {
      if (!end) return
      const t = new Date(end).getTime()
      if (!Number.isFinite(t) || t <= now.getTime()) return
      if (!soonestPromotionEnd || t < soonestPromotionEnd) soonestPromotionEnd = t
    }

    // شکل‌دهی یکنواخت آیتم کارت برای هر ۴ مسیر (اصلی + ۳ fallback).
    // محصول متغیر بدون variants قابل نمایش درست نیست: قیمت سطح محصول برای آن
    // بی‌معناست، پس مدل‌های قیمت‌گذاری‌شده (با احترام به excludeFromPromotion)
    // و productType همیشه همراه آیتم فرستاده می‌شود تا کارت نماینده‌ی واقعی را
    // نشان دهد. موجودی محصول متغیر هم جمع موجودی مدل‌هاست (مثل pipeline لیست).
    const shapeBestsellerCard = (product, score) => {
      const activeSale = resolveActiveSale(product, salesContext)
      const promotionPrice = buildPromotionPrice(product, now, activeSale)
      trackPromotionEnd(promotionPrice.promotionEndsAt)
      const badges = buildPromotionBadges(product, now, activeSale)

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

      const storedVariants = Array.isArray(product.variants) ? product.variants : []
      const isVariable = product.productType === 'variable' || storedVariants.length > 0
      const variants = isVariable
        ? priceVariantsForCard(storedVariants, {
          discountPct: promotionPrice.discount,
          storedDiscount: Number(product.discount) || 0,
        })
        : []
      const cheapest = variants.length > 0
        ? variants.reduce((a, b) => ((b.price ?? Infinity) < (a.price ?? Infinity) ? b : a))
        : null

      return {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        image: imageData,
        price: cheapest ? cheapest.price : promotionPrice.price,
        discount: promotionPrice.discount,
        compareAtPrice: cheapest
          ? (promotionPrice.discount > 0 ? cheapest.compareAtPrice : undefined)
          : promotionPrice.compareAtPrice,
        isFlashDeal: badges.isFlashDeal,
        flashDealEndTime: badges.flashDealEndTime,
        isSpecialOffer: badges.isSpecialOffer,
        specialOfferEndTime: badges.specialOfferEndTime,
        campaignLabel: badges.campaignLabel,
        campaignTheme: badges.campaignTheme,
        productType: isVariable ? 'variable' : 'simple',
        variants,
        average_rating: product.rating || 0,
        review_count: product.numReviews || 0,
        stock: cheapest
          ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
          : (product.stock || 0),
        bestsellers_score: score,
        category: product.category,
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
          select: 'name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme productType variants',
          populate: {
            path: 'category',
            select: 'name slug',
          },
        })
        .lean()

      // تحویل محصولات در فرمت مورد نیاز Frontend
      result = bestsellers
        .filter((score) => score.product_id) // فیلتر محصولات حذف شده
        .map((score) => shapeBestsellerCard(score.product_id, {
          decayed_score: score.decayed_score,
          final_score: score.final_score,
          trend_score: score.trend_score,
          is_new: score.is_new_product,
          trend_up: score.trend_score > 0.5,
        }))

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
          .select('name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme productType variants')
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
          .select('name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme salesCount productType variants')
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
          .select('name slug images price discount compareAtPrice rating numReviews stock category isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel campaignTheme views productType variants')
          .populate('category', 'name slug')
          .lean()

        console.log(`[BestSellers] ⚠️ هیچ داده فروشی وجود ندارد - ${fallbackProducts.length} محصول از views/rating fallback`)
      }

      result = fallbackProducts.map((product) => shapeBestsellerCard(product, {
        decayed_score: 0,
        final_score: 0,
        trend_score: 0,
        is_new: false,
        trend_up: false,
      }))

      // شروع محاسبه امتیازات در پس‌زمینه (بدون بلاک کردن ریکوئست)
      recalculateAllScores().catch((err) => {
        console.error('[BestSellers] خطا در محاسبه اولیه امتیازات:', err.message)
      })
    }

    // ذخیره در کش: TTL پایه ۱۵ دقیقه است اما تا نزدیک‌ترین پایان پروموشن کوتاه می‌شود تا
    // تخفیف منقضی در کش باقی نماند. علاوه بر این، job چرخه‌ی عمر تخفیف‌ها هنگام
    // غیرفعال‌سازی هر پروموشن/Sale، کلیدهای bestsellers:* را هم باطل می‌کند.
    if (!bypassCache && redis && result.length > 0) {
      await redis.setCache(cacheKey, result, ttlUntil(soonestPromotionEnd, BESTSELLERS_CACHE_TTL, now))
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
