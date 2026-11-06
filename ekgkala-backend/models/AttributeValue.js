const mongoose = require('mongoose')

/**
 * مقدارهای مجاز ویژگی‌های enum و multi (AttributeValue)
 *
 * جدا از AttributeDef نگهداری می‌شود تا ویژگی‌های پرگزینه (مثل برند یا نوع محصول)
 * سند دیکشنری را بزرگ نکنند و هر مقدار برچسب دوزبانه فنی+عامیانه و مترادف‌های
 * مستقل خود را داشته باشد.
 */
const AttributeValueSchema = new mongoose.Schema(
  {
    attr: {
      type: String,
      required: [true, 'Attribute key (attr) is required'],
      trim: true,
      lowercase: true,
      match: [/^[a-z][a-z0-9_]{0,63}$/, 'Attribute key must be snake_case ASCII'],
    },
    key: {
      type: String,
      required: [true, 'Attribute value key is required'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9][a-z0-9._-]{0,63}$/, 'Attribute value key must be ASCII slug or numeric token'],
    },
    label: {
      type: String,
      required: [true, 'Attribute value label is required'],
      trim: true,
      maxlength: 120,
    },
    aliases: [
      {
        type: String,
        trim: true,
      },
    ],
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

AttributeValueSchema.index({ attr: 1, key: 1 }, { unique: true })
AttributeValueSchema.index({ attr: 1, order: 1 })

module.exports = mongoose.models.AttributeValue || mongoose.model('AttributeValue', AttributeValueSchema)
