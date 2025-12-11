const express = require('express')
const router = express.Router()
const {
  getActiveAnnouncement,
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcementController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت عمومی (برای فرانت‌اند سایت مشتری)
// ============================================
router.get('/active', getActiveAnnouncement)

// ============================================
// روت‌های ادمین (محافظت شده)
// مجوزهای مورد نیاز: ANNOUNCEMENT_READ, ANNOUNCEMENT_CREATE, ANNOUNCEMENT_UPDATE, ANNOUNCEMENT_DELETE
// ============================================

// GET /api/announcements/admin - دریافت لیست اعلان‌ها
router.get('/admin', protect, checkPermission(PERMISSIONS.ANNOUNCEMENT_READ), getAllAnnouncements)

// POST /api/announcements/admin - ایجاد اعلان جدید
router.post('/admin', protect, checkPermission(PERMISSIONS.ANNOUNCEMENT_CREATE), createAnnouncement)

// PUT /api/announcements/admin/:id - ویرایش اعلان
router.put('/admin/:id', protect, checkPermission(PERMISSIONS.ANNOUNCEMENT_UPDATE), updateAnnouncement)

// DELETE /api/announcements/admin/:id - حذف اعلان
router.delete('/admin/:id', protect, checkPermission(PERMISSIONS.ANNOUNCEMENT_DELETE), deleteAnnouncement)

module.exports = router

