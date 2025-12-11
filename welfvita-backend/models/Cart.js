const mongoose = require('mongoose')

// ============================================
// Schema برای آیتم‌های سبد خرید
// ============================================
const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  // برای محصولات متغیر - گزینه‌های انتخاب‌شده
  variantOptions: [
    {
      name: {
        type: String,
        trim: true,
      },
      value: {
        type: String,
        trim: true,
      },
    },
  ],
  // تصویر محصول (کپی از زمان افزودن به سبد)
  image: {
    type: String,
  },
})

// ============================================
// Schema اصلی سبد خرید (Cart)
// ============================================
const cartSchema = new mongoose.Schema(
  {
    // کاربر صاحب سبد
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // آیتم‌های سبد
    items: [cartItemSchema],

    // وضعیت سبد
    status: {
      type: String,
      enum: ['active', 'converted', 'abandoned', 'expired'],
      default: 'active',
      index: true,
    },

    // کد تخفیف اعمال شده (اختیاری)
    couponCode: {
      type: String,
      trim: true,
    },

    // مجموع قیمت
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // تاریخ انقضای سبد خرید (TTL - Time To Live)
    // اگر سبد خرید به مدت مشخصی بدون تغییر باشد، منقضی می‌شود
    expiresAt: {
      type: Date,
      index: true, // برای query های سریع
    },

    // آیا سبد خرید منقضی شده است؟
    isExpired: {
      type: Boolean,
      default: false,
      index: true,
    },

    // آیا هشدار انقضا ارسال شده است؟
    expiryWarningSent: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    // timestamps اهمیت حیاتی دارد
    // updatedAt به ما می‌گوید آخرین بار کاربر چه زمانی سبد را تغییر داده است
    timestamps: true,
  },
)

// Index ترکیبی برای پیدا کردن سبدهای رها شده
cartSchema.index({ status: 1, updatedAt: -1 })
cartSchema.index({ expiresAt: 1, isExpired: 1 }) // برای پاکسازی خودکار

// متد برای محاسبه مجموع قیمت
cartSchema.methods.calculateTotal = function () {
  this.totalPrice = this.items.reduce((total, item) => {
    return total + item.price * item.quantity
  }, 0)
  return this.totalPrice
}

// متد برای تنظیم زمان انقضا
cartSchema.methods.setExpiry = function (hours = 1) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
  this.isExpired = false
  return this.expiresAt
}

// متد برای بررسی انقضا
cartSchema.methods.checkExpiry = function () {
  if (this.expiresAt && new Date() > this.expiresAt && !this.isExpired) {
    this.isExpired = true
    return true
  }
  return this.isExpired
}

module.exports = mongoose.model('Cart', cartSchema)
