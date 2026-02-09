const express = require('express')
const router = express.Router()

const {
  createMethod,
  getAllMethods,
  getMethodById,
  updateMethod,
  deleteMethod,
} = require('../controllers/shippingController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت عمومی برای نمایش روش‌های فعال به مشتری
// ============================================
router.get('/', getAllMethods)

// ============================================
// روت‌های ادمین (محافظت شده)
// مجوزهای مورد نیاز: SHIPPING_READ, SHIPPING_CREATE, SHIPPING_UPDATE, SHIPPING_DELETE
// ============================================

// POST /api/shipping - ایجاد روش ارسال جدید
router.post('/', protect, checkPermission(PERMISSIONS.SHIPPING_CREATE), createMethod)

// GET /api/shipping/admin - دریافت لیست برای ادمین
router.get('/admin', protect, checkPermission(PERMISSIONS.SHIPPING_READ), getAllMethods)

// GET /api/shipping/:id - دریافت جزئیات یک روش ارسال
router.get('/:id', protect, checkPermission(PERMISSIONS.SHIPPING_READ), getMethodById)

// PUT /api/shipping/:id - ویرایش روش ارسال
router.put('/:id', protect, checkPermission(PERMISSIONS.SHIPPING_UPDATE), updateMethod)

// DELETE /api/shipping/:id - حذف روش ارسال
router.delete('/:id', protect, checkPermission(PERMISSIONS.SHIPPING_DELETE), deleteMethod)

module.exports = router

