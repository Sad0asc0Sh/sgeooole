const Coupon = require('../models/Coupon')

// ============================================
// POST /api/coupons - ایجاد کوپن جدید (فقط برای ادمین)
// ============================================
exports.createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minPurchase, expiresAt, isActive, usageLimit } =
      req.body

    // بررسی فیلدهای الزامی
    if (!code || !discountType || discountValue === undefined || !expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'کد، نوع تخفیف، مقدار تخفیف و تاریخ انقضا الزامی هستند',
      })
    }

    // بررسی نوع تخفیف
    if (!['percent', 'fixed'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'نوع تخفیف باید percent یا fixed باشد',
      })
    }

    // بررسی مقدار تخفیف درصدی
    if (discountType === 'percent' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: 'مقدار تخفیف درصدی باید بین 0 تا 100 باشد',
      })
    }

    // بررسی تاریخ انقضا
    if (new Date(expiresAt) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'تاریخ انقضا باید در آینده باشد',
      })
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minPurchase: minPurchase || 0,
      expiresAt,
      isActive: isActive !== undefined ? isActive : true,
      usageLimit: usageLimit || null,
    })

    res.status(201).json({
      success: true,
      message: 'کوپن با موفقیت ایجاد شد',
      data: coupon,
    })
  } catch (error) {
    console.error('Error creating coupon:', error)

    // خطای کد تکراری
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'این کد تخفیف قبلاً ثبت شده است',
      })
    }

    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد کوپن',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/coupons - دریافت لیست کوپن‌ها (فقط برای ادمین)
// ============================================
exports.getAllCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}

    // فیلتر بر اساس وضعیت فعال/غیرفعال
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true'
    }

    // فیلتر بر اساس نوع تخفیف
    if (req.query.discountType) {
      filter.discountType = req.query.discountType
    }

    // جستجو در کد
    if (req.query.search) {
      filter.code = { $regex: req.query.search, $options: 'i' }
    }

    const totalCoupons = await Coupon.countDocuments(filter)
    const coupons = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: coupons,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: totalCoupons,
        totalPages: Math.ceil(totalCoupons / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching coupons:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست کوپن‌ها',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/coupons/:id - دریافت جزئیات یک کوپن (فقط برای ادمین)
// ============================================
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id).lean()

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'کوپن مورد نظر یافت نشد',
      })
    }

    res.json({
      success: true,
      data: coupon,
    })
  } catch (error) {
    console.error('Error fetching coupon:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات کوپن',
      error: error.message,
    })
  }
}

// ============================================
// PUT /api/coupons/:id - به‌روزرسانی کوپن (فقط برای ادمین)
// ============================================
exports.updateCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minPurchase, expiresAt, isActive, usageLimit } =
      req.body

    const coupon = await Coupon.findById(req.params.id)

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'کوپن مورد نظر یافت نشد',
      })
    }

    // اعتبارسنجی نوع تخفیف
    if (discountType && !['percent', 'fixed'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'نوع تخفیف باید percent یا fixed باشد',
      })
    }

    // اعتبارسنجی مقدار تخفیف درصدی
    if (
      discountType === 'percent' &&
      discountValue !== undefined &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: 'مقدار تخفیف درصدی باید بین 0 تا 100 باشد',
      })
    }

    // اعتبارسنجی تاریخ انقضا
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'تاریخ انقضا باید در آینده باشد',
      })
    }

    // به‌روزرسانی فیلدها
    if (code !== undefined) coupon.code = code.toUpperCase()
    if (discountType !== undefined) coupon.discountType = discountType
    if (discountValue !== undefined) coupon.discountValue = discountValue
    if (minPurchase !== undefined) coupon.minPurchase = minPurchase
    if (expiresAt !== undefined) coupon.expiresAt = expiresAt
    if (isActive !== undefined) coupon.isActive = isActive
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit

    await coupon.save()

    res.json({
      success: true,
      message: 'کوپن با موفقیت به‌روزرسانی شد',
      data: coupon,
    })
  } catch (error) {
    console.error('Error updating coupon:', error)

    // خطای کد تکراری
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'این کد تخفیف قبلاً ثبت شده است',
      })
    }

    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی کوپن',
      error: error.message,
    })
  }
}

// ============================================
// DELETE /api/coupons/:id - حذف کوپن (فقط برای ادمین)
// ============================================
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'کوپن مورد نظر یافت نشد',
      })
    }

    await Coupon.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: 'کوپن با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting coupon:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف کوپن',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/coupons/validate/:code - اعتبارسنجی کد تخفیف (برای کاربران)
// این روت در آینده برای استفاده در فرانت‌اند سایت مشتری اضافه می‌شود
// ============================================
exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.params
    const { totalPrice } = req.query

    const coupon = await Coupon.findOne({ code: code.toUpperCase() })

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'کد تخفیف نامعتبر است',
      })
    }

    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'کد تخفیف منقضی شده یا غیرفعال است',
      })
    }

    const discount = totalPrice ? coupon.calculateDiscount(parseFloat(totalPrice)) : 0

    res.json({
      success: true,
      message: 'کد تخفیف معتبر است',
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minPurchase: coupon.minPurchase,
        discount: discount,
      },
    })
  } catch (error) {
    console.error('Error validating coupon:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در اعتبارسنجی کد تخفیف',
      error: error.message,
    })
  }
}
