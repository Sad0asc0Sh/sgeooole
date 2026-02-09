const mongoose = require('mongoose')

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: '',
    },
    image: {
      // می‌تواند رشته ساده (URL) یا آبجکت {url, public_id} باشد
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // برای هماهنگی با فرانت‌اند: homepage-slider, sidebar, product-page
    position: {
      type: String,
      default: 'homepage-slider',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

bannerSchema.index({ position: 1, isActive: 1 })

module.exports = mongoose.model('Banner', bannerSchema)

