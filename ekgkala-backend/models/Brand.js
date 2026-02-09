const mongoose = require('mongoose')

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'نام برند الزامی است'],
      unique: true,
      trim: true,
      maxlength: [100, 'نام برند حداکثر 100 کاراکتر مجاز است'],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'توضیحات حداکثر 500 کاراکتر مجاز است'],
    },

    // Logo: همان معماری Cloudinary که برای دسته‌بندی‌ها استفاده شد
    logo: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
    },

    // نمایش در صفحه اصلی
    showOnHomepage: {
      type: Boolean,
      default: false,
    },

    // ترتیب نمایش در صفحه اصلی
    displayOrder: {
      type: Number,
      default: 0,
    },

    // رنگ متن برند (برای نمایش در صفحه اصلی)
    textColor: {
      type: String,
      default: '#6b7280', // خاکستری پیش‌فرض
    },

    // رنگ هاور برند
    hoverColor: {
      type: String,
      default: '#374151',
    },
  },
  {
    timestamps: true,
  },
)

// Pre-save hook: ساخت خودکار slug از name
brandSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('name') && this.slug) {
      return next()
    }

    const base = (this.name || '').toString().trim().toLowerCase()

    let slug = base
      .replace(/\s+/g, '-') // فضاهای خالی -> -
      .replace(/[^\p{L}\p{N}\-]+/gu, '') // فقط حروف، اعداد و - (Unicode)
      .replace(/-+/g, '-') // حذف - های تکراری
      .replace(/^-+/, '') // حذف - از ابتدا
      .replace(/-+$/, '') // حذف - از انتها

    // Fallback: اگر چیزی باقی نماند (مثلاً فقط سمبل)، از _id استفاده کن
    if (!slug) {
      slug = this._id ? this._id.toString() : new mongoose.Types.ObjectId().toString()
    }

    // یکتا سازی slug با suffix "-2", "-3", ...
    const Model = this.constructor
    let uniqueSlug = slug
    let suffix = 2

    // جستجوی slug تکراری (به جز خود این سند در حالت ویرایش)
    // eslint-disable-next-line no-constant-condition
    while (
      await Model.findOne({
        slug: uniqueSlug,
        _id: { $ne: this._id },
      })
        .select('_id')
        .lean()
    ) {
      uniqueSlug = `${slug}-${suffix}`
      suffix += 1
    }

    this.slug = uniqueSlug
    next()
  } catch (err) {
    next(err)
  }
})

module.exports = mongoose.model('Brand', brandSchema)
