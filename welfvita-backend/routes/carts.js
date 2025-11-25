const express = require('express')
const router = express.Router()
const {
  getAbandonedCarts,
  getCartStats,
  sendEmailReminder,
  sendSmsReminder,
  getMyCart,
  syncCart,
  addOrUpdateItem,
  removeItem,
  clearCart,
} = require('../controllers/cartController')
const { protect, authorize } = require('../middleware/auth')

// ============================================
// GET /api/carts/admin/abandoned - دریافت سبدهای رها شده
// فقط برای ادمین
// ============================================
router.get(
  '/admin/abandoned',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getAbandonedCarts,
)

// ============================================
// GET /api/carts/admin/stats - آمار سبدها
// فقط برای ادمین
// ============================================
router.get(
  '/admin/stats',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getCartStats,
)

// ============================================
// POST /api/carts/admin/remind/email/:cartId - ارسال یادآوری ایمیل
// فقط برای ادمین
// ============================================
router.post(
  '/admin/remind/email/:cartId',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  sendEmailReminder,
)

// ============================================
// POST /api/carts/admin/remind/sms/:cartId - ارسال یادآوری پیامک
// فقط برای ادمین
// ============================================
router.post(
  '/admin/remind/sms/:cartId',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  sendSmsReminder,
)

// ============================================
// Customer-Facing Cart Routes
// ============================================

// ============================================
// GET /api/cart - دریافت سبد خرید کاربر
// نیاز به احراز هویت (مشتری لاگین شده)
// ============================================
router.get('/cart', protect, getMyCart)

// ============================================
// POST /api/cart/sync - همگام‌سازی سبد خرید localStorage با سرور
// نیاز به احراز هویت (مشتری لاگین شده)
// Body: { items: [{ product, quantity, variantOptions? }] }
// ============================================
router.post('/cart/sync', protect, syncCart)

// ============================================
// POST /api/cart/item - افزودن یا به‌روزرسانی آیتم در سبد
// نیاز به احراز هویت (مشتری لاگین شده)
// Body: { product, quantity, variantOptions? }
// ============================================
router.post('/cart/item', protect, addOrUpdateItem)

// ============================================
// DELETE /api/cart/item/:productId - حذف آیتم از سبد
// نیاز به احراز هویت (مشتری لاگین شده)
// ============================================
router.delete('/cart/item/:productId', protect, removeItem)

// ============================================
// DELETE /api/cart - پاک کردن سبد خرید
// نیاز به احراز هویت (مشتری لاگین شده)
// ============================================
router.delete('/cart', protect, clearCart)

module.exports = router
