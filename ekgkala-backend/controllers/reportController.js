const Order = require('../models/Order')
const Product = require('../models/Product')
const User = require('../models/Admin')

// Helpers
const parseDate = (value, fallback) => {
  if (!value) return fallback
  const d = new Date(value)
  // Invalid date
  if (Number.isNaN(d.getTime())) return fallback
  return d
}

// GET /api/reports/sales
// گزارش فروش با فیلتر تاریخ و تجمیع روزانه/ماهانه
exports.getSalesReports = async (req, res) => {
  try {
    const now = new Date()
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const defaultEnd = now

    const startDate = parseDate(req.query.startDate, defaultStart)
    const endDate = parseDate(req.query.endDate, defaultEnd)

    // نرمال‌سازی انتهای بازه به انتهای روز
    const endOfRange = new Date(endDate)
    endOfRange.setHours(23, 59, 59, 999)

    const diffMs = endOfRange.getTime() - startDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    const useMonthly = diffDays > 31
    const dateFormat = useMonthly ? '%Y-%m' : '%Y-%m-%d'

    const matchStage = {
      isPaid: true,
      createdAt: {
        $gte: startDate,
        $lte: endOfRange,
      },
    }

    const seriesAgg = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
            },
          },
          totalSales: { $sum: '$totalPrice' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const summaryAgg = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalPrice' },
          ordersCount: { $sum: 1 },
        },
      },
    ])

    const summaryDoc = summaryAgg[0] || { totalSales: 0, ordersCount: 0 }

    const series = seriesAgg.map((item) => ({
      bucket: item._id,
      totalSales: item.totalSales || 0,
      ordersCount: item.ordersCount || 0,
    }))

    res.json({
      success: true,
      data: {
        summary: {
          totalSales: summaryDoc.totalSales || 0,
          ordersCount: summaryDoc.ordersCount || 0,
          startDate: startDate.toISOString(),
          endDate: endOfRange.toISOString(),
        },
        series,
        granularity: useMonthly ? 'month' : 'day',
      },
    })
  } catch (error) {
    console.error('Error generating sales report:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در تهیه گزارش فروش',
      error: error.message,
    })
  }
}

// GET /api/reports/products
// گزارش محصولات: پرفروش‌ترین‌ها و محصولات با موجودی کم
exports.getProductReports = async (req, res) => {
  try {
    // پرفروش‌ترین محصولات بر اساس تعداد آیتم‌های فروخته‌شده
    const topSelling = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          totalQuantity: { $sum: '$orderItems.quantity' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 0,
          productId: '$product._id',
          name: '$product.name',
          sku: '$product.sku',
          totalQuantity: 1,
        },
      },
    ])

    // محصولات با موجودی کم
    const lowStockDocs = await Product.find({ stock: { $lt: 10 }, isActive: true })
      .select('name sku stock')
      .sort({ stock: 1 })
      .limit(50)
      .lean()

    const lowStock = lowStockDocs.map((p) => ({
      productId: p._id,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
    }))

    res.json({
      success: true,
      data: {
        topSelling,
        lowStock,
      },
    })
  } catch (error) {
    console.error('Error generating product report:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در تهیه گزارش محصولات',
      error: error.message,
    })
  }
}

// GET /api/reports/customers
// گزارش مشتریان: برترین خریداران بر اساس تعداد و مجموع خرید
exports.getCustomerReports = async (req, res) => {
  try {
    const agg = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: '$user',
          ordersCount: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'admins',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          name: '$user.name',
          email: '$user.email',
          ordersCount: 1,
          totalSpent: 1,
        },
      },
    ])

    res.json({
      success: true,
      data: agg,
    })
  } catch (error) {
    console.error('Error generating customer report:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در تهیه گزارش مشتریان',
      error: error.message,
    })
  }
}


