const mongoose = require('mongoose')

/**
 * صف بازبینی برچسب‌ها و مقادیر ناشناخته (SpecReview)
 *
 * جایگزین امن افزودن کورکورانه‌ی تایپوها به فیلترهای سایدبار: هر برچسب یا مقدار
 * ناشناخته همراه با نزدیک‌ترین پیشنهاد دیکشنری و ضریب اطمینان ثبت می‌شود تا با
 * یک تصمیم ادمین برای همه‌ی محصولات متأثر تعیین تکلیف شود.
 */
const SpecReviewSuggestionSchema = new mongoose.Schema(
  {
    attr: { type: String, default: null, trim: true, lowercase: true },
    valueKey: { type: String, default: null, trim: true, lowercase: true },
    conf: { type: Number, default: 0, min: 0, max: 1 },
  },
  { _id: false },
)

const SpecReviewResolutionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['alias', 'new_value', 'new_attr', 'table_only', null],
      default: null,
    },
    targetAttr: { type: String, default: null, trim: true, lowercase: true },
    targetValueKey: { type: String, default: null, trim: true, lowercase: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { _id: false },
)

const SpecReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    rawKey: {
      type: String,
      required: [true, 'rawKey is required'],
      trim: true,
      maxlength: 200,
    },
    rawValue: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    suggestion: {
      type: SpecReviewSuggestionSchema,
      default: () => ({ attr: null, valueKey: null, conf: 0 }),
    },
    resolution: {
      type: SpecReviewResolutionSchema,
      default: () => ({ action: null, targetAttr: null, targetValueKey: null, resolvedBy: null, resolvedAt: null }),
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'ignored'],
      default: 'open',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

SpecReviewSchema.index({ status: 1, rawKey: 1 })
SpecReviewSchema.index({ category: 1, status: 1 })
SpecReviewSchema.index({ product: 1 })

module.exports = mongoose.models.SpecReview || mongoose.model('SpecReview', SpecReviewSchema)
