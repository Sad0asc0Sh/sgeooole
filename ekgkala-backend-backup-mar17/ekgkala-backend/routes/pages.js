const express = require('express')
const router = express.Router()

const { getPageBySlug, getAdminPages, createPage, updatePage, deletePage } = require('../controllers/pageController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// روت‌های عمومی صفحات (برای فرانت‌اند)
// ============================================

// GET /api/pages/slug/:slug - دریافت صفحه با slug (عمومی)
router.get('/slug/:slug', getPageBySlug)

// ============================================
// روت‌های مدیریت صفحات (ادمین)
// مجوزهای مورد نیاز: PAGE_READ, PAGE_CREATE, PAGE_UPDATE, PAGE_DELETE
// ============================================

// GET /api/pages - لیست صفحات (برای پنل ادمین)
router.get('/', protect, checkPermission(PERMISSIONS.PAGE_READ), getAdminPages)

// POST /api/pages - ایجاد صفحه جدید
router.post('/', protect, checkPermission(PERMISSIONS.PAGE_CREATE), createPage)

// PUT /api/pages/:id - ویرایش صفحه
router.put('/:id', protect, checkPermission(PERMISSIONS.PAGE_UPDATE), updatePage)

// DELETE /api/pages/:id - حذف صفحه
router.delete('/:id', protect, checkPermission(PERMISSIONS.PAGE_DELETE), deletePage)

module.exports = router