// ============================================
// GET /api/reports/delivered-items
// تاریخچه اقلام تحویل‌شده به مشتریان
// Query params:
//   page, limit     → صفحه‌بندی (limit حداکثر 2000 برای خروجی گرفتن)
//   startDate       → شروع بازه تحویل (ISO)
//   endDate         → پایان بازه تحویل (ISO، تا انتهای روز)
//   search          → جست‌وجو در کد سفارش، نام محصول، نام/تلفن/شهر مشتری
// ============================================
exports.getDeliveredItemsReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 2000)
    const skip = (page - 1) * limit

    const basePipeline = [{ $match: { orderStatus: 'Delivered' } }]

    // تاریخ تحویل: deliveredAt در سفارش‌های قدیمی ممکن است خالی باشد → fallback به updatedAt
    basePipeline.push({
      $addFields: { deliveryDate: { $ifNull: ['$deliveredAt', '$updatedAt'] } },
    })

    // فیلتر بازه تاریخ تحویل
    const startDate = parseDate(req.query.startDate, null)
    let endDate = parseDate(req.query.endDate, null)
    if (endDate) {
      endDate = new Date(endDate)
      endDate.setHours(23, 59, 59, 999)
    }
    const dateMatch = {}
    if (startDate) dateMatch.$gte = startDate
    if (endDate) dateMatch.$lte = endDate
    if (Object.keys(dateMatch).length > 0) {
      basePipeline.push({ $match: { deliveryDate: dateMatch } })
    }

    // جست‌وجو
    const search = (req.query.search || '').trim()
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = { $regex: escaped, $options: 'i' }
      basePipeline.push({
        $match: {
          $or: [
            { orderCode: rx },
            { 'orderItems.name': rx },
            { 'shippingAddress.fullName': rx },
            { 'shippingAddress.phone': rx },
            { 'shippingAddress.city': rx },
          ],
        },
      })
    }

    const [result] = await Order.aggregate([
      ...basePipeline,
      {
        $facet: {
          // آمار کلی روی همان فیلترها (بدون صفحه‌بندی)
          summary: [
            { $unwind: '$orderItems' },
            {
              $group: {
                _id: null,
                totalRows: { $sum: 1 },
                totalUnits: { $sum: '$orderItems.quantity' },
                totalRevenue: {
                  $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] },
                },
                orders: { $addToSet: '$_id' },
                customers: { $addToSet: '$user' },
              },
            },
            {
              $project: {
                _id: 0,
                totalRows: 1,
                totalUnits: 1,
                totalRevenue: 1,
                ordersCount: { $size: '$orders' },
                customersCount: { $size: '$customers' },
              },
            },
          ],
          // ردیف‌های صفحه جاری (به‌تفکیک هر قلم سفارش)
          items: [
            { $sort: { deliveryDate: -1, createdAt: -1 } },
            { $unwind: '$orderItems' },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'customer',
              },
            },
            { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                orderId: '$_id',
                orderCode: 1,
                deliveryDate: 1,
                orderTotal: '$totalPrice',
                productName: '$orderItems.name',
                variantLabel: {
                  $reduce: {
                    input: { $ifNull: ['$orderItems.variantOptions', []] },
                    initialValue: '',
                    in: {
                      $concat: [
                        '$$value',
                        { $cond: [{ $eq: ['$$value', ''] }, '', '، '] },
                        '$$this.name',
                        ': ',
                        '$$this.value',
                      ],
                    },
                  },
                },
                quantity: '$orderItems.quantity',
                unitPrice: '$orderItems.price',
                lineTotal: { $multiply: ['$orderItems.quantity', '$orderItems.price'] },
                customerName: {
                  $ifNull: ['$shippingAddress.fullName', '$customer.name'],
                },
                customerPhone: {
                  $ifNull: ['$shippingAddress.phone', '$customer.mobile'],
                },
                customerCity: '$shippingAddress.city',
              },
            },
          ],
        },
      },
    ])

    const summary = result?.summary?.[0] || {
      totalRows: 0,
      totalUnits: 0,
      totalRevenue: 0,
      ordersCount: 0,
      customersCount: 0,
    }
    const items = result?.items || []
    const totalItems = summary.totalRows || 0

    res.json({
      success: true,
      data: {
        items,
        summary,
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalItems,
          totalPages: totalItems > 0 ? Math.ceil(totalItems / limit) : 0,
        },
      },
    })
  } catch (error) {
    console.error('Error generating delivered items report:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در تهیه تاریخچه تحویل محصولات',
      error: error.message,
    })
  }
}
