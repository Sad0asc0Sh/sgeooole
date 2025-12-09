const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const brandController = require('../controllers/brandController')

// روت‌های عمومی (دسترسی آزاد برای خواندن)
router.get('/', brandController.getAllBrands)
router.get('/homepage', brandController.getHomepageBrands) // برندهای صفحه اصلی
router.get('/slug/:slug', brandController.getBrandBySlug) // دریافت برند با slug
router.get('/:id', brandController.getBrandById)

// روت‌های ادمین (نیاز به احراز هویت)
router.post(
  '/',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  upload.single('logo'), // آپلود تک‌فایل با نام 'logo'
  brandController.createBrand,
)

router.put(
  '/:id',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  upload.single('logo'),
  brandController.updateBrand,
)

router.delete(
  '/:id',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  brandController.deleteBrand,
)

module.exports = router
