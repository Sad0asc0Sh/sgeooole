/**
 * 🧮 موتور محاسبه امتیاز بخش پرفروش‌ترین‌ها
 * 
 * این فایل منطق محاسبه امتیازات تمام محصولات را دارد:
 * - SalesScore: تعداد فروش (40%)
 * - ConversionScore: نرخ تبدیل (25%)
 * - RevenueScore: درآمد (15%)
 * - RatingScore: امتیاز (10%)
 * - TrendScore: روند (10%)
 */

const ProductScore = require('../models/ProductScore')
const SalesEvent = require('../models/SalesEvent')
const ProductView = require('../models/ProductView')
const Product = require('../models/Product')
const Review = require('../models/Review')

// ============================================
// نرمال‌سازی امتیازها
// ============================================

/**
 * نرمال‌سازی یک مقدار به بازه [0, 1]
 * @param {number} value - مقدار
 * @param {number} min - مینیمم
 * @param {number} max - ماکزیمم
 * @returns {number} مقدار نرمال‌شده
 */
function normalizeScore(value, min = 0, max = 1) {
  if (max === min) return 0
  const normalized = (value - min) / (max - min)
  return Math.max(0, Math.min(1, normalized)) // Clamp to [0, 1]
}

/**
 * استخراج percentile برای یک آرایه از مقادیر
 * @param {Array<number>} values - مقادیر
 * @param {number} percentile - صدک (0-100)
 * @returns {number} مقدار percentile
 */
function getPercentile(values, percentile) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

// ============================================
// محاسبه نمرات منفردی
// ============================================

/**
 * محاسبه SalesScore (40%)
 * بر اساس تعداد واحدهای فروخته‌شده در 30 روز اخیر
 * با وزن‌دهی نمایی (فروش‌های اخیر ارزش بیشتری دارند)
 */
