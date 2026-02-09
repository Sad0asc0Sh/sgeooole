const express = require('express')
const router = express.Router()

const {
  getSalesReports,
  getProductReports,
  getCustomerReports,
} = require('../controllers/reportController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت‌های گزارش‌گیری
// مجوزهای مورد نیاز: REPORT_READ_SALES, REPORT_READ_PRODUCTS, REPORT_READ_CUSTOMERS
// ============================================

// GET /api/reports/sales - گزارش فروش
router.get(
  '/sales',
  protect,
  checkPermission(PERMISSIONS.REPORT_READ_SALES),
  getSalesReports,
)

// GET /api/reports/products - گزارش محصولات
router.get(
  '/products',
  protect,
  checkPermission(PERMISSIONS.REPORT_READ_PRODUCTS),
  getProductReports,
)

// GET /api/reports/customers - گزارش مشتریان
router.get(
  '/customers',
  protect,
  checkPermission(PERMISSIONS.REPORT_READ_CUSTOMERS),
  getCustomerReports,
)

module.exports = router


