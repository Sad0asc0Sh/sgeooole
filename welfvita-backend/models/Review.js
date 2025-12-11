const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // ارجاع به مدل کاربر
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // ارجاع به مدل محصول
      required: true,
      index: true,
    },
    rating: {
      // امتیاز (مثلاً 1 تا 5)
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: [true, 'متن نظر الزامی است'],
      trim: true,
    },
    isApproved: {
      // برای اینکه ادمین بتواند نظر را قبل از نمایش تأیید کند
      type: Boolean,
      default: false,
      index: true,
    },
    adminReply: {
      message: {
        type: String,
        trim: true,
      },
      repliedAt: {
        type: Date,
      },
    },
  },
  { timestamps: true }
)

// --- منطق حیاتی: به‌روزرسانی امتیاز میانگین محصول ---
// پس از هر ذخیره یا حذف نظر، این تابع باید امتیاز میانگین را در مدل Product به‌روز کند
reviewSchema.statics.calculateAverageRating = async function (productId) {
  const stats = await this.aggregate([
    { $match: { product: productId, isApproved: true } },
    {
      $group: {
        _id: '$product',
        numReviews: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ])

  try {
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      rating: stats.length > 0 ? stats[0].avgRating : 0,
      numReviews: stats.length > 0 ? stats[0].numReviews : 0,
    })
  } catch (err) {
    console.error(err)
  }
}

// فراخوانی تابع محاسبه پس از ذخیره
reviewSchema.post('save', function () {
  this.constructor.calculateAverageRating(this.product)
})

// فراخوانی تابع محاسبه پس از حذف
reviewSchema.post('deleteOne', { document: true, query: false }, function () {
  this.constructor.calculateAverageRating(this.product)
})

module.exports = mongoose.model('Review', reviewSchema)
