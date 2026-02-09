const express = require('express')
const router = express.Router()
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const categoryController = require('../controllers/categoryController')
const { cacheMiddleware, clearCacheByPrefix, CACHE_TTL } = require('../middleware/cache')

// تعریف فیلدهای آپلود (Cloudinary)
const categoryUpload = upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'image', maxCount: 1 },
])

// ============================================
// روت‌های عمومی (بدون نیاز به احراز هویت)
// ============================================

// Tree endpoint - short cache for admin panel
router.get('/tree', cacheMiddleware(CACHE_TTL.SHORT), categoryController.getCategoryTree)

// Featured endpoint - long cache (rarely changes)
router.get('/featured', cacheMiddleware(CACHE_TTL.LONG), categoryController.getFeaturedCategories)

// Popular endpoint - long cache
router.get('/popular', cacheMiddleware(CACHE_TTL.LONG), categoryController.getPopularCategories)

// Get category by slug (with properties for frontend filters)
router.get('/slug/:slug', cacheMiddleware(CACHE_TTL.LONG), categoryController.getCategoryBySlug)

// ============================================
// لیست و ایجاد دسته‌بندی
// ============================================
router
  .route('/')
  .get(cacheMiddleware(CACHE_TTL.LONG), categoryController.getAllCategories)
  .post(
    protect,
    checkPermission(PERMISSIONS.CATEGORY_CREATE),
    categoryUpload,
    async (req, res, next) => {
      try {
        await categoryController.createCategory(req, res, next)
        clearCacheByPrefix('/api/categories')
        clearCacheByPrefix('/api/products')
        clearCacheByPrefix('/api/v1/admin/products')
      } catch (error) {
        next(error)
      }
    },
  )

// ============================================
// دریافت، ویرایش و حذف دسته‌بندی
// ============================================
router
  .route('/:id')
  .get(cacheMiddleware(600), categoryController.getCategoryById)
  .put(
    protect,
    checkPermission(PERMISSIONS.CATEGORY_UPDATE),
    categoryUpload,
    async (req, res, next) => {
      try {
        await categoryController.updateCategory(req, res, next)
        clearCacheByPrefix('/api/categories')
        clearCacheByPrefix('/api/products')
        clearCacheByPrefix('/api/v1/admin/products')
      } catch (error) {
        next(error)
      }
    },
  )
  .delete(
    protect,
    checkPermission(PERMISSIONS.CATEGORY_DELETE),
    async (req, res, next) => {
      try {
        await categoryController.deleteCategory(req, res, next)
        clearCacheByPrefix('/api/categories')
        clearCacheByPrefix('/api/products')
        clearCacheByPrefix('/api/v1/admin/products')
      } catch (error) {
        next(error)
      }
    },
  )

module.exports = router

