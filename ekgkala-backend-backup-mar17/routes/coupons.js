const express = require('express')
const router = express.Router()
const {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} = require('../controllers/couponController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// GET /api/coupons/validate/:code - اعتبارسنجی کد تخفیف
// این روت برای کاربران عادی (در فرانت‌اند سایت) است
// پارامتر query: totalPrice (مبلغ کل سبد خرید)
// ============================================
router.get('/validate/:code', validateCoupon)

// ============================================
// POST /api/coupons - ایجاد کوپن جدید
// مجوز مورد نیاز: COUPON_CREATE
// Body:
//   - code: کد تخفیف (الزامی)
//   - discountType: نوع تخفیف - percent یا fixed (الزامی)
//   - discountValue: مقدار تخفیف (الزامی)
//   - minPurchase: حداقل خرید (اختیاری)
//   - expiresAt: تاریخ انقضا (الزامی)
//   - isActive: وضعیت فعال/غیرفعال (اختیاری)
//   - usageLimit: محدودیت تعداد استفاده (اختیاری)
// ============================================
router.post('/', protect, checkPermission(PERMISSIONS.COUPON_CREATE), createCoupon)

// ============================================
// GET /api/coupons - دریافت لیست کوپن‌ها
// مجوز مورد نیاز: COUPON_READ
// پارامترهای Query:
//   - page: شماره صفحه (پیش‌فرض: 1)
//   - limit: تعداد آیتم در هر صفحه (پیش‌فرض: 20)
//   - isActive: فیلتر بر اساس وضعیت (true/false)
//   - discountType: فیلتر بر اساس نوع تخفیف (percent/fixed)
//   - search: جستجو در کد تخفیف
// ============================================
router.get('/', protect, checkPermission(PERMISSIONS.COUPON_READ), getAllCoupons)

// ============================================
// GET /api/coupons/:id - دریافت جزئیات یک کوپن
// مجوز مورد نیاز: COUPON_READ
// ============================================
router.get('/:id', protect, checkPermission(PERMISSIONS.COUPON_READ), getCouponById)

// ============================================
// PUT /api/coupons/:id - به‌روزرسانی کوپن
// مجوز مورد نیاز: COUPON_UPDATE
// Body: مشابه POST
// ============================================
router.put('/:id', protect, checkPermission(PERMISSIONS.COUPON_UPDATE), updateCoupon)

// ============================================
// DELETE /api/coupons/:id - حذف کوپن
// مجوز مورد نیاز: COUPON_DELETE
// ============================================
router.delete('/:id', protect, checkPermission(PERMISSIONS.COUPON_DELETE), deleteCoupon)

module.exports = router

