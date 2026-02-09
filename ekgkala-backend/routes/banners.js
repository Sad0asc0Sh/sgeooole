const express = require('express')
const router = express.Router()

const {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { cacheMiddleware, clearCacheByPrefix } = require('../middleware/cache')

// ============================================
// Middleware برای پاک کردن کش بعد از تغییرات
// ============================================
const clearBannerCache = (req, res, next) => {
  // پاک کردن کش بعد از اتمام response
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      clearCacheByPrefix('/api/banners')
    }
  })
  next()
}

// ============================================
// روت عمومی
// ============================================
router.get('/', cacheMiddleware(300), getBanners)

// ============================================
// روت‌های ادمین
// مجوزهای مورد نیاز: BANNER_CREATE, BANNER_UPDATE, BANNER_DELETE
// ============================================

// POST /api/banners - ایجاد بنر جدید
router.post(
  '/',
  protect,
  checkPermission(PERMISSIONS.BANNER_CREATE),
  clearBannerCache,
  createBanner
)

// PUT /api/banners/:id - ویرایش بنر
router.put(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.BANNER_UPDATE),
  clearBannerCache,
  updateBanner
)

// DELETE /api/banners/:id - حذف بنر
router.delete(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.BANNER_DELETE),
  clearBannerCache,
  deleteBanner
)

module.exports = router
