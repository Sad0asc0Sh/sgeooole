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
const { protect, authorize } = require('../middleware/auth')

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
// ============================================

// GET /api/orders - دریافت لیست تمام سفارشات
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getAllOrders)

// ============================================
// PUT /api/orders/:id/status - به‌روزرسانی وضعیت سفارش
// فقط برای ادمین
// ============================================
router.put(
  '/:id/status',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  updateOrderStatus,
)

module.exports = router
