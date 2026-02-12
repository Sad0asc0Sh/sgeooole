const express = require('express')
const router = express.Router()
const multer = require('multer')

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

const { upload, MAX_UPLOAD_FILE_SIZE_MB } = require('../middleware/upload')

const handleBannerImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next()

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: `حجم تصویر بنر بیشتر از حد مجاز است (حداکثر ${MAX_UPLOAD_FILE_SIZE_MB} مگابایت).`,
        })
      }

      return res.status(400).json({
        success: false,
        message: `خطا در آپلود تصویر بنر: ${err.message}`,
      })
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'خطا در آپلود تصویر بنر',
    })
  })
}

// POST /api/banners - ایجاد بنر جدید
router.post(
  '/',
  protect,
  checkPermission(PERMISSIONS.BANNER_CREATE),
  handleBannerImageUpload,
  clearBannerCache,
  createBanner
)

// PUT /api/banners/:id - ویرایش بنر
router.put(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.BANNER_UPDATE),
  handleBannerImageUpload,
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
