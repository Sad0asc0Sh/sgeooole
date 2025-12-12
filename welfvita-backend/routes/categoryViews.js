const express = require('express')
const router = express.Router()
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { optionalAuth } = require('../middleware/optionalAuth')
const categoryViewController = require('../controllers/categoryViewController')
const { cacheMiddleware, CACHE_TTL } = require('../middleware/cache')

// ============================================
// روت‌های عمومی
// ============================================

// ثبت بازدید دسته‌بندی (با احراز هویت اختیاری)
router.post('/track', optionalAuth, categoryViewController.trackCategoryView)

// دریافت دسته‌بندی‌های محبوب (بر اساس آمار)
router.get('/popular', cacheMiddleware(CACHE_TTL.SHORT), categoryViewController.getPopularByViews)

// ============================================
// روت‌های مدیریتی (فقط ادمین)
// ============================================

// دریافت آمار کامل
router.get(
    '/stats',
    protect,
    checkPermission(PERMISSIONS.PRODUCT_READ),
    categoryViewController.getViewStats
)

// پاکسازی داده‌های قدیمی
router.delete(
    '/cleanup',
    protect,
    checkPermission(PERMISSIONS.PRODUCT_DELETE),
    categoryViewController.cleanupOldViews
)

module.exports = router
