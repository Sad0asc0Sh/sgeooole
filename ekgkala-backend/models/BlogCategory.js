const mongoose = require('mongoose')

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
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
  },
  {
    timestamps: true,
  },
)

blogCategorySchema.index({ slug: 1 }, { unique: true })

module.exports = mongoose.model('BlogCategory', blogCategorySchema)

