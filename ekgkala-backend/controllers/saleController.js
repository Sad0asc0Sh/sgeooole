const Sale = require('../models/Sale')
const { clearCacheByPrefix } = require('../middleware/cache')
const {
  findProductCampaignConflicts,
  getSaleProductIds,
  buildConflictMessage,
} = require('../services/campaignConflictService')

const clearProductCaches = () => {
  try {
    clearCacheByPrefix('/api/products')
    clearCacheByPrefix('/api/v1/admin/products')
  } catch (err) {
    console.warn('Could not clear product cache after sale change:', err.message)
  }
}

/**
 * جلوگیری از قرار گرفتن محصولی که قبلاً در «پیشنهاد لحظه‌ای» یا «شگفت‌انگیز» فعال است
 * داخل یک تخفیف زمان‌دار. اعضای فعلیِ همان تخفیف (هنگام ویرایش) مستثنی می‌شوند.
 * در صورت تداخل، پاسخ 409 ارسال می‌شود و مقدار برگشتی true است.
 *
 * توجه (race): این بررسی «بررسی-سپس-ذخیره» در سطح اپلیکیشن است؛ اگر دو ادمین
 * دقیقاً هم‌زمان ذخیره کنند، تضمین صددرصدی فقط با تراکنش/قفل دیتابیسی ممکن است.
 * برای همین، این چک درست قبل از save/create انجام می‌شود تا پنجره‌ی خطر حداقل باشد.
 */
const rejectIfCampaignConflict = async (res, { productIds, startDate, endDate, isActive, saleId }) => {
  if (isActive === false || !Array.isArray(productIds) || productIds.length === 0) return false
  if (endDate && new Date(endDate) <= new Date()) return false // تخفیفِ تمام‌شده دیگر تداخلی ایجاد نمی‌کند

  const exemptProductIds = saleId ? await getSaleProductIds(saleId) : []
  const conflicts = await findProductCampaignConflicts(productIds, {
    windowStart: startDate ? new Date(startDate) : undefined,
    exemptProductIds,
  })
  if (conflicts.length === 0) return false

  res.status(409).json({
    success: false,
    code: 'CAMPAIGN_CONFLICT',
    message: buildConflictMessage(conflicts),
    data: conflicts,
  })
  return true
}

/**
 * @desc    فهرست محصولاتی که در پیشنهاد لحظه‌ای / شگفت‌انگیز فعال‌اند (برای غیرفعال‌کردن در انتخابگر محصولات)
 * @route   GET /api/sales/admin/product-conflicts?excludeSaleId=&startDate=
 * @access  Private/Admin
 */
exports.getProductConflicts = async (req, res) => {
  try {
    const { excludeSaleId, startDate } = req.query
    const start = startDate ? new Date(startDate) : undefined
    const exemptProductIds = excludeSaleId ? await getSaleProductIds(excludeSaleId) : []

    const conflicts = await findProductCampaignConflicts([], {
      windowStart: start && !Number.isNaN(start.getTime()) ? start : undefined,
      exemptProductIds,
    })

    res.status(200).json({ success: true, data: conflicts })
  } catch (error) {
    console.error('Error fetching product campaign conflicts:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تداخل کمپین‌ها',
      error: error.message,
    })
  }
}

/**
 * @desc    دریافت لیست تمام تخفیف‌های زمان‌دار (برای ادمین)
 * @route   GET /api/sales/admin
 * @access  Private/Admin
 */
exports.getAllSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}

    // فیلتر بر اساس وضعیت فعال/غیرفعال
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true'
    }

    const total = await Sale.countDocuments(filter)
    const sales = await Sale.find(filter)
      .populate('products', 'name price images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.status(200).json({
      success: true,
      data: sales,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    })
  } catch (error) {
    console.error('Error fetching sales:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست تخفیف‌ها',
      error: error.message,
    })
  }
}

/**
 * @desc    دریافت یک تخفیف به‌خصوص
 * @route   GET /api/sales/admin/:id
 * @access  Private/Admin
 */
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params

    const sale = await Sale.findById(id).populate('products', 'name price images')

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'تخفیف یافت نشد',
      })
    }

    res.status(200).json({
      success: true,
      data: sale,
    })
  } catch (error) {
    console.error('Error fetching sale by id:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تخفیف',
      error: error.message,
    })
  }
}

