const express = require('express')
const router = express.Router()

const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require('../controllers/blogCategoryController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت عمومی
// ============================================
router.get('/', getCategories)

// ============================================
// روت‌های ادمین - مدیریت دسته‌بندی مقالات
// مجوزهای مورد نیاز: BLOG_CREATE, BLOG_UPDATE, BLOG_DELETE
// ============================================

// POST /api/blog-categories - ایجاد دسته‌بندی جدید
router.post('/', protect, checkPermission(PERMISSIONS.BLOG_CREATE), createCategory)

// PUT /api/blog-categories/:id - ویرایش دسته‌بندی
router.put('/:id', protect, checkPermission(PERMISSIONS.BLOG_UPDATE), updateCategory)

// DELETE /api/blog-categories/:id - حذف دسته‌بندی
router.delete('/:id', protect, checkPermission(PERMISSIONS.BLOG_DELETE), deleteCategory)

module.exports = router


