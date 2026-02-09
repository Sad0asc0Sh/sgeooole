const mongoose = require('mongoose')

const shippingMethodSchema = new mongoose.Schema(
  {
    // نام روش ارسال، مثل "پست پیشتاز"
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // نوع هزینه: ثابت، بر اساس آیتم، بر اساس وزن
    costType: {
      type: String,
      enum: ['fixed', 'per_item', 'weight_based'],
      default: 'fixed',
    },
    // هزینه پایه (یا هزینه اصلی)
    cost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('ShippingMethod', shippingMethodSchema)

