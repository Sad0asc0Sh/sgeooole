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

