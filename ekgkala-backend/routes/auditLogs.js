const express = require('express')
const router = express.Router()
const auditLogController = require('../controllers/auditLogController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// GET /api/audit-logs - دریافت لاگ‌های امنیتی
// مجوز مورد نیاز: ADMIN_READ
// ============================================
router.get('/', protect, checkPermission(PERMISSIONS.ADMIN_READ), auditLogController.getAuditLogs)

module.exports = router

