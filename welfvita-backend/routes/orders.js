const express = require('express')
const router = express.Router()
const {
  createOrder,
  createOrderForUser,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getMyOrders,
  getMyOrderStats,
  payOrder,
  verifyPayment,
  trackOrder,
} = require('../controllers/orderController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// Joi Validation
const validate = require('../middleware/validate')
const {
  orderCreateSchema,
  orderStatusUpdateSchema,
  orderListQuerySchema,
} = require('../validators/joiSchemas/orderSchemas')

// ============================================
// Customer-Facing Routes
// ============================================

// GET /api/orders/my-stats - آمار سریع سفارشات (FAST)
router.get('/my-stats', protect, getMyOrderStats)

// GET /api/orders/my-orders - دریافت سفارشات خود کاربر
router.get('/my-orders', protect, getMyOrders)

// POST /api/orders - ایجاد سفارش جدید
router.post('/', protect, validate(orderCreateSchema), createOrder)

// ============================================
// Payment Routes
// ============================================

// POST /api/orders/verify-payment - تایید پرداخت (باید قبل از /:id باشد)
router.post('/verify-payment', verifyPayment)

// ============================================
// Guest Order Tracking (No Auth Required)
// ============================================

// GET /api/orders/track/:orderCode - پیگیری سفارش بدون نیاز به لاگین
router.get('/track/:orderCode', trackOrder)

// ============================================
// Admin Routes (MUST BE BEFORE /:id routes)
// مجوزهای مورد نیاز: ORDER_READ_ALL, ORDER_UPDATE_STATUS, ORDER_CREATE
// ============================================

// POST /api/orders/admin/create - ایجاد سفارش توسط ادمین
// مجوز مورد نیاز: ORDER_CREATE (Admin)
router.post(
  '/admin/create',
  protect,
  checkPermission(PERMISSIONS.ORDER_CREATE),
  createOrderForUser,
)

// GET /api/orders - دریافت لیست تمام سفارشات
// مجوز مورد نیاز: ORDER_READ_ALL
router.get('/', protect, checkPermission(PERMISSIONS.ORDER_READ_ALL), getAllOrders)

// ============================================
// Routes with :id param (MUST BE LAST)
// ============================================

// POST /api/orders/:id/pay - شروع فرآیند پرداخت
router.post('/:id/pay', protect, payOrder)

// PUT /api/orders/:id/status - به‌روزرسانی وضعیت سفارش
// مجوز مورد نیاز: ORDER_UPDATE_STATUS
router.put(
  '/:id/status',
  protect,
  checkPermission(PERMISSIONS.ORDER_UPDATE_STATUS),
  validate(orderStatusUpdateSchema),
  updateOrderStatus,
)

// GET /api/orders/:id - دریافت جزئیات سفارش (مشتری: فقط سفارش خود، ادمین: همه)
router.get('/:id', protect, getOrderById)

module.exports = router
