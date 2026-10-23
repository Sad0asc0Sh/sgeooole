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
      // می‌تواند رشته ساده (URL) یا آبجکت {url, public_id, width, height} باشد
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // تصویر مستقل موبایل (Art Direction) — اگر خالی باشد فرانت از تصویر دسکتاپ استفاده می‌کند
    mobileImage: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // متن جایگزین برای دسترسی‌پذیری و SEO
    alt: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    mobileAlt: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    // نحوهٔ جاگیری تصویر داخل کادر: پر کردن کامل یا نمایش کامل
    fit: {
      type: String,
      enum: ['cover', 'contain'],
      default: 'cover',
    },
    // باز شدن لینک در تب جدید (پیش‌فرض: همان تب)
    openInNewTab: {
      type: Boolean,
      default: false,
    },
    // برای هماهنگی با فرانت‌اند: main-slider, middle-banner, campaign-banner
    position: {
      type: String,
      default: 'main-slider',
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

bannerSchema.index({ position: 1, isActive: 1, sortOrder: 1 })

module.exports = mongoose.model('Banner', bannerSchema)

