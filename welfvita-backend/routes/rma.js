const express = require('express')
const router = express.Router()
const {
  getAllRMAs,
  getRMAById,
  updateRMAStatus,
} = require('../controllers/rmaController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت‌های مدیریت RMA (درخواست مرجوعی)
// مجوزهای مورد نیاز: RMA_READ, RMA_UPDATE_STATUS
// ============================================

// GET /api/rma/admin - دریافت لیست تمام RMAها
router.get('/admin', protect, checkPermission(PERMISSIONS.RMA_READ), getAllRMAs)

// GET /api/rma/:id - دریافت جزئیات یک RMA
router.get('/:id', protect, checkPermission(PERMISSIONS.RMA_READ), getRMAById)

// PUT /api/rma/:id/status - به‌روزرسانی وضعیت RMA
router.put(
  '/:id/status',
  protect,
  checkPermission(PERMISSIONS.RMA_UPDATE_STATUS),
  updateRMAStatus,
)

module.exports = router

