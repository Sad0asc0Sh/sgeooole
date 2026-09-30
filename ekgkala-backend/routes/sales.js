const express = require('express')
const router = express.Router()
const {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getProductConflicts,
} = require('../controllers/saleController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت‌های ادمین - مدیریت کمپین‌های فروش
// مجوزهای مورد نیاز: SALE_READ, SALE_CREATE, SALE_UPDATE, SALE_DELETE
// ============================================

// (در آینده روت GET /active برای فرانت‌اند سایت خواهیم داشت)

// GET /api/sales/admin - دریافت لیست کمپین‌ها
router.get('/admin', protect, checkPermission(PERMISSIONS.SALE_READ), getAllSales)

// POST /api/sales/admin - ایجاد کمپین جدید
router.post('/admin', protect, checkPermission(PERMISSIONS.SALE_CREATE), createSale)

// GET /api/sales/admin/product-conflicts - محصولات درگیر در پیشنهاد لحظه‌ای/شگفت‌انگیز
// (باید قبل از '/admin/:id' تعریف شود)
router.get('/admin/product-conflicts', protect, checkPermission(PERMISSIONS.SALE_READ), getProductConflicts)

// GET /api/sales/admin/:id - دریافت جزئیات کمپین
router.get('/admin/:id', protect, checkPermission(PERMISSIONS.SALE_READ), getSaleById)

// PUT /api/sales/admin/:id - ویرایش کمپین
router.put('/admin/:id', protect, checkPermission(PERMISSIONS.SALE_UPDATE), updateSale)

// DELETE /api/sales/admin/:id - حذف کمپین
router.delete('/admin/:id', protect, checkPermission(PERMISSIONS.SALE_DELETE), deleteSale)

module.exports = router

