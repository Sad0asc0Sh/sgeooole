/**
 * 📊 مدل ثبت رویداد فروش (Sales Event)
 * 
 * هر خرید، یک رویداد فروش ثبت می‌کند که برای محاسبه امتیازات
 * بخش پرفروش‌ترین‌ها استفاده می‌شود.
 */

const mongoose = require('mongoose')

const SalesEventSchema = new mongoose.Schema(
  {
    // ارجاع به محصول
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    // ارجاع به سفارش
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },

    // تعداد واحد فروخته‌شده
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // درآمد کل این فروش
    revenue: {
      type: Number,
      required: true,
      min: 0,
    },

    // حاشیه سود (درصد)
    // مثال: اگر هزینه 1000 و قیمت 1500 است، margin_pct = 33.33
    margin_pct: {
      type: Number,
      min: -100,
      max: 1000,
      default: 0,
    },

    // زمان فروش
    sold_at: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // زمان ایجاد رکورد (برای audit)
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
SalesEventSchema.index({ product_id: 1, sold_at: -1 })
SalesEventSchema.index({ sold_at: -1 }) // برای تحلیل‌های زمانی

module.exports = mongoose.model('SalesEvent', SalesEventSchema)
