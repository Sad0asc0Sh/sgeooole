const mongoose = require('mongoose')

/**
 * دیکشنری سراسری ویژگی‌ها (AttributeDef)
 *
 * هر ویژگی در کل کاتالوگ یک سند با کلید ASCII تغییرناپذیر دارد (مثلاً `resolution_mp`)
 * تا تغییر برچسب فارسی هیچ لینک یا ایندکسی را نشکند و فیلترهای مشترک بین
 * زیرشاخه‌ها (در دسته‌ی والد) بر پایه‌ی همین کلید یکتا شناخته شوند.
 */
const AttributeUnitSchema = new mongoose.Schema(
  {
    canonical: { type: String, default: '' },
    label: { type: String, default: '' },
    aliases: [{ type: String, trim: true }],
  },
  { _id: false },
)

const AttributeNumericSchema = new mongoose.Schema(
  {
    discrete: { type: Boolean, default: false },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  { _id: false },
)

const AttributeDefSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Attribute key is required'],
      immutable: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z][a-z0-9_]{0,63}$/, 'Attribute key must be snake_case ASCII'],
    },
    label: {
      type: String,
      required: [true, 'Attribute label is required'],
      trim: true,
      maxlength: 120,
    },
    aliases: [
      {
        type: String,
        trim: true,
      },
    ],
    type: {
      type: String,
      enum: ['enum', 'number', 'boolean', 'multi', 'text'],
      default: 'enum',
    },
    scope: {
      type: String,
      enum: ['product', 'variant'],
      default: 'product',
    },
    unit: {
      type: AttributeUnitSchema,
      default: null,
    },
    numeric: {
      type: AttributeNumericSchema,
      default: null,
    },
    filterable: {
      type: Boolean,
      default: true,
    },
    allowNew: {
      type: String,
      enum: ['none', 'review', 'auto'],
      default: 'review',
    },
    status: {
      type: String,
      enum: ['active', 'deprecated'],
      default: 'active',
    },
    mergedInto: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    sourceCatalogSlug: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

AttributeDefSchema.index({ key: 1 }, { unique: true })
AttributeDefSchema.index({ status: 1, filterable: 1 })
AttributeDefSchema.index({ aliases: 1 })

module.exports = mongoose.models.AttributeDef || mongoose.model('AttributeDef', AttributeDefSchema)
