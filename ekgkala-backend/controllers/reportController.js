const Order = require('../models/Order')
const Product = require('../models/Product')
const User = require('../models/Admin')

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000

const tehranDateKey = (date) => {
  const d = new Date(new Date(date).getTime() + TEHRAN_OFFSET_MS)
  return d.toISOString().slice(0, 10)
}

// Helpers
const parseDate = (value, fallback) => {
  if (!value) return fallback
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d
}

// GET /api/reports/sales
// گزارش جامع فروش با فیلتر تاریخ، مقایسه با دوره قبل، و تفکیک وضعیت/روش پرداخت
exports.getSalesReports = async (req, res) => {
  try {
    const now = new Date()
    const defaultStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    defaultStart.setHours(0, 0, 0, 0)
    const defaultEnd = now

    const startDate = parseDate(req.query.startDate, defaultStart)
    const endDate = parseDate(req.query.endDate, defaultEnd)

    const endOfRange = new Date(endDate)
    endOfRange.setHours(23, 59, 59, 999)

    const diffMs = Math.max(1, endOfRange.getTime() - startDate.getTime())
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    const useMonthly = diffDays > 60
    const dateFormat = useMonthly ? '%Y-%m' : '%Y-%m-%d'

    const prevEnd = new Date(startDate.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - diffMs)

    const paidMatch = {
      isPaid: true,
      createdAt: { $gte: startDate, $lte: endOfRange },
    }
    const allRangeMatch = {
      createdAt: { $gte: startDate, $lte: endOfRange },
    }

    const [
      seriesAgg,
      summaryAgg,
      prevSummaryAgg,
      statusAgg,
      paymentAgg,
    ] = await Promise.all([
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: dateFormat,
                date: '$createdAt',
                timezone: '+03:30',
              },
            },
            totalSales: { $sum: '$totalPrice' },
            ordersCount: { $sum: 1 },
            totalDiscount: { $sum: { $ifNull: ['$totalDiscount', 0] } },
            itemsSold: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ['$orderItems', []] },
                  initialValue: 0,
                  in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] },
                },
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalPrice' },
            grossItemsSales: { $sum: { $ifNull: ['$itemsPrice', '$totalPrice'] } },
            totalDiscount: { $sum: { $ifNull: ['$totalDiscount', 0] } },
            totalShipping: { $sum: { $ifNull: ['$shippingPrice', 0] } },
            ordersCount: { $sum: 1 },
            totalItemsSold: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ['$orderItems', []] },
                  initialValue: 0,
                  in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] },
                },
              },
            },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            isPaid: true,
            createdAt: { $gte: prevStart, $lte: prevEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalPrice' },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: allRangeMatch },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: {
              method: { $ifNull: ['$paymentMethod', 'online'] },
              gateway: { $ifNull: ['$paymentGateway', 'none'] },
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
    ])

    const summaryDoc = summaryAgg[0] || {
      totalSales: 0,
      grossItemsSales: 0,
      totalDiscount: 0,
      totalShipping: 0,
      ordersCount: 0,
      totalItemsSold: 0,
    }

    const prevSales = prevSummaryAgg[0]?.totalSales || 0
    const salesGrowth =
      prevSales > 0
        ? Number((((summaryDoc.totalSales - prevSales) / prevSales) * 100).toFixed(1))
        : summaryDoc.totalSales > 0
          ? 100
          : 0

    let allOrdersCount = 0
    let cancelledOrdersCount = 0
    const statusBreakdown = statusAgg.map((s) => {
      allOrdersCount += s.count || 0
      if (s._id === 'Cancelled') cancelledOrdersCount += s.count || 0
      return {
        status: s._id || 'Pending',
        count: s.count || 0,
        totalAmount: Math.round(s.totalAmount || 0),
      }
    })

    const unpaidOrdersCount = Math.max(0, allOrdersCount - summaryDoc.ordersCount)
    const cancellationRate =
      allOrdersCount > 0
        ? Number(((cancelledOrdersCount / allOrdersCount) * 100).toFixed(1))
        : 0
    const averageOrderValue =
      summaryDoc.ordersCount > 0
        ? Math.round(summaryDoc.totalSales / summaryDoc.ordersCount)
        : 0

    let series = []
    if (!useMonthly && diffDays <= 90) {
      const bucketMap = new Map()
      seriesAgg.forEach((item) => {
        bucketMap.set(item._id, item)
      })
      const cursor = new Date(startDate)
      cursor.setHours(12, 0, 0, 0)
      const endCursor = new Date(endOfRange)
      endCursor.setHours(12, 0, 0, 0)
      const seenKeys = new Set()
      while (cursor <= endCursor) {
        const key = tehranDateKey(cursor)
        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          const hit = bucketMap.get(key)
          const tSales = Math.round(hit?.totalSales || 0)
          const oCount = hit?.ordersCount || 0
          series.push({
            bucket: key,
            totalSales: tSales,
            ordersCount: oCount,
            itemsSold: hit?.itemsSold || 0,
            totalDiscount: Math.round(hit?.totalDiscount || 0),
            avgOrderValue: oCount > 0 ? Math.round(tSales / oCount) : 0,
          })
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    } else {
      series = seriesAgg.map((item) => {
        const tSales = Math.round(item.totalSales || 0)
        const oCount = item.ordersCount || 0
        return {
          bucket: item._id,
          totalSales: tSales,
          ordersCount: oCount,
          itemsSold: item.itemsSold || 0,
          totalDiscount: Math.round(item.totalDiscount || 0),
          avgOrderValue: oCount > 0 ? Math.round(tSales / oCount) : 0,
        }
      })
    }

    const paymentMethodBreakdown = paymentAgg.map((p) => ({
      method: p._id?.method || 'online',
      gateway: p._id?.gateway || 'none',
      count: p.count || 0,
      totalAmount: Math.round(p.totalAmount || 0),
    }))

    res.json({
      success: true,
      data: {
        summary: {
          totalSales: Math.round(summaryDoc.totalSales || 0),
          grossItemsSales: Math.round(summaryDoc.grossItemsSales || 0),
          totalDiscount: Math.round(summaryDoc.totalDiscount || 0),
          totalShipping: Math.round(summaryDoc.totalShipping || 0),
          ordersCount: summaryDoc.ordersCount || 0,
          allOrdersCount,
          cancelledOrdersCount,
          unpaidOrdersCount,
          averageOrderValue,
          totalItemsSold: summaryDoc.totalItemsSold || 0,
          cancellationRate,
          previousPeriodSales: Math.round(prevSales),
          salesGrowth,
          startDate: startDate.toISOString(),
          endDate: endOfRange.toISOString(),
        },
        series,
        statusBreakdown,
        paymentMethodBreakdown,
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
// گزارش جامع محصولات: پرفروش‌ها، ناموجودها، کم‌موجودی‌ها، و فروش دسته‌بندی‌ها
exports.getProductReports = async (req, res) => {
  try {
    const threshold = Math.max(1, Math.min(100, parseInt(req.query.lowStockThreshold, 10) || 10))
    const startDate = parseDate(req.query.startDate, null)
    let endDate = parseDate(req.query.endDate, null)
    if (endDate) {
      endDate = new Date(endDate)
      endDate.setHours(23, 59, 59, 999)
    }

    const orderMatch = { isPaid: true }
    if (startDate || endDate) {
      orderMatch.createdAt = {}
      if (startDate) orderMatch.createdAt.$gte = startDate
      if (endDate) orderMatch.createdAt.$lte = endDate
    }

    const effectiveStockExpr = {
      $cond: [
        { $eq: ['$productType', 'variable'] },
        { $sum: { $ifNull: ['$variants.stock', []] } },
        { $ifNull: ['$stock', 0] },
      ],
    }

    const effectivePriceExpr = {
      $cond: [
        {
          $and: [
            { $eq: ['$productType', 'variable'] },
            { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] },
          ],
        },
        { $min: '$variants.price' },
        { $ifNull: ['$price', 0] },
      ],
    }

    const [
      topSelling,
      categorySales,
      catalogSummaryAgg,
      lowStockDocs,
      outOfStockDocs,
    ] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.product',
            fallbackName: { $first: '$orderItems.name' },
            totalQuantity: { $sum: '$orderItems.quantity' },
            totalRevenue: {
              $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] },
            },
            orderIds: { $addToSet: '$_id' },
          },
        },
        { $sort: { totalRevenue: -1, totalQuantity: -1 } },
        { $limit: 30 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'categoryDoc',
          },
        },
        { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: { $ifNull: ['$product.name', '$fallbackName'] },
            sku: { $ifNull: ['$product.sku', ''] },
            categoryName: { $ifNull: ['$categoryDoc.name', '—'] },
            price: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$product.productType', 'variable'] },
                    { $gt: [{ $size: { $ifNull: ['$product.variants', []] } }, 0] },
                  ],
                },
                { $min: '$product.variants.price' },
                { $ifNull: ['$product.price', 0] },
              ],
            },
            stock: {
              $cond: [
                { $eq: ['$product.productType', 'variable'] },
                { $sum: { $ifNull: ['$product.variants.stock', []] } },
                { $ifNull: ['$product.stock', 0] },
              ],
            },
            totalQuantity: 1,
            totalRevenue: { $round: ['$totalRevenue', 0] },
            ordersCount: { $size: '$orderIds' },
          },
        },
      ]),

      Order.aggregate([
        { $match: orderMatch },
        { $unwind: '$orderItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderItems.product',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$product.category',
            totalQuantity: { $sum: '$orderItems.quantity' },
            totalRevenue: {
              $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] },
            },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryDoc',
          },
        },
        { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            categoryId: '$_id',
            name: { $ifNull: ['$categoryDoc.name', 'سایر'] },
            totalQuantity: 1,
            totalRevenue: { $round: ['$totalRevenue', 0] },
          },
        },
      ]),

      Product.aggregate([
        {
          $addFields: {
            effectiveStock: effectiveStockExpr,
            inventoryValue: {
              $cond: [
                { $eq: ['$productType', 'variable'] },
                {
                  $reduce: {
                    input: { $ifNull: ['$variants', []] },
                    initialValue: 0,
                    in: {
                      $add: [
                        '$$value',
                        {
                          $multiply: [
                            { $ifNull: ['$$this.price', 0] },
                            { $ifNull: ['$$this.stock', 0] },
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $multiply: [
                    { $ifNull: ['$price', 0] },
                    { $ifNull: ['$stock', 0] },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
            outOfStockCount: {
              $sum: {
                $cond: [
                  { $and: ['$isActive', { $lte: ['$effectiveStock', 0] }] },
                  1,
                  0,
                ],
              },
            },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      '$isActive',
                      { $gt: ['$effectiveStock', 0] },
                      { $lte: ['$effectiveStock', threshold] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalInventoryValue: {
              $sum: { $cond: ['$isActive', '$inventoryValue', 0] },
            },
          },
        },
      ]),

      Product.aggregate([
        { $match: { isActive: true } },
        {
          $addFields: {
            effectiveStock: effectiveStockExpr,
            effectivePrice: effectivePriceExpr,
          },
        },
        { $match: { effectiveStock: { $gt: 0, $lte: threshold } } },
        { $sort: { effectiveStock: 1, updatedAt: -1 } },
        { $limit: 50 },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: 1,
            sku: { $ifNull: ['$sku', ''] },
            productType: { $ifNull: ['$productType', 'simple'] },
            price: '$effectivePrice',
            stock: '$effectiveStock',
          },
        },
      ]),

      Product.aggregate([
        { $match: { isActive: true } },
        {
          $addFields: {
            effectiveStock: effectiveStockExpr,
            effectivePrice: effectivePriceExpr,
          },
        },
        { $match: { effectiveStock: { $lte: 0 } } },
        { $sort: { updatedAt: -1 } },
        { $limit: 50 },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: 1,
            sku: { $ifNull: ['$sku', ''] },
            productType: { $ifNull: ['$productType', 'simple'] },
            price: '$effectivePrice',
            stock: '$effectiveStock',
          },
        },
      ]),
    ])

    const catalogStats = catalogSummaryAgg[0] || {
      totalProducts: 0,
      activeProducts: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      totalInventoryValue: 0,
    }

    const totalUnitsSold = topSelling.reduce((sum, p) => sum + (p.totalQuantity || 0), 0)
    const totalRevenue = topSelling.reduce((sum, p) => sum + (p.totalRevenue || 0), 0)

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts: catalogStats.totalProducts || 0,
          activeProducts: catalogStats.activeProducts || 0,
          outOfStockCount: catalogStats.outOfStockCount || 0,
          lowStockCount: catalogStats.lowStockCount || 0,
          totalInventoryValue: Math.round(catalogStats.totalInventoryValue || 0),
          totalUnitsSold,
          totalRevenue: Math.round(totalRevenue),
          lowStockThreshold: threshold,
        },
        topSelling,
        lowStock: lowStockDocs,
        outOfStock: outOfStockDocs,
        categorySales,
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
// گزارش مشتریان: خلاصه وفاداری، توزیع استانی و برترین خریداران
exports.getCustomerReports = async (req, res) => {
  try {
    const startDate = parseDate(req.query.startDate, null)
    let endDate = parseDate(req.query.endDate, null)
    if (endDate) {
      endDate = new Date(endDate)
      endDate.setHours(23, 59, 59, 999)
    }
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : ''

    const orderMatch = { isPaid: true }
    if (startDate || endDate) {
      orderMatch.createdAt = {}
      if (startDate) orderMatch.createdAt.$gte = startDate
      if (endDate) orderMatch.createdAt.$lte = endDate
    }

    const customerLookupPipeline = [
      { $match: orderMatch },
      {
        $group: {
          _id: '$user',
          ordersCount: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' },
          lastOrderAt: { $max: '$createdAt' },
          province: { $last: '$shippingAddress.province' },
          city: { $last: '$shippingAddress.city' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = { $regex: escaped, $options: 'i' }
      customerLookupPipeline.push({
        $match: {
          $or: [
            { 'user.name': rx },
            { 'user.email': rx },
            { 'user.mobile': rx },
            { city: rx },
            { province: rx },
          ],
        },
      })
    }

    const [
      totalCustomers,
      newCustomersInPeriod,
      customerAggResult,
      provinceBreakdown,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      startDate || endDate
        ? User.countDocuments({
            role: 'user',
            createdAt: {
              ...(startDate ? { $gte: startDate } : {}),
              ...(endDate ? { $lte: endDate } : {}),
            },
          })
        : User.countDocuments({
            role: 'user',
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          }),

      Order.aggregate([
        ...customerLookupPipeline,
        {
          $facet: {
            metrics: [
              {
                $group: {
                  _id: null,
                  buyingCustomers: { $sum: 1 },
                  repeatCustomers: {
                    $sum: { $cond: [{ $gte: ['$ordersCount', 2] }, 1, 0] },
                  },
                  totalRevenue: { $sum: '$totalSpent' },
                },
              },
            ],
            topCustomers: [
              { $sort: { totalSpent: -1, ordersCount: -1 } },
              { $limit: 100 },
              {
                $project: {
                  _id: 0,
                  userId: '$_id',
                  name: { $ifNull: ['$user.name', 'مشتری'] },
                  email: { $ifNull: ['$user.email', ''] },
                  mobile: { $ifNull: ['$user.mobile', ''] },
                  province: { $ifNull: ['$province', { $ifNull: ['$user.province', ''] }] },
                  city: { $ifNull: ['$city', { $ifNull: ['$user.city', ''] }] },
                  ordersCount: 1,
                  totalSpent: { $round: ['$totalSpent', 0] },
                  avgOrderValue: {
                    $round: [{ $divide: ['$totalSpent', '$ordersCount'] }, 0],
                  },
                  lastOrderAt: 1,
                  createdAt: '$user.createdAt',
                },
              },
            ],
          },
        },
      ]),

      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: {
              $ifNull: [
                {
                  $cond: [
                    { $ne: [{ $ifNull: ['$shippingAddress.province', ''] }, ''] },
                    '$shippingAddress.province',
                    '$shippingAddress.city',
                  ],
                },
                'نامشخص',
              ],
            },
            ordersCount: { $sum: 1 },
            totalRevenue: { $sum: '$totalPrice' },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            province: '$_id',
            ordersCount: 1,
            totalRevenue: { $round: ['$totalRevenue', 0] },
          },
        },
      ]),
    ])

    const metrics = customerAggResult?.[0]?.metrics?.[0] || {
      buyingCustomers: 0,
      repeatCustomers: 0,
      totalRevenue: 0,
    }
    const topCustomers = customerAggResult?.[0]?.topCustomers || []

    const buyingCustomers = metrics.buyingCustomers || 0
    const repeatCustomers = metrics.repeatCustomers || 0
    const totalRevenue = Math.round(metrics.totalRevenue || 0)
    const repeatRate =
      buyingCustomers > 0
        ? Number(((repeatCustomers / buyingCustomers) * 100).toFixed(1))
        : 0
    const averageLTV =
      buyingCustomers > 0 ? Math.round(totalRevenue / buyingCustomers) : 0

    res.json({
      success: true,
      data: {
        summary: {
          totalCustomers,
          buyingCustomers,
          repeatCustomers,
          repeatRate,
          newCustomersInPeriod,
          totalRevenue,
          averageLTV,
        },
        topCustomers,
        provinceBreakdown,
      },
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
// ============================================
exports.getDeliveredItemsReport = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const basePipeline = [{ $match: { orderStatus: 'Delivered' } }]

    basePipeline.push({
      $addFields: { deliveryDate: { $ifNull: ['$deliveredAt', '$updatedAt'] } },
    })

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

    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : ''
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
