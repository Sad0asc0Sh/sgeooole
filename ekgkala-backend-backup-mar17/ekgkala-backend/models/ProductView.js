/**
 * 👁️ مدل ثبت بازدید محصول (Product View)
 * 
 * هر بار که کاربر صفحه محصول را ببیند یا محصول در بخش
 * پرفروش‌ترین‌ها نمایش داده شود، یک رویداد ثبت می‌شود.
 */

const mongoose = require('mongoose')

const ProductViewSchema = new mongoose.Schema(
  {
    // ارجاع به محصول
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    // شناسه جلسه کاربر (برای ردیابی غیرفردی)
    session_id: {
      type: String,
      index: true,
    },

    // شناسه کاربر (اگر لاگین کرده باشد)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
      index: true,
    },

    // منبع بازدید (محصول، جستجو، پیشنهاد، بنر، پرفروش‌ترین‌ها و...)
    source: {
      type: String,
      enum: [
        'product_page',
        'search',
        'recommendation',
        'banner',
        'bestsellers',
        'category',
        'flash_sale',
        'direct',
        'other',
      ],
      default: 'direct',
    },

    // موقعیت در لیست (برای بخش پرفروش‌ترین‌ها)
    position: {
      type: Number,
      min: 1,
    },

    // آیا محصول در Viewport دیده شد
    was_visible: {
      type: Boolean,
      default: true,
    },

    // مدت زمان نگاه کردن به محصول (بر حسب ثانیه)
    dwell_time_seconds: {
      type: Number,
      min: 0,
      default: 0,
    },

    // آیا کاربر روی لینک محصول کلیک کرد
    clicked: {
      type: Boolean,
      default: false,
    },

    // زمان بازدید
    viewed_at: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // زمان ایجاد
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  }
)

// Indexes برای جستجو‌های بهینه
ProductViewSchema.index({ product_id: 1, viewed_at: -1 })
ProductViewSchema.index({ viewed_at: -1 })
ProductViewSchema.index({ session_id: 1, viewed_at: -1 }) // برای ردیابی جلسات

module.exports = mongoose.model('ProductView', ProductViewSchema)
