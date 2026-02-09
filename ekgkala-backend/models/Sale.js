const mongoose = require('mongoose')

const saleSchema = new mongoose.Schema(
  {
    name: {
      // نام تخفیف، مثلاً: "فروش ویژه عید"
      type: String,
      required: [true, 'نام تخفیف الزامی است'],
      trim: true,
    },
    discountPercentage: {
      // درصد تخفیف
      type: Number,
      required: [true, 'درصد تخفیف الزامی است'],
      min: [1, 'درصد تخفیف باید حداقل ۱ درصد باشد'],
      max: [99, 'درصد تخفیف باید حداکثر ۹۹ درصد باشد'],
    },
    startDate: {
      // تاریخ شروع تخفیف (تایمر)
      type: Date,
      required: [true, 'تاریخ شروع تخفیف الزامی است'],
    },
    endDate: {
      // تاریخ پایان تخفیف (تایمر)
      type: Date,
      required: [true, 'تاریخ پایان تخفیف الزامی است'],
    },
    // اتصال به محصولاتی که شامل این تخفیف می‌شوند
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // ارجاع به مدل محصول
      },
    ],
    // اتصال به دسته‌بندی‌هایی که شامل این تخفیف می‌شوند (همه محصولات آن دسته تخفیف می‌گیرند)
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    // آیا این تخفیف شامل زیردسته‌های انتخاب شده هم می‌شود؟
    includeSubcategories: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    badgeTheme: {
      type: String,
      enum: ['green-orange', 'gold-red', 'red-purple'],
      default: 'green-orange',
    },
  },
  { timestamps: true },
)

// Validation: endDate باید بعد از startDate باشد
saleSchema.pre('save', function (next) {
  if (this.endDate <= this.startDate) {
    return next(new Error('تاریخ پایان باید بعد از تاریخ شروع باشد'))
  }
  next()
})

// ایندکس برای جستجوی سریع تخفیف‌های فعال
saleSchema.index({ isActive: 1, startDate: 1, endDate: 1 })
saleSchema.index({ categories: 1 })

module.exports = mongoose.model('Sale', saleSchema)
