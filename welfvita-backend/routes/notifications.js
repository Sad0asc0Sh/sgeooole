const express = require('express')
const router = express.Router()
const {
    getUserNotifications,
    markAsRead,
    sendNotification,
} = require('../controllers/notificationController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// User Routes (برای کاربران لاگین شده)
// ============================================

// GET /api/notifications - دریافت نوتیفیکیشن‌های کاربر
router.get('/', protect, getUserNotifications)

// PUT /api/notifications/:id/read - علامت‌گذاری به عنوان خوانده شده
router.put('/:id/read', protect, markAsRead)

// ============================================
// Admin Routes (نیاز به مجوز)
// ============================================

// POST /api/notifications/send - ارسال نوتیفیکیشن (فقط ادمین)
router.post('/send', protect, checkPermission(PERMISSIONS.ANNOUNCEMENT_CREATE), sendNotification)

module.exports = router

