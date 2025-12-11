const express = require('express')
const router = express.Router()
const {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getMyOrders,
  getMyOrderStats,
  payOrder,
  verifyPayment,
} = require('../controllers/orderController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// Customer-Facing Routes
// ============================================

// GET /api/orders/my-stats - آمار سریع سفارشات (FAST)
router.get('/my-stats', protect, getMyOrderStats)

// GET /api/orders/my-orders - دریافت سفارشات خود کاربر
router.get('/my-orders', protect, getMyOrders)

// POST /api/orders - ایجاد سفارش جدید
router.post('/', protect, createOrder)

// ============================================
// Payment Routes
// ============================================

// POST /api/orders/verify-payment - تایید پرداخت (باید قبل از /:id باشد)
router.post('/verify-payment', verifyPayment)

// POST /api/orders/:id/pay - شروع فرآیند پرداخت
router.post('/:id/pay', protect, payOrder)

// GET /api/orders/:id - دریافت جزئیات سفارش (مشتری: فقط سفارش خود، ادمین: همه)
router.get('/:id', protect, getOrderById)

// ============================================
// Admin Routes
// مجوزهای مورد نیاز: ORDER_READ_ALL, ORDER_UPDATE_STATUS
// ============================================

// GET /api/orders - دریافت لیست تمام سفارشات
// مجوز مورد نیاز: ORDER_READ_ALL
router.get('/', protect, checkPermission(PERMISSIONS.ORDER_READ_ALL), getAllOrders)

// ============================================
// PUT /api/orders/:id/status - به‌روزرسانی وضعیت سفارش
// مجوز مورد نیاز: ORDER_UPDATE_STATUS
// ============================================
router.put(
  '/:id/status',
  protect,
  checkPermission(PERMISSIONS.ORDER_UPDATE_STATUS),
  updateOrderStatus,
)

module.exports = router

