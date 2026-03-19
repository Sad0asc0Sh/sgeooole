const Sale = require('../models/Sale')

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
    const { name, discountPercentage, startDate, endDate, products, isActive, badgeTheme } = req.body

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

    const saleData = {
      name,
      discountPercentage,
      startDate: start,
      endDate: end,
      products: products || [],
      isActive: isActive !== undefined ? isActive : true,
      badgeTheme: badgeTheme || 'green-orange',
    }

    const sale = await Sale.create(saleData)

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
    const { name, discountPercentage, startDate, endDate, products, isActive, badgeTheme } = req.body

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

    // بررسی تاریخ‌ها
    if (sale.endDate <= sale.startDate) {
      return res.status(400).json({
        success: false,
        message: 'تاریخ پایان باید بعد از تاریخ شروع باشد',
      })
    }

    await sale.save()

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
