const mongoose = require('mongoose')

// ============================================
// Schema برای یک متغیر محصول (Product Variant)
// ============================================
const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // گزینه‌های این متغیر (مثل: [{name: 'رنگ', value: 'آبی'}, {name: 'سایز', value: 'L'}])
    options: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    // تصاویر اختصاصی این متغیر
    images: [
      {
        url: { type: String },
        public_id: { type: String },
      },
    ],
  },
  { _id: true },
)

// ============================================
// Schema برای یک ویژگی محصول (Product Attribute)
// ============================================
const attributeSchema = new mongoose.Schema(
  {
    // نام ویژگی (مثلاً: 'رنگ' یا 'سایز')
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // مقادیر ممکن این ویژگی (مثلاً: ['آبی', 'قرمز', 'سبز'])
    values: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { _id: false },
)

// ============================================
// Schema اصلی محصول (Product)
// ============================================
const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    // ============================================
    // نوع محصول: ساده یا متغیر
    // ============================================
    productType: {
      type: String,
      enum: ['simple', 'variable'],
      default: 'simple',
    },

    // ============================================
    // فیلدهای قیمت و موجودی (برای محصولات ساده)
    // در محصولات متغیر، این مقادیر در variants تعریف می‌شوند
    // ============================================
    price: {
      type: Number,
      min: 0,
      // برای محصولات ساده الزامی است
      required: function () {
        return this.productType === 'simple'
      },
    },

    compareAtPrice: {
      type: Number,
      min: 0,
    },

    sku: {
      type: String,
      trim: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
    },

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: false,
    },

    // Images: array of objects {url, public_id} (Cloudinary)
    // در محصولات متغیر، این تصاویر مشترک هستند
    images: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
      // برای محصولات ساده الزامی است
      required: function () {
        return this.productType === 'simple'
      },
    },

    // ============================================
    // ویژگی‌ها (فقط برای محصولات متغیر)
    // ============================================
    attributes: [attributeSchema],

    // ============================================
    // متغیرها (فقط برای محصولات متغیر)
    // ============================================
    variants: [variantSchema],

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isOnSale: {
      type: Boolean,
      default: false,
    },

    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ============================================
    // Time-Based Promotion Fields
    // ============================================

    // Flash Deal: Individual product countdown
    isFlashDeal: {
      type: Boolean,
      default: false,
    },
    flashDealEndTime: {
      type: Date,
      // Only relevant if isFlashDeal === true
    },

    // Special Offer: Global campaign with shared countdown
    isSpecialOffer: {
      type: Boolean,
      default: false,
    },
    specialOfferEndTime: {
      type: Date,
      // Used for the global "Special Offers" section countdown
    },
  },
  {
    timestamps: true,
  },
)

// ============================================
// Database Indexes for Performance
// ============================================
// Compound index for common filter combinations
ProductSchema.index({ productType: 1, category: 1, brand: 1 })
ProductSchema.index({ isActive: 1, productType: 1 })
// Text index for search
ProductSchema.index({ name: 'text', description: 'text' })
// Single field indexes
ProductSchema.index({ category: 1 })
ProductSchema.index({ brand: 1 })
ProductSchema.index({ slug: 1 })
// Time-based promotion indexes
ProductSchema.index({ isFlashDeal: 1, flashDealEndTime: 1 })
ProductSchema.index({ isSpecialOffer: 1, specialOfferEndTime: 1 })

// Simple slug generator from name if not provided
ProductSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    const base = (this.name || '').toString().trim().toLowerCase()
    let slug = base
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}\-]+/gu, '')
      .replace(/\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')

    if (!slug) {
      slug = this._id ? this._id.toString() : new mongoose.Types.ObjectId().toString()
    }

    this.slug = slug
  }
  next()
})

ProductSchema.index({ slug: 1 }, { unique: true, sparse: true })
ProductSchema.index({ name: 1 })
ProductSchema.index({ isFeatured: 1 })
ProductSchema.index({ isActive: 1 })

module.exports = mongoose.model('Product', ProductSchema)
