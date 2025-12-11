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
// روت عمومی
// ============================================
router.get('/', cacheMiddleware(300), getBanners)

// ============================================
// روت‌های ادمین
// مجوزهای مورد نیاز: BANNER_CREATE, BANNER_UPDATE, BANNER_DELETE
// ============================================

// POST /api/banners - ایجاد بنر جدید
router.post('/', protect, checkPermission(PERMISSIONS.BANNER_CREATE), async (req, res, next) => {
  try {
    await createBanner(req, res, next)
    clearCacheByPrefix('/api/banners')
  } catch (error) {
    next(error)
  }
})

// PUT /api/banners/:id - ویرایش بنر
router.put('/:id', protect, checkPermission(PERMISSIONS.BANNER_UPDATE), async (req, res, next) => {
  try {
    await updateBanner(req, res, next)
    clearCacheByPrefix('/api/banners')
  } catch (error) {
    next(error)
  }
})

// DELETE /api/banners/:id - حذف بنر
router.delete('/:id', protect, checkPermission(PERMISSIONS.BANNER_DELETE), async (req, res, next) => {
  try {
    await deleteBanner(req, res, next)
    clearCacheByPrefix('/api/banners')
  } catch (error) {
    next(error)
  }
})

module.exports = router

