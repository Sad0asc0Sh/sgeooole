const mongoose = require('mongoose')

// ============================================
// Schema برای کدهای تخفیف (Coupons)
// ============================================
const couponSchema = new mongoose.Schema(
  {
    // کد تخفیف، مثلاً: EID1404
    code: {
      type: String,
      required: [true, 'کد تخفیف الزامی است'],
      unique: true,
      trim: true,
      uppercase: true, // بهتر است کدها به حروف بزرگ تبدیل شوند
      index: true,
    },

    // نوع تخفیف: درصدی یا مبلغ ثابت
    discountType: {
      type: String,
      enum: ['percent', 'fixed'],
      required: [true, 'نوع تخفیف الزامی است'],
    },

    // مقدار تخفیف (مثلاً 20 برای 20٪ یا 50000 برای 50 هزار تومان)
    discountValue: {
      type: Number,
      required: [true, 'مقدار تخفیف الزامی است'],
      min: [0, 'مقدار تخفیف نمی‌تواند منفی باشد'],
    },

    // (اختیاری) حداقل خرید برای اعمال تخفیف
    minPurchase: {
      type: Number,
      default: 0,
      min: [0, 'حداقل خرید نمی‌تواند منفی باشد'],
    },

    // تاریخ انقضا
    expiresAt: {
      type: Date,
      required: [true, 'تاریخ انقضا الزامی است'],
      index: true,
    },

    // وضعیت فعال/غیرفعال
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // تعداد دفعات استفاده (اختیاری - برای آینده)
    usageLimit: {
      type: Number,
      default: null, // null = نامحدود
    },

    // تعداد دفعاتی که استفاده شده (اختیاری - برای آینده)
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Index ترکیبی برای جستجوی سریع‌تر
couponSchema.index({ code: 1, isActive: 1, expiresAt: 1 })

// متد برای بررسی اعتبار کوپن
couponSchema.methods.isValid = function () {
  if (!this.isActive) return false
  if (new Date() > this.expiresAt) return false
  if (this.usageLimit !== null && this.usageCount >= this.usageLimit) return false
  return true
}

// متد برای محاسبه تخفیف
couponSchema.methods.calculateDiscount = function (totalPrice) {
  if (!this.isValid()) return 0
  if (totalPrice < this.minPurchase) return 0

  if (this.discountType === 'percent') {
    const discount = (totalPrice * this.discountValue) / 100
    // حداکثر تخفیف درصدی نمی‌تواند بیشتر از مبلغ کل باشد
    return Math.min(discount, totalPrice)
  } else {
    // تخفیف ثابت
    return Math.min(this.discountValue, totalPrice)
  }
}

module.exports = mongoose.model('Coupon', couponSchema)
