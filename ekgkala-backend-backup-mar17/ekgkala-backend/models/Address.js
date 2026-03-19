const mongoose = require('mongoose')

/**
 * Address Schema
 * Stores user shipping addresses for checkout
 */
const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientName: {
      type: String,
      required: [true, 'نام گیرنده الزامی است'],
      trim: true,
    },
    recipientPhone: {
      type: String,
      required: [true, 'شماره تماس الزامی است'],
      trim: true,
    },
    province: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      required: [true, 'شهر الزامی است'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'آدرس کامل الزامی است'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'کد پستی الزامی است'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v)
        },
        message: 'کد پستی باید 10 رقم باشد',
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Index for faster queries
addressSchema.index({ user: 1, isDefault: -1 })

// Ensure only one default address per user
addressSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } },
    )
  }
  next()
})

const Address = mongoose.model('Address', addressSchema)

module.exports = Address
