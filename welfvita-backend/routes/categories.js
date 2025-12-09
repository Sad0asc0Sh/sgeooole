const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const categoryController = require('../controllers/categoryController')
const { cacheMiddleware, clearCacheByPrefix } = require('../middleware/cache')

// تعریف فیلدهای آپلود (Cloudinary)
const categoryUpload = upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'image', maxCount: 1 },
])

// Tree endpoint - reduced TTL for admin panel real-time updates
router.get('/tree', cacheMiddleware(30), categoryController.getCategoryTree)

// Featured endpoint
router.get('/featured', cacheMiddleware(600), categoryController.getFeaturedCategories)

// Popular endpoint
router.get('/popular', cacheMiddleware(600), categoryController.getPopularCategories)

// Get category by slug (with properties for frontend filters)
router.get('/slug/:slug', cacheMiddleware(600), categoryController.getCategoryBySlug)

// لیست و ایجاد دسته‌بندی
router
  .route('/')
  .get(cacheMiddleware(600), categoryController.getAllCategories)
  .post(
    protect,
    authorize('admin', 'manager', 'superadmin'),
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

// دریافت، ویرایش و حذف دسته‌بندی
router
  .route('/:id')
  .get(cacheMiddleware(600), categoryController.getCategoryById)
  .put(
    protect,
    authorize('admin', 'manager', 'superadmin'),
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
    authorize('admin', 'manager', 'superadmin'),
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
