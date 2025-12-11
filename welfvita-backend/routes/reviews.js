const express = require('express')
const router = express.Router()
const {
  getAllReviewsAsAdmin,
  updateReviewStatus, // (تأیید یا مخفی کردن)
  deleteReview,
  postAdminReply, // پاسخ ادمین به نظر
  getProductReviews,
  addReview,
} = require('../controllers/reviewController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت‌های عمومی و کاربر
// ============================================
router.get('/product/:productId', getProductReviews)
router.post('/:productId', protect, addReview)

// ============================================
// روت‌های ادمین
// مجوزهای مورد نیاز: REVIEW_READ, REVIEW_MODERATE, REVIEW_REPLY, REVIEW_DELETE
// ============================================

// GET /api/reviews/admin - دریافت لیست نظرات
router.get('/admin', protect, checkPermission(PERMISSIONS.REVIEW_READ), getAllReviewsAsAdmin)

// PUT /api/reviews/:id/status - تأیید یا رد نظر
router.put('/:id/status', protect, checkPermission(PERMISSIONS.REVIEW_MODERATE), updateReviewStatus)

// PUT /api/reviews/:id/reply - پاسخ ادمین به نظر
router.put('/:id/reply', protect, checkPermission(PERMISSIONS.REVIEW_REPLY), postAdminReply)

// DELETE /api/reviews/:id - حذف نظر
router.delete('/:id', protect, checkPermission(PERMISSIONS.REVIEW_DELETE), deleteReview)

module.exports = router

