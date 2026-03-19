const express = require('express')
const router = express.Router()

const { getDashboardStats } = require('../controllers/dashboardController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// دریافت تمام آمارهای داشبورد در یک API واحد
// مجوز مورد نیاز: DASHBOARD_VIEW
// ============================================
router.get(
  '/stats',
  protect,
  checkPermission(PERMISSIONS.DASHBOARD_VIEW),
  getDashboardStats,
)

module.exports = router


