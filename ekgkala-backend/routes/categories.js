const express = require('express')
const router = express.Router()
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const categoryController = require('../controllers/categoryController')
const { cacheMiddleware, clearCacheByPrefix, CACHE_TTL } = require('../middleware/cache')

// ØªØ¹Ø±ÛŒÙ ÙÛŒÙ„Ø¯Ù‡Ø§ÛŒ Ø¢Ù¾Ù„ÙˆØ¯ (ParsPack S3)
const categoryUpload = upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'image', maxCount: 1 },
])

// ============================================
// Ø±ÙˆØªâ€ŒÙ‡Ø§ÛŒ Ø¹Ù…ÙˆÙ…ÛŒ (Ø¨Ø¯ÙˆÙ† Ù†ÛŒØ§Ø² Ø¨Ù‡ Ø§Ø­Ø±Ø§Ø² Ù‡ÙˆÛŒØª)
// ============================================

// Tree endpoint - short cache for admin panel
router.get('/tree', cacheMiddleware(CACHE_TTL.SHORT), categoryController.getCategoryTree)

// Featured endpoint - long cache (rarely changes)
router.get('/featured', cacheMiddleware(CACHE_TTL.LONG), categoryController.getFeaturedCategories)

// Popular endpoint - long cache
router.get('/popular', cacheMiddleware(CACHE_TTL.LONG), categoryController.getPopularCategories)

// ============================================
// Orphan maintenance endpoints (admin-only)
// ============================================
router.get(
  '/orphans',
  protect,
  checkPermission(PERMISSIONS.CATEGORY_READ),
  categoryController.getOrphanCategories,
)

router.post(
  '/orphans/cleanup',
  protect,
  checkPermission(PERMISSIONS.CATEGORY_DELETE),
  async (req, res, next) => {
    try {
      // Clear cache before running cleanup so subsequent reads are always fresh.
      clearCacheByPrefix('/api/categories')
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      await categoryController.cleanupOrphanCategories(req, res, next)
    } catch (error) {
      next(error)
    }
  },
)

// Get category by slug (with properties for frontend filters)
router.get('/slug/:slug', cacheMiddleware(CACHE_TTL.LONG), categoryController.getCategoryBySlug)

// ============================================
// Ù„ÛŒØ³Øª Ùˆ Ø§ÛŒØ¬Ø§Ø¯ Ø¯Ø³ØªÙ‡â€ŒØ¨Ù†Ø¯ÛŒ
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
// Ø¯Ø±ÛŒØ§ÙØªØŒ ÙˆÛŒØ±Ø§ÛŒØ´ Ùˆ Ø­Ø°Ù Ø¯Ø³ØªÙ‡â€ŒØ¨Ù†Ø¯ÛŒ
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
