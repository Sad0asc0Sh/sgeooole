const mongoose = require('mongoose')

/**
 * آمار روزانه‌ی تعامل با فیلترها بدون شناسه‌ی کاربر (FacetStat)
 *
 * برای محاسبه‌ی `usage(f)` در ۲۸ روز اخیر (با حداقل ۲۰۰ نمایش برای جلوگیری
 * از اریب جایگاه) و پایش فیلترهای پرنتیجه‌ی صفر در گزارش کیفیت هفتگی.
 */
const FacetStatSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'day must be formatted as YYYY-MM-DD'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    attr: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    opens: {
      type: Number,
      default: 0,
      min: 0,
    },
    applies: {
      type: Number,
      default: 0,
      min: 0,
    },
    resultClicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    zeroResults: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
)

FacetStatSchema.index({ day: 1, category: 1, attr: 1 }, { unique: true })
FacetStatSchema.index({ category: 1, attr: 1, day: -1 })

module.exports = mongoose.models.FacetStat || mongoose.model('FacetStat', FacetStatSchema)
