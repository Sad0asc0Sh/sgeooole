const Order = require('../models/Order')
const User = require('../models/Admin')
const Product = require('../models/Product')
const Ticket = require('../models/Ticket')

// GET /api/dashboard/stats
// آمار تجمیعی برای داشبورد ادمین
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // مجموع فروش (فقط سفارش‌های پرداخت‌شده)
    const totalSalesAgg = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' },
        },
      },
    ])
    const totalSales = totalSalesAgg[0]?.total || 0

    // سفارش‌های جدید در ۲۴ ساعت گذشته
    const newOrders = await Order.countDocuments({
      createdAt: { $gte: last24h },
    })

    // مشتریان جدید در ۲۴ ساعت گذشته (role = user)
    const newCustomers = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: last24h },
    })

    // محصولات با موجودی کم (stock < 10)
    const lowStockProductsDocs = await Product.find({ stock: { $lt: 10 } })
      .select('name stock')
      .sort({ stock: 1 })
      .limit(5)
      .lean()

    // سفارش‌های در انتظار / در حال پردازش
    const pendingStatuses = ['Pending', 'Processing']
    const pendingOrders = await Order.countDocuments({
      orderStatus: { $in: pendingStatuses },
    })

    // تیکت‌های باز
    const openTickets = await Ticket.countDocuments({ status: 'open' })

    // سفارش‌های پرداخت‌شده ۷ روز گذشته برای نمودار فروش
    const recentPaidOrders = await Order.find({
      createdAt: { $gte: last7Days },
      isPaid: true,
    })
      .select('totalPrice createdAt user')
      .sort({ createdAt: 1 })
      .populate('user', 'name')
      .lean()

    const sumsByDay = new Map()
    recentPaidOrders.forEach((order) => {
      if (!order.createdAt) return
      const key = order.createdAt.toISOString().slice(0, 10)
      sumsByDay.set(key, (sumsByDay.get(key) || 0) + (order.totalPrice || 0))
    })

    const labels = Array.from(sumsByDay.keys()).sort()
    const salesChart = labels.map((date) => ({
      date,
      sales: Math.round((sumsByDay.get(date) || 0) * 100) / 100,
    }))

    // ۵ سفارش آخر برای جدول
    const recentOrdersDocs = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name')
      .lean()

    const recentOrders = recentOrdersDocs.map((o) => ({
      id: o._id,
      orderNumber: o._id?.toString().slice(-6),
      customer: { name: o.user?.name || 'مشتری' },
      totalAmount: o.totalPrice || 0,
      status: o.orderStatus || 'Pending',
    }))

    // محاسبه میانگین ارزش سفارش (AOV)
    const averageOrderValue = totalSalesAgg[0]?.count > 0 ? totalSales / totalSalesAgg[0].count : 0

    // محاسبه رشد فروش نسبت به هفته گذشته
    const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const lastWeekSalesAgg = await Order.aggregate([
      {
        $match: {
          isPaid: true,
          createdAt: { $gte: last14Days, $lt: last7Days }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ])
    const lastWeekSales = lastWeekSalesAgg[0]?.total || 0
    const salesGrowth = lastWeekSales > 0 ? ((totalSales - lastWeekSales) / lastWeekSales) * 100 : 100

    res.json({
      success: true,
      data: {
        totalSales,
        salesGrowth: salesGrowth.toFixed(1),
        averageOrderValue: Math.round(averageOrderValue),
        newOrders,
        pendingOrders,
        newCustomers,
        lowStockProducts: lowStockProductsDocs.map((p) => ({
          id: p._id,
          name: p.name,
          stock: p.stock,
        })),
        salesChart,
        recentOrders,
        openTickets,
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

