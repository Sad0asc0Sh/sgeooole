const Order = require('../models/Order')
const User = require('../models/Admin')
const Product = require('../models/Product')
const Ticket = require('../models/Ticket')
const Review = require('../models/Review')
const Cart = require('../models/Cart')
const Sale = require('../models/Sale')

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000

const tehranDateKey = (date) => {
  const d = new Date(new Date(date).getTime() + TEHRAN_OFFSET_MS)
  return d.toISOString().slice(0, 10)
}

const getTehranStartOfToday = (now = new Date()) => {
  const shifted = new Date(now.getTime() + TEHRAN_OFFSET_MS)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - TEHRAN_OFFSET_MS)
}

// GET /api/dashboard/stats
// آمار جامع مدیریتی برای داشبورد ادمین
exports.getDashboardStats = async (req, res) => {
  try {
    const rawDays = parseInt(req.query.days, 10)
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 7

    const now = new Date()
    const todayStart = getTehranStartOfToday(now)
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const periodStart = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const effectiveStockExpr = {
      $cond: [
        { $eq: ['$productType', 'variable'] },
        { $sum: { $ifNull: ['$variants.stock', []] } },
        { $ifNull: ['$stock', 0] },
      ],
    }

    const [
      allTimeSalesAgg,
      todaySalesAgg,
      periodSalesAgg,
      prevPeriodSalesAgg,
      last30SalesAgg,
      periodAllOrdersCount,
      periodPaidOrdersCount,
      orderStatusAgg,
      dailySeriesAgg,
      newOrders24h,
      newCustomers24h,
      newCustomersPeriod,
      totalCustomers,
      pendingOrders,
      openTickets,
      pendingReviews,
      abandonedCartsAgg,
      stockSummaryAgg,
      lowStockDocs,
      topProductsAgg,
      topCategoriesAgg,
      recentOrdersDocs,
      totalProducts,
      activeProducts,
      activeSalesCount,
      activeFlashDealsCount,
      activeSpecialOffersCount,
    ] = await Promise.all([
      // 1. All-time paid sales + count
      Order.aggregate([
        { $match: { isPaid: true } },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),

      // 2. Today paid sales + orders
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),

      // 3. Current period paid sales, orders, discount, items
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalPrice' },
            count: { $sum: 1 },
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
      ]),

      // 4. Previous equal period paid sales + orders (for accurate growth)
      Order.aggregate([
        {
          $match: {
            isPaid: true,
            createdAt: { $gte: prevPeriodStart, $lt: periodStart },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Last 30 days revenue
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: last30Days } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),

      // 6. All orders vs paid orders in period (for payment conversion)
      Order.countDocuments({ createdAt: { $gte: periodStart } }),
      Order.countDocuments({ createdAt: { $gte: periodStart }, isPaid: true }),

      // 7. Order status breakdown (all orders)
      Order.aggregate([
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        },
      ]),

      // 8. Daily time series in Tehran timezone
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: '+03:30',
              },
            },
            sales: { $sum: '$totalPrice' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 9. Counts in 24h / period
      Order.countDocuments({ createdAt: { $gte: last24h } }),
      User.countDocuments({ role: 'user', createdAt: { $gte: last24h } }),
      User.countDocuments({ role: 'user', createdAt: { $gte: periodStart } }),
      User.countDocuments({ role: 'user' }),

      // 10. Attention metrics
      Order.countDocuments({ orderStatus: { $in: ['Pending', 'Processing'] } }),
      Ticket.countDocuments({ status: { $in: ['open', 'pending'] } }),
      Review.countDocuments({ isApproved: false }),

      // 11. Abandoned carts (active carts with items updated in last 7 days)
      Cart.aggregate([
        {
          $match: {
            status: 'active',
            updatedAt: { $gte: last7Days },
            'items.0': { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalValue: { $sum: { $ifNull: ['$totalPrice', 0] } },
          },
        },
      ]),

      // 12. Stock summary (simple + variable active products)
      Product.aggregate([
        { $match: { isActive: true } },
        { $addFields: { effectiveStock: effectiveStockExpr } },
        {
          $group: {
            _id: null,
            outOfStock: {
              $sum: { $cond: [{ $lte: ['$effectiveStock', 0] }, 1, 0] },
            },
            lowStock: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$effectiveStock', 0] },
                      { $lt: ['$effectiveStock', 10] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 13. Critical low-stock / out-of-stock active products list
      Product.aggregate([
        { $match: { isActive: true } },
        { $addFields: { effectiveStock: effectiveStockExpr } },
        { $match: { effectiveStock: { $lt: 10 } } },
        { $sort: { effectiveStock: 1, updatedAt: -1 } },
        { $limit: 8 },
        {
          $project: {
            _id: 1,
            name: 1,
            sku: 1,
            productType: 1,
            stock: '$effectiveStock',
          },
        },
      ]),

      // 14. Top selling products in selected period
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: periodStart } } },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.product',
            name: { $first: '$orderItems.name' },
            quantitySold: { $sum: '$orderItems.quantity' },
            revenue: {
              $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] },
            },
          },
        },
        { $sort: { revenue: -1, quantitySold: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDoc',
          },
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: { $ifNull: ['$productDoc.name', '$name'] },
            sku: { $ifNull: ['$productDoc.sku', ''] },
            quantitySold: 1,
            revenue: 1,
            stock: {
              $cond: [
                { $eq: ['$productDoc.productType', 'variable'] },
                { $sum: { $ifNull: ['$productDoc.variants.stock', []] } },
                { $ifNull: ['$productDoc.stock', 0] },
              ],
            },
          },
        },
      ]),

      // 15. Top categories by revenue in period
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: periodStart } } },
        { $unwind: '$orderItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderItems.product',
            foreignField: '_id',
            as: 'productDoc',
          },
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$productDoc.category',
            revenue: {
              $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] },
            },
            units: { $sum: '$orderItems.quantity' },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
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
            revenue: 1,
            units: 1,
          },
        },
      ]),

      // 16. Recent orders
      Order.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('user', 'name mobile email')
        .lean(),

      // 17. Catalog & promo health counts
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Sale.countDocuments({ isActive: true, startDate: { $lte: now }, endDate: { $gt: now } }),
      Product.countDocuments({
        isActive: true,
        isFlashDeal: true,
        $or: [{ flashDealEndTime: null }, { flashDealEndTime: { $gt: now } }],
      }),
      Product.countDocuments({
        isActive: true,
        isSpecialOffer: true,
        $or: [{ specialOfferEndTime: null }, { specialOfferEndTime: { $gt: now } }],
      }),
    ])

    const totalSales = allTimeSalesAgg[0]?.total || 0
    const totalPaidOrders = allTimeSalesAgg[0]?.count || 0
    const averageOrderValue =
      totalPaidOrders > 0 ? Math.round(totalSales / totalPaidOrders) : 0

    const periodSales = periodSalesAgg[0]?.total || 0
    const periodOrders = periodSalesAgg[0]?.count || 0
    const periodItemsSold = periodSalesAgg[0]?.itemsSold || 0
    const periodDiscount = periodSalesAgg[0]?.totalDiscount || 0
    const periodAverageOrderValue =
      periodOrders > 0 ? Math.round(periodSales / periodOrders) : 0

    const prevPeriodSales = prevPeriodSalesAgg[0]?.total || 0
    const prevPeriodOrders = prevPeriodSalesAgg[0]?.count || 0

    const calcGrowth = (curr, prev) => {
      if (prev > 0) return Number((((curr - prev) / prev) * 100).toFixed(1))
      return curr > 0 ? 100 : 0
    }

    const salesGrowth = calcGrowth(periodSales, prevPeriodSales)
    const ordersGrowth = calcGrowth(periodOrders, prevPeriodOrders)

    const paymentConversionRate =
      periodAllOrdersCount > 0
        ? Number(((periodPaidOrdersCount / periodAllOrdersCount) * 100).toFixed(1))
        : 0

    // Zero-fill daily chart for all days in selected period
    const seriesMap = new Map()
    dailySeriesAgg.forEach((row) => {
      seriesMap.set(row._id, {
        sales: Math.round(row.sales || 0),
        orders: row.orders || 0,
      })
    })

    const salesChart = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = tehranDateKey(d)
      const hit = seriesMap.get(key)
      salesChart.push({
        date: key,
        sales: hit?.sales || 0,
        orders: hit?.orders || 0,
      })
    }

    const statusBreakdown = {
      Pending: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    }
    let totalOrdersAllTime = 0
    orderStatusAgg.forEach((row) => {
      if (row._id && Object.prototype.hasOwnProperty.call(statusBreakdown, row._id)) {
        statusBreakdown[row._id] = row.count || 0
      }
      totalOrdersAllTime += row.count || 0
    })

    const recentOrders = recentOrdersDocs.map((o) => ({
      id: o._id,
      _id: o._id,
      orderNumber: o.orderCode || o._id?.toString().slice(-6),
      customer: {
        name: o.shippingAddress?.fullName || o.user?.name || 'مشتری',
        mobile: o.shippingAddress?.phone || o.user?.mobile || '',
        email: o.user?.email || '',
      },
      totalAmount: o.totalPrice || 0,
      isPaid: Boolean(o.isPaid),
      status: o.orderStatus || 'Pending',
      itemsCount: Array.isArray(o.orderItems) ? o.orderItems.length : 0,
      createdAt: o.createdAt,
    }))

    res.json({
      success: true,
      data: {
        // Legacy / core fields (preserved for backward compatibility)
        totalSales,
        totalPaidOrders,
        salesGrowth,
        ordersGrowth,
        averageOrderValue,
        newOrders: newOrders24h,
        pendingOrders,
        newCustomers: newCustomers24h,
        openTickets,
        lowStockProducts: lowStockDocs.map((p) => ({
          id: p._id,
          _id: p._id,
          name: p.name,
          sku: p.sku || '',
          productType: p.productType || 'simple',
          stock: p.stock || 0,
        })),
        salesChart,
        recentOrders,

        // Rich Executive Analytics fields
        periodDays: days,
        todaySales: todaySalesAgg[0]?.total || 0,
        todayOrders: todaySalesAgg[0]?.count || 0,
        periodSales,
        periodOrders,
        periodItemsSold,
        periodDiscount,
        periodAverageOrderValue,
        previousPeriodSales: prevPeriodSales,
        last30DaysSales: last30SalesAgg[0]?.total || 0,
        paymentConversionRate,
        periodAllOrdersCount,
        periodPaidOrdersCount,
        newCustomersPeriod,
        totalCustomers,
        totalOrdersAllTime,
        orderStatusBreakdown: statusBreakdown,

        attention: {
          pendingOrders,
          openTickets,
          pendingReviews,
          outOfStockCount: stockSummaryAgg[0]?.outOfStock || 0,
          lowStockCount: stockSummaryAgg[0]?.lowStock || 0,
          abandonedCartsCount: abandonedCartsAgg[0]?.count || 0,
          abandonedCartsValue: Math.round(abandonedCartsAgg[0]?.totalValue || 0),
        },

        catalogHealth: {
          totalProducts,
          activeProducts,
          activeSalesCount,
          activeFlashDealsCount,
          activeSpecialOffersCount,
        },

        topProducts: topProductsAgg,
        topCategories: topCategoriesAgg,
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار داشبورد',
      error: error.message,
    })
  }
}
