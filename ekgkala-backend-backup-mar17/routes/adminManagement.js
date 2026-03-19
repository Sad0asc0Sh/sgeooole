const express = require('express')
const router = express.Router()

const {
  getAllAdmins,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} = require('../controllers/adminManagementController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// Admin Management Routes
// مجوزهای مورد نیاز: ADMIN_READ, ADMIN_CREATE, ADMIN_UPDATE, ADMIN_DELETE
// ============================================

// GET /api/admin-management - دریافت لیست ادمین‌ها
router.get('/', protect, checkPermission(PERMISSIONS.ADMIN_READ), getAllAdmins)

// POST /api/admin-management - ایجاد ادمین جدید
router.post('/', protect, checkPermission(PERMISSIONS.ADMIN_CREATE), createAdminUser)

// PUT /api/admin-management/:id - ویرایش ادمین
router.put('/:id', protect, checkPermission(PERMISSIONS.ADMIN_UPDATE), updateAdminUser)

// DELETE /api/admin-management/:id - حذف ادمین
router.delete('/:id', protect, checkPermission(PERMISSIONS.ADMIN_DELETE), deleteAdminUser)

module.exports = router


