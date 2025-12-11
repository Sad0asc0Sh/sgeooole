const express = require('express')
const router = express.Router()
const {
  getAllUsersAsAdmin,
  getUserByIdAsAdmin,
  updateUserAsAdmin,
  deleteUserAsAdmin,
} = require('../controllers/userController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// GET /api/users/admin/all - دریافت لیست تمام کاربران
// مجوز مورد نیاز: USER_READ_ALL
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
  checkPermission(PERMISSIONS.USER_READ_ALL),
  getAllUsersAsAdmin,
)

// ============================================
// GET /api/users/admin/:id - دریافت جزئیات یک کاربر
// مجوز مورد نیاز: USER_READ
// ============================================
router.get(
  '/admin/:id',
  protect,
  checkPermission(PERMISSIONS.USER_READ),
  getUserByIdAsAdmin,
)

// ============================================
// PUT /api/users/admin/:id - به‌روزرسانی اطلاعات کاربر
// مجوز مورد نیاز: USER_UPDATE
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
  checkPermission(PERMISSIONS.USER_UPDATE),
  updateUserAsAdmin,
)

// ============================================
// DELETE /api/users/admin/:id - حذف کاربر
// مجوز مورد نیاز: USER_DELETE
// ============================================
router.delete(
  '/admin/:id',
  protect,
  checkPermission(PERMISSIONS.USER_DELETE),
  deleteUserAsAdmin,
)

module.exports = router

