const mongoose = require('mongoose')

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name must be at most 100 characters'],
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },

    description: {
      type: String,
      maxlength: [500, 'Description must be at most 500 characters'],
    },

    // Icon and image can be either simple string path or
    // an object { url, public_id } for integrations like Cloudinary.
    icon: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    image: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isPopular: {
      type: Boolean,
      default: false,
    },

    slug: {
      type: String,
      unique: true,
      sparse: true,
    },

    order: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ============================================
    // Smart Filters / Category Properties Configuration
    // Defines technical specifications (attributes) for products in this category
    // These attributes will be used for:
    // 1. Dynamic input fields in product creation form
    // 2. Sidebar filters on product listing page
    // 3. Specifications display on product detail page
    // ============================================
    properties: [
      {
        name: { type: String, required: true }, // e.g., "رزولوشن" (Resolution)
        type: { type: String, enum: ['text', 'number', 'select'], default: 'select' },
        options: [{ type: String }], // Predefined options for 'select' type, e.g., ["2MP", "4MP", "8MP"]
        isFilterable: { type: Boolean, default: true }, // Should this appear in sidebar filters?
        unit: { type: String, default: '' }, // Optional unit for display, e.g., "ساعت", "متر"
        order: { type: Number, default: 0 }, // Display order
      }
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual field: children
CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
})

// Indexes for performance and uniqueness
CategorySchema.index({ parent: 1 })
CategorySchema.index({ isActive: 1 })
// Ensure category name is unique per parent (allows same name under different parents)
CategorySchema.index({ parent: 1, name: 1 }, { unique: true })
// Indexes for featured and popular category queries (used on homepage)
CategorySchema.index({ isFeatured: 1, isActive: 1 })
CategorySchema.index({ isPopular: 1, isActive: 1 })
CategorySchema.index({ slug: 1 })
CategorySchema.index({ order: 1 })

// Pre-save hook: generate unique slug from name (supports non-Latin chars)
CategorySchema.pre('save', async function (next) {
  try {
    if (!this.isModified('name') && this.slug) {
      return next()
    }

    const base = (this.name || '').toString().trim().toLowerCase()

    let slug = base
      .replace(/\s+/g, '-') // spaces -> -
      .replace(/[^\p{L}\p{N}\-]+/gu, '') // keep letters/numbers/- (Unicode)
      .replace(/-+/g, '-') // collapse multiple -
      .replace(/^-+/, '') // trim leading -
      .replace(/-+$/, '') // trim trailing -

    // Fallback: if nothing remains (e.g. only symbols), use _id
    if (!slug) {
      slug = this._id ? this._id.toString() : new mongoose.Types.ObjectId().toString()
    }

    // Ensure slug is unique by suffixing "-2", "-3", ...
    const Model = this.constructor
    let uniqueSlug = slug
    let suffix = 2

    // Look for other documents with the same slug
    // (exclude current document when updating)
    // eslint-disable-next-line no-constant-condition
    while (
      await Model.findOne({
        slug: uniqueSlug,
        _id: { $ne: this._id },
      }).select('_id').lean()
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

module.exports = mongoose.model('Category', CategorySchema)
