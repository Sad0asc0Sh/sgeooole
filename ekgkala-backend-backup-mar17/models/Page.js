const mongoose = require('mongoose')

const pageSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['published', 'hidden'],
      default: 'published',
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

pageSchema.index({ slug: 1 }, { unique: true })
pageSchema.index({ status: 1 })

pageSchema.pre('validate', function (next) {
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

module.exports = mongoose.model('Page', pageSchema)