async function calculateSalesScore() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const salesByProduct = await SalesEvent.aggregate([
    {
      $match: {
        sold_at: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: '$product_id',
        total_quantity: { $sum: '$quantity' },
        weighted_sales: {
          $sum: {
            $multiply: [
              '$quantity',
              {
                $exp: {
                  $multiply: [
                    -0.05,
                    {
                      $divide: [
                        {
                          $subtract: [
                            new Date(),
                            '$sold_at',
                          ],
                        },
                        1000 * 60 * 60 * 24, // تبدیل به روز
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  ])

  // پیدا کردن صدک 95 برای نرمال‌سازی
  const p95 = getPercentile(
    salesByProduct.map((s) => s.weighted_sales),
    95
  )

  const scoreMap = {}
  for (const sale of salesByProduct) {
    const normalized = normalizeScore(sale.weighted_sales, 0, p95)
    scoreMap[sale._id.toString()] = normalized
  }

  return scoreMap
}

/**
 * محاسبه ConversionScore (25%)
 * نرخ تبدیل = فروش / بازدید در 14 روز اخیر
 */
async function calculateConversionScore() {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  // تعداد بازدید برای هر محصول
  const viewsByProduct = await ProductView.aggregate([
    {
      $match: {
        viewed_at: { $gte: fourteenDaysAgo },
      },
    },
    {
      $group: {
        _id: '$product_id',
        view_count: { $sum: 1 },
      },
    },
  ])

  // تعداد فروش برای هر محصول (14 روز)
  const salesByProduct = await SalesEvent.aggregate([
    {
      $match: {
        sold_at: { $gte: fourteenDaysAgo },
      },
    },
    {
      $group: {
        _id: '$product_id',
        sale_count: { $sum: 1 },
      },
    },
  ])

  const salesMap = {}
  for (const sale of salesByProduct) {
    salesMap[sale._id.toString()] = sale.sale_count
  }

  // محاسبه CVR
  const p95CVR = getPercentile(
    viewsByProduct.map((v) => {
      const sales = salesMap[v._id.toString()] || 0
      return sales / Math.max(1, v.view_count)
    }),
    95
  )

  const scoreMap = {}
  for (const view of viewsByProduct) {
    const productId = view._id.toString()
    const sales = salesMap[productId] || 0
    const cvr = sales / Math.max(1, view.view_count)
    const normalized = normalizeScore(cvr, 0, p95CVR)
    scoreMap[productId] = normalized
  }

  return scoreMap
}

/**
 * محاسبه RevenueScore (15%)
 * درآمد فروش در 30 روز اخیر
 *
 * نکته: قبلاً درآمد در حاشیه سود ضرب می‌شد، اما margin_pct در تمام رویدادهای
 * فروش صفر ثبت می‌شود (داده‌ی هزینه در سیستم وجود ندارد)، پس weighted_revenue
 * همیشه صفر و این مؤلفه عملاً مرده بود. تا وقتی داده‌ی هزینه واقعی وصل نشده،
 * امتیاز فقط بر اساس خودِ درآمد محاسبه می‌شود.
 */
async function calculateRevenueScore() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const revenueByProduct = await SalesEvent.aggregate([
    {
      $match: {
        sold_at: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: '$product_id',
        total_revenue: { $sum: '$revenue' },
      },
    },
  ])

  const p95 = getPercentile(
    revenueByProduct.map((r) => r.total_revenue),
    95
  )

  const scoreMap = {}
  for (const revenue of revenueByProduct) {
    const normalized = normalizeScore(revenue.total_revenue, 0, p95)
    scoreMap[revenue._id.toString()] = normalized
  }

  return scoreMap
}

/**
 * محاسبه RatingScore (10%)
 * میانگین امتیاز × log(تعداد نظرات)
 */
async function calculateRatingScore() {
  // فیلد ارجاع به محصول در مدل Review، «product» است نه «product_id»؛ با نام
  // اشتباه، همه‌ی نظرات زیر _id=null گروه می‌شدند و این مؤلفه همیشه صفر بود.
  const reviewStats = await Review.aggregate([
    {
      $group: {
        _id: '$product',
        avg_rating: { $avg: '$rating' },
        review_count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 1,
        weighted_rating: {
          $multiply: [
            '$avg_rating',
            {
                $log: [{ $max: [2, '$review_count'] }, 10],
            },
          ],
        },
      },
    },
  ])

  const p95 = getPercentile(
    reviewStats.map((r) => r.weighted_rating),
    95
  )

  const scoreMap = {}
  for (const review of reviewStats) {
    const normalized = normalizeScore(review.weighted_rating, 0, p95)
    if (review._id) scoreMap[review._id.toString()] = normalized
  }

  return scoreMap
}

/**
 * محاسبه TrendScore (10%)
 * رشد فروش هفته اخیر نسبت به هفته قبل
 */
async function calculateTrendScore() {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const trendData = await SalesEvent.aggregate([
    {
      $match: {
        sold_at: { $gte: twoWeeksAgo },
      },
    },
    {
      $group: {
        _id: '$product_id',
        this_week_sales: {
          $sum: {
            $cond: [{ $gte: ['$sold_at', oneWeekAgo] }, '$quantity', 0],
          },
        },
        last_week_sales: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$sold_at', oneWeekAgo] },
                  { $gte: ['$sold_at', twoWeeksAgo] },
                ],
              },
              '$quantity',
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        trend: {
          $divide: [
            {
              $subtract: ['$this_week_sales', '$last_week_sales'],
            },
            { $max: ['$last_week_sales', 1] },
          ],
        },
      },
    },
  ])

  const p95 = getPercentile(
    trendData.map((t) => t.trend),
    95
  )

  const scoreMap = {}
  for (const trend of trendData) {
    // Clamp trend بین -1 و p95
    const clampedTrend = Math.max(-1, Math.min(trend.trend, p95))
    const normalized = normalizeScore(clampedTrend, -1, p95)
    scoreMap[trend._id.toString()] = normalized
  }

  return scoreMap
}

// ============================================
// محاسبه و بروزرسانی امتیازات تمام محصولات
// ============================================

// ضریب تازگی فروش: فروش امروز ≈ 1، فروش 30 روز پیش = 1/2، فروش 90 روز پیش = 1/4.
// فرمول قبلی (تقسیم بر (ساعت + 2)^1.8) امتیاز نهایی را آن‌قدر خرد می‌کرد
// (مرتبه‌ی 1e-6) که عملاً فقط «ساعتِ آخرین فروش» رتبه را تعیین می‌کرد و حجم
// فروش هیچ اثری نداشت؛ این ضریب کران‌دار، تازگی را مهم نگه می‌دارد ولی اجازه
// نمی‌دهد بر حجم فروش غلبه‌ی مطلق پیدا کند.
const RECENCY_WINDOW_DAYS = 30
// محصولی که هرگز فروش نداشته، همیشه پایین‌تر از هر محصولِ فروش‌رفته می‌ایستد.
const NEVER_SOLD_FACTOR = 0.02

function recencyFactor(lastSaleAt, now = new Date()) {
  if (!lastSaleAt) return NEVER_SOLD_FACTOR
  const ageDays = Math.max(0, (now.getTime() - new Date(lastSaleAt).getTime()) / (1000 * 60 * 60 * 24))
  return 1 / (1 + ageDays / RECENCY_WINDOW_DAYS)
}

function computeDecayedScore(finalScore, lastSaleAt, now = new Date()) {
  return Math.max(0, finalScore) * recencyFactor(lastSaleAt, now)
}

async function recalculateAllScores() {
  try {
    console.log('[BestSellers] شروع محاسبه امتیازات...')
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // محاسبه تمام نمرات + آمار تجمیعی هر محصول در چند کوئری یکجا (به‌جای
    // چند کوئری به‌ازای هر محصول)
    const [salesScores, conversionScores, revenueScores, ratingScores, trendScores, saleStats, lastSales, viewStats] =
      await Promise.all([
        calculateSalesScore(),
        calculateConversionScore(),
        calculateRevenueScore(),
        calculateRatingScore(),
        calculateTrendScore(),
        // واحدهای فروخته‌شده و درآمد 30 روز اخیر، به‌ازای هر محصول
        SalesEvent.aggregate([
          { $match: { sold_at: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: '$product_id',
              units: { $sum: '$quantity' },
              revenue: { $sum: '$revenue' },
            },
          },
        ]),
        // آخرین فروشِ هر محصول در تمام زمان‌ها (برای ضریب تازگی و last_sale_at)
        SalesEvent.aggregate([
          { $group: { _id: '$product_id', last_sale_at: { $max: '$sold_at' } } },
        ]),
        // بازدیدهای 14 روز اخیر، به‌ازای هر محصول
        ProductView.aggregate([
          { $match: { viewed_at: { $gte: fourteenDaysAgo } } },
          { $group: { _id: '$product_id', views: { $sum: 1 } } },
        ]),
      ])

    const saleStatsMap = {}
    for (const s of saleStats) saleStatsMap[s._id.toString()] = s
    const lastSaleMap = {}
    for (const s of lastSales) lastSaleMap[s._id.toString()] = s.last_sale_at
    const viewMap = {}
    for (const v of viewStats) viewMap[v._id.toString()] = v.views

    // دریافت تمام محصولات فعال
    // CRITICAL FIX: Product model uses 'isActive' (camelCase), not 'is_active' (snake_case)
    const allProducts = await Product.find(
      { isActive: true },
      { _id: 1, name: 1, average_rating: 1, rating: 1, createdAt: 1, stock: 1 }
    )

    let updated = 0
    let failed = 0

    for (const product of allProducts) {
      // خطای یک محصول نباید کل چرخه را متوقف و امتیاز بقیه را برای همیشه
      // فریز کند؛ خطا شمرده و لاگ می‌شود و محاسبه ادامه پیدا می‌کند.
      try {
        const productId = product._id.toString()

        // استخراج نمرات (یا 0 اگر موجود نیست)
        const sales = salesScores[productId] || 0
        const conversion = conversionScores[productId] || 0
        const revenue = revenueScores[productId] || 0
        const rating = ratingScores[productId] || 0
        const trend = trendScores[productId] || 0

        // محاسبه FinalScore
        const finalScore = sales * 0.4 + conversion * 0.25 + revenue * 0.15 + rating * 0.1 + trend * 0.1

        const lastSaleAt = lastSaleMap[productId] || null
        const stats = saleStatsMap[productId] || { units: 0, revenue: 0 }

        // محاسبه Boost برای محصولات جدید
        const createdAt = product.createdAt || now
        const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        const newProductBoost = ageInDays < 7 ? 0.15 : 0

        // محاسبه Penalty برای نرخ برگشت بالا
        const returnRate = await calculateReturnRate(product._id) // نیاز به پیاده‌سازی
        const highReturnPenalty = returnRate > 0.15 ? returnRate * 0.3 : 0

        // پیدا کردن یا ایجاد رکورد ProductScore
        await ProductScore.findOneAndUpdate(
          { product_id: product._id },
          {
            product_id: product._id,
            sales_score: sales,
            conversion_score: conversion,
            revenue_score: revenue,
            rating_score: rating,
            trend_score: trend,
            final_score: finalScore,
            decayed_score: computeDecayedScore(finalScore, lastSaleAt, now),
            last_sale_at: lastSaleAt,
            // مجموع واحدهای فروخته‌شده است، نه تعداد رویدادها (قبلاً با
            // countDocuments، تعداد سفارش‌ها شمرده می‌شد نه تعداد واحدها)
            total_units_sold: stats.units || 0,
            total_views_14d: viewMap[productId] || 0,
            return_rate: returnRate,
            avg_rating: product.rating || 0,
            stock_available: (product.stock || 0) > 0,
            is_new_product: ageInDays < 7,
            new_product_boost: newProductBoost,
            high_return_penalty: highReturnPenalty,
            last_calculated_at: now,
          },
          { upsert: true, new: true }
        )

        updated++
      } catch (productError) {
        failed++
        console.error(`[BestSellers] ❌ خطا در محاسبه محصول ${product._id}:`, productError.message)
      }
    }

    console.log(`[BestSellers] ✅ ${updated} محصول بروزرسانی شد${failed ? ` (${failed} خطا)` : ''}`)
    return updated
  } catch (error) {
    console.error('[BestSellers] ❌ خطا در محاسبه امتیازات:', error)
    throw error
  }
}

// ============================================
// محاسبه‌ی زمان‌بندی‌شده پس از ثبت فروش
// ============================================

// با ثبت هر فروش، یک محاسبه‌ی مجدد با تأخیر کوتاه زمان‌بندی می‌شود تا خرید
// جدید حداکثر ظرف حدود یک دقیقه در رتبه‌بندی دیده شود، نه حداکثر 30 دقیقه
// بعد (چرخه‌ی دوره‌ای سرور). فراخوانی‌های پشت‌سرهم در یک محاسبه ادغام
// می‌شوند و تایمر unref است تا جلوی خاموش‌شدن پردازه را نگیرد.
let recalcTimer = null
let recalcRunning = false

function scheduleRecalculation(delayMs = 60 * 1000) {
  if (recalcTimer) return
  recalcTimer = setTimeout(async () => {
    recalcTimer = null
    if (recalcRunning) {
      scheduleRecalculation(delayMs)
      return
    }
    recalcRunning = true
    try {
      await recalculateAllScores()
    } catch (error) {
      console.error('[BestSellers] ❌ خطا در محاسبه‌ی زمان‌بندی‌شده:', error.message)
    } finally {
      recalcRunning = false
    }
  }, delayMs)
  if (typeof recalcTimer.unref === 'function') recalcTimer.unref()
}

/**
 * محاسبه نرخ برگشت کالا برای یک محصول
 * (نیاز به پیاده‌سازی در RMA model)
 */
async function calculateReturnRate(productId) {
  // مثال سادge - بعداً بهتر پیاده‌سازی شود
  return 0
}

module.exports = {
  recalculateAllScores,
  scheduleRecalculation,
  computeDecayedScore,
  recencyFactor,
  calculateSalesScore,
  calculateConversionScore,
  calculateRevenueScore,
  calculateRatingScore,
  calculateTrendScore,
  normalizeScore,
}
