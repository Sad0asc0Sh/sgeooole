const mongoose = require('mongoose')

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    featuredImage: {
      // می‌تواند رشته ساده (URL) یا آبجکت {url, public_id} باشد
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogCategory',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    meta: {
      title: { type: String },
      description: { type: String },
    },
  },
  {
    timestamps: true,
  },
)

postSchema.index({ slug: 1 }, { unique: true })
postSchema.index({ status: 1 })
postSchema.index({ category: 1 })

// تولید slug از روی عنوان در صورت خالی بودن
postSchema.pre('validate', function (next) {
  if (!this.slug && this.title) {
    const base = this.title.toString().trim().toLowerCase()
    this.slug = base
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}\-]+/gu, '')
      .replace(/\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  }
  next()
})

module.exports = mongoose.model('Post', postSchema)

