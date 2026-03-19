const express = require('express')
const router = express.Router()
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { clearAllCache, clearCacheByKey, clearCacheByPrefix } = require('../middleware/cache')

// ============================================
// POST /api/cache/clear - پاک کردن کش
// مجوز مورد نیاز: CACHE_CLEAR
// ============================================
router.post(
  '/clear',
  protect,
  checkPermission(PERMISSIONS.CACHE_CLEAR),
  async (req, res) => {
    const { key, prefix } = req.body || {}

    if (key) {
      clearCacheByKey(key)
    } else if (prefix) {
      clearCacheByPrefix(prefix)
    } else {
      clearAllCache()
    }

    res.json({
      success: true,
      message: 'Cache cleared',
      key: key || undefined,
      prefix: prefix || undefined,
    })
  }
)

module.exports = router

