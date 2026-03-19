const express = require('express')
const router = express.Router()
const {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require('../controllers/addressController')
const { protect } = require('../middleware/auth')

// ============================================
// Customer Routes (All require authentication)
// ============================================

// GET /api/addresses - دریافت لیست آدرس‌های کاربر
router.get('/', protect, getUserAddresses)

// POST /api/addresses - ایجاد آدرس جدید
router.post('/', protect, createAddress)

// PUT /api/addresses/:id - ویرایش آدرس
router.put('/:id', protect, updateAddress)

// DELETE /api/addresses/:id - حذف آدرس
router.delete('/:id', protect, deleteAddress)

// PUT /api/addresses/:id/set-default - تنظیم آدرس پیش‌فرض
router.put('/:id/set-default', protect, setDefaultAddress)

module.exports = router
