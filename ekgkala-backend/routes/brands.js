const express = require('express')
const router = express.Router()
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const brandController = require('../controllers/brandController')

// ============================================
// روت‌های عمومی (دسترسی آزاد برای خواندن)
// ============================================
router.get('/', brandController.getAllBrands)
router.get('/homepage', brandController.getHomepageBrands) // برندهای صفحه اصلی
router.get('/slug/:slug', brandController.getBrandBySlug) // دریافت برند با slug
router.get('/:id', brandController.getBrandById)

// ============================================
// روت‌های ادمین (نیاز به احراز هویت)
// مجوزهای مورد نیاز: BRAND_CREATE, BRAND_UPDATE, BRAND_DELETE
// ============================================

// POST /api/brands - ایجاد برند جدید
router.post(
  '/',
  protect,
  checkPermission(PERMISSIONS.BRAND_CREATE),
  upload.single('logo'),
  brandController.createBrand,
)

// PUT /api/brands/:id - ویرایش برند
router.put(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.BRAND_UPDATE),
  upload.single('logo'),
  brandController.updateBrand,
)

// DELETE /api/brands/:id - حذف برند
router.delete(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.BRAND_DELETE),
  brandController.deleteBrand,
)

module.exports = router

