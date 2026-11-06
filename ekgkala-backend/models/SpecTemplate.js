const mongoose = require('mongoose')

/**
 * قالب مشخصات نسخه‌دار دسته‌بندی (SpecTemplate)
 *
 * به ازای هر دسته حداکثر یک نسخه‌ی `published` فعال است و زیرشاخه‌ها قالب‌های
 * منتشرشده را از ریشه تا برگ به ارث می‌برند. هر فیلد سه نقش مستقل (`table`،
 * `filter`، `card`، `compare`) دارد تا مشخصات جدولی سایدبار را شلوغ نکنند.
 */
const TemplateGroupSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    order: {
      type: Number,
      default: 10,
    },
    openByDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
)

const TemplateFieldRolesSchema = new mongoose.Schema(
  {
    table: { type: Boolean, default: true },
    filter: { type: Boolean, default: true },
    card: { type: Boolean, default: false },
    compare: { type: Boolean, default: true },
  },
  { _id: false },
)

const TemplateFieldSchema = new mongoose.Schema(
  {
    attr: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    group: {
      type: String,
      default: 'general',
      trim: true,
      lowercase: true,
    },
    order: {
      type: Number,
      default: 10,
    },
    required: {
      type: Boolean,
      default: false,
    },
    importance: {
      type: String,
      enum: ['pin', 'high', 'normal', 'low', 'hidden'],
      default: 'normal',
    },
    roles: {
      type: TemplateFieldRolesSchema,
      default: () => ({ table: true, filter: true, card: false, compare: true }),
    },
    widget: {
      type: String,
      enum: ['auto', 'chips', 'list', 'slider', 'toggle', 'search-list'],
      default: 'auto',
    },
    appliesWhen: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    dependsOn: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    bins: {
      type: [Number],
      default: null,
    },
  },
  { _id: false },
)

const SpecTemplateSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Template category is required'],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    groups: {
      type: [TemplateGroupSchema],
      default: [],
    },
    fields: {
      type: [TemplateFieldSchema],
      default: [],
    },
    changelog: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
)

SpecTemplateSchema.index({ category: 1, version: 1 }, { unique: true })
SpecTemplateSchema.index(
  { category: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'published' } },
)

module.exports = mongoose.models.SpecTemplate || mongoose.model('SpecTemplate', SpecTemplateSchema)
