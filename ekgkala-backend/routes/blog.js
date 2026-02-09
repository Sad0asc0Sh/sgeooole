const express = require('express')
const router = express.Router()

const {
  getAdminPosts,
  createPost,
  getPostById,
  updatePost,
  deletePost,
} = require('../controllers/postController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت‌های مدیریت بلاگ
// مجوزهای مورد نیاز: BLOG_READ, BLOG_CREATE, BLOG_UPDATE, BLOG_DELETE
// ============================================

// GET /api/blog - لیست پست‌ها برای پنل ادمین
router.get('/', protect, checkPermission(PERMISSIONS.BLOG_READ), getAdminPosts)

// POST /api/blog - ایجاد پست جدید
router.post('/', protect, checkPermission(PERMISSIONS.BLOG_CREATE), createPost)

// GET /api/blog/:id - جزئیات پست
router.get('/:id', protect, checkPermission(PERMISSIONS.BLOG_READ), getPostById)

// PUT /api/blog/:id - ویرایش پست
router.put('/:id', protect, checkPermission(PERMISSIONS.BLOG_UPDATE), updatePost)

// DELETE /api/blog/:id - حذف پست
router.delete('/:id', protect, checkPermission(PERMISSIONS.BLOG_DELETE), deletePost)

module.exports = router