/**
 * @desc    ایجاد تخفیف زمان‌دار جدید
 * @route   POST /api/sales/admin
 * @access  Private/Admin
 */
exports.createSale = async (req, res) => {
  try {
    const { name, discountPercentage, startDate, endDate, products, isActive, badgeTheme, showInFeatured } =
      req.body

    // Validation
    if (!name || !discountPercentage || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'نام، درصد تخفیف، تاریخ شروع و پایان الزامی هستند',
      })
    }

    // بررسی تاریخ‌ها
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'تاریخ پایان باید بعد از تاریخ شروع باشد',
      })
    }

    if (
      await rejectIfCampaignConflict(res, {
        productIds: products,
        startDate: start,
        endDate: end,
        isActive: isActive !== undefined ? isActive : true,
      })
    ) {
      return
    }

    const saleData = {
      name,
      discountPercentage,
      startDate: start,
      endDate: end,
      products: products || [],
      isActive: isActive !== undefined ? isActive : true,
      badgeTheme: badgeTheme || 'green-orange',
      showInFeatured: showInFeatured === undefined ? true : showInFeatured === true || showInFeatured === 'true',
    }

    const sale = await Sale.create(saleData)
    clearProductCaches()

    res.status(201).json({
      success: true,
      message: 'تخفیف زمان‌دار با موفقیت ایجاد شد',
      data: sale,
    })
  } catch (error) {
    console.error('Error creating sale:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد تخفیف',
      error: error.message,
    })
  }
}

/**
 * @desc    به‌روزرسانی تخفیف زمان‌دار
 * @route   PUT /api/sales/admin/:id
 * @access  Private/Admin
 */
exports.updateSale = async (req, res) => {
  try {
    const { id } = req.params
    const { name, discountPercentage, startDate, endDate, products, isActive, badgeTheme, showInFeatured } =
      req.body

    const sale = await Sale.findById(id)

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'تخفیف یافت نشد',
      })
    }

    // به‌روزرسانی فیلدها
    if (name !== undefined) sale.name = name
    if (discountPercentage !== undefined) sale.discountPercentage = discountPercentage
    if (startDate !== undefined) sale.startDate = new Date(startDate)
    if (endDate !== undefined) sale.endDate = new Date(endDate)
    if (products !== undefined) sale.products = products
    if (isActive !== undefined) sale.isActive = isActive
    if (badgeTheme !== undefined) sale.badgeTheme = badgeTheme
    if (showInFeatured !== undefined) sale.showInFeatured = showInFeatured === true || showInFeatured === 'true'

    // بررسی تاریخ‌ها
    if (sale.endDate <= sale.startDate) {
      return res.status(400).json({
        success: false,
        message: 'تاریخ پایان باید بعد از تاریخ شروع باشد',
      })
    }

    // بررسی تداخل با پیشنهاد لحظه‌ای / شگفت‌انگیز (اعضای فعلی همین تخفیف مستثنی هستند)
    if (
      await rejectIfCampaignConflict(res, {
        productIds: (sale.products || []).map(String),
        startDate: sale.startDate,
        endDate: sale.endDate,
        isActive: sale.isActive,
        saleId: sale._id,
      })
    ) {
      return
    }

    await sale.save()
    clearProductCaches()

    res.status(200).json({
      success: true,
      message: 'تخفیف با موفقیت به‌روزرسانی شد',
      data: sale,
    })
  } catch (error) {
    console.error('Error updating sale:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی تخفیف',
      error: error.message,
    })
  }
}

/**
 * @desc    حذف تخفیف زمان‌دار
 * @route   DELETE /api/sales/admin/:id
 * @access  Private/Admin
 */
exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params

    const sale = await Sale.findById(id)

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'تخفیف یافت نشد',
      })
    }

    await sale.deleteOne()
    clearProductCaches()

    res.status(200).json({
      success: true,
      message: 'تخفیف با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting sale:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف تخفیف',
      error: error.message,
    })
  }
}
