const RMA = require('../models/RMA')

// ============================================
// GET /api/rma/admin - دریافت لیست تمام RMAها
// با قابلیت pagination و فیلتر بر اساس status
// ============================================
exports.getAllRMAs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}

    // فیلتر بر اساس وضعیت RMA
    if (req.query.status) {
      filter.status = req.query.status
    }

    // جستجو بر اساس شماره سفارش
    if (req.query.orderId) {
      filter.order = req.query.orderId
    }

    const totalItems = await RMA.countDocuments(filter)

    const rmas = await RMA.find(filter)
      .populate('user', 'name email')
      .populate('order', '_id orderStatus totalPrice createdAt')
      .populate('items.product', 'name images sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: rmas,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching RMAs:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست مرجوعی‌ها',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/rma/:id - دریافت جزئیات یک RMA
// با populate کامل user، order و products
// ============================================
exports.getRMAById = async (req, res) => {
  try {
    const rma = await RMA.findById(req.params.id)
      .populate('user', 'name email mobile')
      .populate({
        path: 'order',
        select: '_id orderStatus totalPrice createdAt orderItems shippingAddress',
        populate: {
          path: 'orderItems.product',
          select: 'name images sku',
        },
      })
      .populate('items.product', 'name images sku price')
      .lean()

    if (!rma) {
      return res.status(404).json({
        success: false,
        message: 'درخواست مرجوعی یافت نشد',
      })
    }

    res.json({
      success: true,
      data: rma,
    })
  } catch (error) {
    console.error('Error fetching RMA:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت جزئیات مرجوعی',
      error: error.message,
    })
  }
}

// ============================================
// PUT /api/rma/:id/status - به‌روزرسانی وضعیت RMA
// فقط برای ادمین
// ============================================
exports.updateRMAStatus = async (req, res) => {
  try {
    const { status, adminNotes, refundAmount } = req.body

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت جدید الزامی است',
      })
    }

    const validStatuses = ['Pending', 'Approved', 'Rejected', 'Processing', 'Completed']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت نامعتبر است',
      })
    }

    const rma = await RMA.findById(req.params.id)
    if (!rma) {
      return res.status(404).json({
        success: false,
        message: 'درخواست مرجوعی یافت نشد',
      })
    }

    const updates = {
      status,
    }

    // تنظیم تاریخ بر اساس وضعیت
    if (status === 'Approved' && !rma.approvedAt) {
      updates.approvedAt = new Date()
    }
    if (status === 'Rejected' && !rma.rejectedAt) {
      updates.rejectedAt = new Date()
    }
    if (status === 'Completed' && !rma.completedAt) {
      updates.completedAt = new Date()
    }

    // نرمال‌سازی یادداشت ادمین
    if (adminNotes !== undefined) {
      let normalizedAdminNotes
      if (Array.isArray(adminNotes)) {
        normalizedAdminNotes = adminNotes.join('\n')
      } else if (adminNotes === null) {
        normalizedAdminNotes = ''
      } else {
        normalizedAdminNotes = String(adminNotes)
      }
      updates.adminNotes = normalizedAdminNotes
    }

    // اضافه کردن مبلغ بازپرداختی (اختیاری)
    if (refundAmount !== undefined && refundAmount !== null) {
      updates.refundAmount = Number(refundAmount)
    }

    const updatedRMA = await RMA.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: false,
      },
    )

    res.json({
      success: true,
      message: 'وضعیت مرجوعی با موفقیت به‌روزرسانی شد',
      data: updatedRMA,
    })
  } catch (error) {
    console.error('Error updating RMA status:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی وضعیت مرجوعی',
      error: error.message,
    })
  }
}
