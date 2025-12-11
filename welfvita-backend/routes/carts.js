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
  deleteCartByAdmin,
  cleanupExpiredCarts,
  sendExpiryWarnings,
} = require('../controllers/cartController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// Admin Cart Management Routes
// مجوزهای مورد نیاز: CART_READ, CART_MANAGE
// ============================================

// GET /api/carts/admin/abandoned - دریافت سبدهای رها شده
router.get(
  '/admin/abandoned',
  protect,
  checkPermission(PERMISSIONS.CART_READ),
  getAbandonedCarts,
)

// GET /api/carts/admin/stats - آمار سبدها
router.get(
  '/admin/stats',
  protect,
  checkPermission(PERMISSIONS.CART_READ),
  getCartStats,
)

// POST /api/carts/admin/remind/email/:cartId - ارسال یادآوری ایمیل
router.post(
  '/admin/remind/email/:cartId',
  protect,
  checkPermission(PERMISSIONS.CART_MANAGE),
  sendEmailReminder,
)

// POST /api/carts/admin/remind/sms/:cartId - ارسال یادآوری پیامک
router.post(
  '/admin/remind/sms/:cartId',
  protect,
  checkPermission(PERMISSIONS.CART_MANAGE),
  sendSmsReminder,
)

// DELETE /api/carts/admin/:cartId - حذف دستی سبد خرید
router.delete(
  '/admin/:cartId',
  protect,
  checkPermission(PERMISSIONS.CART_MANAGE),
  deleteCartByAdmin,
)

// POST /api/carts/admin/cleanup - پاکسازی سبدهای منقضی شده
router.post(
  '/admin/cleanup',
  protect,
  checkPermission(PERMISSIONS.CART_MANAGE),
  cleanupExpiredCarts,
)

// POST /api/carts/admin/send-warnings - ارسال هشدارهای انقضا
router.post(
  '/admin/send-warnings',
  protect,
  checkPermission(PERMISSIONS.CART_MANAGE),
  sendExpiryWarnings,
)

// ============================================
// Customer-Facing Cart Routes
// ============================================

// GET /api/cart - دریافت سبد خرید کاربر
// نیاز به احراز هویت (مشتری لاگین شده)
router.get('/cart', protect, getMyCart)

// POST /api/cart/sync - همگام‌سازی سبد خرید localStorage با سرور
// نیاز به احراز هویت (مشتری لاگین شده)
// Body: { items: [{ product, quantity, variantOptions? }] }
router.post('/cart/sync', protect, syncCart)

// POST /api/cart/item - افزودن یا به‌روزرسانی آیتم در سبد
// نیاز به احراز هویت (مشتری لاگین شده)
// Body: { product, quantity, variantOptions? }
router.post('/cart/item', protect, addOrUpdateItem)

// DELETE /api/cart/item/:productId - حذف آیتم از سبد
// نیاز به احراز هویت (مشتری لاگین شده)
router.delete('/cart/item/:productId', protect, removeItem)

// DELETE /api/cart - پاک کردن سبد خرید
// نیاز به احراز هویت (مشتری لاگین شده)
router.delete('/cart', protect, clearCart)

module.exports = router

