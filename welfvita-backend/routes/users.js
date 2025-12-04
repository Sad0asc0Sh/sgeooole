const express = require('express')
const router = express.Router()
const {
  getAllUsersAsAdmin,
  getUserByIdAsAdmin,
  updateUserAsAdmin,
  deleteUserAsAdmin,
} = require('../controllers/userController')
const { protect, authorize } = require('../middleware/auth')

// ============================================
// GET /api/users/admin/all - دریافت لیست تمام کاربران
// فقط برای ادمین، مدیر و سوپرادمین
// پارامترهای Query:
//   - page: شماره صفحه (پیش‌فرض: 1)
//   - limit: تعداد آیتم در هر صفحه (پیش‌فرض: 20)
//   - search: جستجو در نام یا ایمیل
//   - role: فیلتر بر اساس نقش (user, admin, manager, superadmin)
//   - isActive: فیلتر بر اساس وضعیت (true/false)
// ============================================
router.get(
  '/admin/all',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getAllUsersAsAdmin,
)

// ============================================
// GET /api/users/admin/:id - دریافت جزئیات یک کاربر
// فقط برای ادمین
// ============================================
router.get(
  '/admin/:id',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getUserByIdAsAdmin,
)

// ============================================
// PUT /api/users/admin/:id - به‌روزرسانی اطلاعات کاربر
// فقط برای ادمین
// Body:
//   - name: نام کاربر
//   - email: ایمیل کاربر
//   - mobile: شماره موبایل
//   - isActive: وضعیت فعال/غیرفعال
//   - role: نقش کاربر
// ============================================
router.put(
  '/admin/:id',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  updateUserAsAdmin,
)

// ============================================
// DELETE /api/users/admin/:id - حذف کاربر
// فقط برای سوپرادمین
// ============================================
router.delete(
  '/admin/:id',
  protect,
  authorize('superadmin'),
  deleteUserAsAdmin,
)

module.exports = router
