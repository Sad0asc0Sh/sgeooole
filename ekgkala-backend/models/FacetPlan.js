const mongoose = require('mongoose')

/**
 * برنامه‌ی محاسبه‌شده‌ی آفلاین فست‌های هر دسته (FacetPlan)
 *
 * ماتریس همبستگی NMI آفلاین (`redundancy`) و بازه‌های عددی (`bins`) در سطح کل
 * دسته محاسبه و اینجا کش می‌شوند تا در هر درخواست آنلاین بدون بایاس نمونه‌ی کوچک
 * و بدون پرس‌وجوی اضافه مصرف شوند.
 */
const FacetPlanFieldSchema = new mongoose.Schema(
  {
    attr: { type: String, required: true, trim: true, lowercase: true },
    coverage: { type: Number, default: 0 },
    impurity: { type: Number, default: 0 },
    values: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    decision: {
      type: String,
      enum: ['open', 'visible', 'more', 'dropped'],
      default: 'visible',
    },
    reason: { type: String, default: '' },
  },
  { _id: false },
)

const FacetPlanGroupSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    attrs: [{ type: String, trim: true }],
  },
  { _id: false },
)

const FacetRedundancyPairSchema = new mongoose.Schema(
  {
    a: { type: String, required: true, trim: true, lowercase: true },
    b: { type: String, required: true, trim: true, lowercase: true },
    nmi: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
)

const FacetPlanSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    templateVersion: {
      type: Number,
      default: 1,
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
    stale: {
      type: Boolean,
      default: false,
    },
    productCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    fields: {
      type: [FacetPlanFieldSchema],
      default: [],
    },
    groups: {
      type: [FacetPlanGroupSchema],
      default: [],
    },
    redundancy: {
      type: [FacetRedundancyPairSchema],
      default: [],
    },
    bins: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
)

FacetPlanSchema.index({ category: 1 }, { unique: true })
FacetPlanSchema.index({ stale: 1, computedAt: 1 })

module.exports = mongoose.models.FacetPlan || mongoose.model('FacetPlan', FacetPlanSchema)
