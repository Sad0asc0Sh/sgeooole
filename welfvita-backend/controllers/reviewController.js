const Review = require('../models/Review')
const Product = require('../models/Product')

/**
 * @desc    Get reviews for a product (Public)
 * @route   GET /api/reviews/product/:productId
 * @access  Public
 */
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 10
    const skip = (page - 1) * limit

    const reviews = await Review.find({ product: productId, isApproved: true })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Review.countDocuments({ product: productId, isApproved: true })

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
      },
    })
  } catch (error) {
    console.error('Error getting reviews:', error)
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    })
  }
}

/**
 * @desc    Add a review
 * @route   POST /api/reviews/:productId
 * @access  Private
 */
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body
    const { productId } = req.params

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      })
    }

    const product = await Product.findById(productId)

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    // Validate input
    if (!rating || isNaN(Number(rating))) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be a number',
      })
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required',
      })
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating: Number(rating),
      comment,
      isApproved: false, // Default to pending
    })

    res.status(201).json({
      success: true,
      message: 'Review added successfully. It will be visible after approval.',
      data: review,
    })
  } catch (error) {
    console.error('Error adding review:', error)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message)
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
        error: error.message,
      })
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'شما قبلاً برای این محصول نظر ثبت کرده‌اید.',
      })
    }
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    })
  }
}

/**
 * @desc    دریافت لیست تمام نظرات (برای ادمین)
 * @route   GET /api/reviews/admin
 * @access  Private/Admin
 */
exports.getAllReviewsAsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    // فیلتر بر اساس isApproved
    const filter = {}
    if (req.query.isApproved !== undefined) {
      filter.isApproved = req.query.isApproved === 'true'
    }

    // فیلتر بر اساس محصول
    if (req.query.productId) {
      filter.product = req.query.productId
    }

    // فیلتر بر اساس کاربر
    if (req.query.userId) {
      filter.user = req.query.userId
    }

    const total = await Review.countDocuments(filter)
    const reviews = await Review.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name slug images sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت نظرات',
      error: error.message,
    })
  }
}

/**
 * @desc    به‌روزرسانی وضعیت نظر (تأیید/رد)
 * @route   PUT /api/reviews/:id/status
 * @access  Private/Admin
 */
exports.updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { isApproved } = req.body

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'مقدار isApproved باید true یا false باشد',
      })
    }

    const review = await Review.findById(id)
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'نظر یافت نشد',
      })
    }

    review.isApproved = isApproved
    await review.save()

    // به‌روزرسانی امتیاز میانگین محصول
    await Review.calculateAverageRating(review.product)

    res.status(200).json({
      success: true,
      message: 'وضعیت نظر با موفقیت به‌روزرسانی شد',
      data: review,
    })
  } catch (error) {
    console.error('Error updating review status:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی وضعیت نظر',
      error: error.message,
    })
  }
}

/**
 * @desc    حذف نظر
 * @route   DELETE /api/reviews/:id
 * @access  Private/Admin
 */
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params

    const review = await Review.findById(id)
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'نظر یافت نشد',
      })
    }

    const productId = review.product

    // حذف نظر
    await review.deleteOne()

    // به‌روزرسانی امتیاز میانگین محصول
    await Review.calculateAverageRating(productId)

    res.status(200).json({
      success: true,
      message: 'نظر با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting review:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف نظر',
      error: error.message,
    })
  }
}

/**
 * @desc    ثبت/ویرایش پاسخ ادمین به نظر
 * @route   PUT /api/reviews/:id/reply
 * @access  Private/Admin
 */
exports.postAdminReply = async (req, res) => {
  try {
    const { id } = req.params
    const { replyMessage } = req.body

    if (!replyMessage || replyMessage.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'متن پاسخ الزامی است',
      })
    }

    const review = await Review.findById(id)
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'نظر یافت نشد',
      })
    }

    // به‌روزرسانی پاسخ ادمین
    review.adminReply = {
      message: replyMessage.trim(),
      repliedAt: Date.now(),
    }

    await review.save()

    res.status(200).json({
      success: true,
      message: 'پاسخ شما با موفقیت ثبت شد',
      data: review,
    })
  } catch (error) {
    console.error('Error posting admin reply:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت پاسخ',
      error: error.message,
    })
  }
}
