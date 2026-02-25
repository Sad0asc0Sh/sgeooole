/**
 * 📊 مدل امتیازدهی محصول (Product Scoring System)
 * 
 * این مدل برای محاسبه و ذخیره امتیازات هر محصول در سیستم
 * پرفروش‌ترین‌ها استفاده می‌شود.
 * 
 * فرمول نهایی:
 * FinalScore = (SalesScore × 0.40) + (ConversionScore × 0.25) + 
 *              (RevenueScore × 0.15) + (RatingScore × 0.10) + (TrendScore × 0.10)
 * DecayedScore = FinalScore / (age_hours + 2) ^ 1.8
 */

const mongoose = require('mongoose')

const ProductScoreSchema = new mongoose.Schema(
  {
    // ارجاع به محصول
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },

    // ============================================
    // سیگنال‌های تشکیل‌دهنده امتیاز
    // ============================================

    // 40% - تعداد واحدهای فروخته‌شده (30 روز اخیر)
    sales_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // 25% - نرخ تبدیل (فروش / بازدید)
    conversion_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // 15% - درآمد (مجموع × حاشیه سود)
    revenue_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // 10% - میانگین امتیاز × log(تعداد نظرات)
    rating_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // 10% - رشد فروش هفته اخیر نسبت به هفته قبل
    trend_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // ============================================
    // امتیازات نهایی
    // ============================================

    // امتیاز ترکیبی بدون اعمال Time Decay
    final_score: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },

    // امتیاز نهایی پس از اعمال Time Decay
    // (به صورت معکوس وابسته به زمان)
    decayed_score: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },

    // ============================================
    // متادیتای محاسبه
    // ============================================

    // زمان آخرین فروش این محصول
    last_sale_at: {
      type: Date,
      default: null,
    },

    // تعداد کل واحدهای فروخته‌شده
    total_units_sold: {
      type: Number,
      min: 0,
      default: 0,
    },

    // تعداد کل بازدید (14 روز اخیر)
    total_views_14d: {
      type: Number,
      min: 0,
      default: 0,
    },

    // نرخ برگشت کالا
    return_rate: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // میانگین امتیاز (از نظرات)
    avg_rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    // تعداد نظرات
    review_count: {
      type: Number,
      min: 0,
      default: 0,
    },

    // آیا محصول موجود است؟
    stock_available: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ============================================
    // Flags و مدیریت حالت‌های خاص
    // ============================================

    // آیا این محصول جدید است (کمتر از 7 روز)
    is_new_product: {
      type: Boolean,
      default: false,
    },

    // Boost برای محصولات جدید (Cold Start Problem)
    new_product_boost: {
      type: Number,
      min: 0,
      max: 0.3,
      default: 0,
    },

    // Penalty برای نرخ برگشت بالا
    high_return_penalty: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // ============================================
    // ترک‌کننده‌های زمانی
    // ============================================

    // آخرین بار محاسبه شده
    last_calculated_at: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // زمان ایجاد رکورد
    created_at: {
      type: Date,
      default: Date.now,
    },

    // زمان آخرین بروزرسانی
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
)

// Indexes برای جستجو و مرتب‌سازی بهینه
ProductScoreSchema.index({ decayed_score: -1, stock_available: 1 }) // محصولات موجود، مرتب‌شده بر اساس امتیاز
ProductScoreSchema.index({ stock_available: 1, decayed_score: -1 })
ProductScoreSchema.index({ last_calculated_at: 1 }) // برای پیدا کردن محصولاتی که نیاز به بروزرسانی دارند

// Method برای محاسبه decayed_score
ProductScoreSchema.methods.calculateDecayedScore = function () {
  if (this.last_sale_at) {
    const ageHours = (Date.now() - this.last_sale_at.getTime()) / (1000 * 60 * 60)
    this.decayed_score = this.final_score / Math.pow(ageHours + 2, 1.8)
  } else {
    // اگر هیچ فروشی نشده، امتیاز خیلی پایین است
    this.decayed_score = this.final_score * 0.1
  }
  return this.decayed_score
}

module.exports = mongoose.model('ProductScore', ProductScoreSchema)
