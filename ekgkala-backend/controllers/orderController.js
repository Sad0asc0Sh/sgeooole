const Order = require('../models/Order')
const Cart = require('../models/Cart')
const SalesEvent = require('../models/SalesEvent')
const paymentService = require('../utils/paymentService')
const { ROLES, PERMISSIONS } = require('../config/rbac')

// Helper for converting Persian/Arabic digits to English
const convertPersianToEnglishDigits = (str) => {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
}

// ============================================
// Helper: Record SalesEvents for Bestsellers Engine
// This feeds the ProductScore scoring system
// ============================================
const recordSalesEvents = async (orderItems, orderId) => {
  try {
    const events = []
    for (const item of orderItems) {
      if (!item.product) continue
      events.push({
        product_id: item.product,
        order_id: orderId,
        quantity: item.quantity || 1,
        revenue: (item.price || 0) * (item.quantity || 1),
        margin_pct: 0, // Can be updated later if cost data is available
        sold_at: new Date(),
      })
    }

    if (events.length > 0) {
      await SalesEvent.insertMany(events)
      console.log(`[SalesEvent] ✅ ${events.length} sales events recorded for order ${orderId}`)

      // Invalidate bestsellers cache so new data appears
      try {
        const redis = require('../utils/redis')
        if (redis) {
          const keys = await redis.keys('bestsellers:*')
          if (keys.length > 0) {
            await redis.del(keys)
          }
        }
      } catch (cacheErr) {
        // Cache invalidation failure is non-critical
      }
    }
  } catch (error) {
    // SalesEvent recording should never block the order flow
    console.error('[SalesEvent] ❌ Error recording sales events:', error.message)
  }
}

// ============================================
// Helper: Revert SalesEvents on order cancellation
// ============================================
const revertSalesEvents = async (orderId) => {
  try {
    const result = await SalesEvent.deleteMany({ order_id: orderId })
    if (result.deletedCount > 0) {
      console.log(`[SalesEvent] 🗑️ ${result.deletedCount} sales events reverted for order ${orderId}`)

      // Invalidate bestsellers cache
      try {
        const redis = require('../utils/redis')
        if (redis) {
          const keys = await redis.keys('bestsellers:*')
          if (keys.length > 0) {
            await redis.del(keys)
          }
        }
      } catch (cacheErr) {
        // Non-critical
      }
    }
  } catch (error) {
    console.error('[SalesEvent] ❌ Error reverting sales events:', error.message)
  }
}

// ============================================
// Helper for updating product stock and sales count
// ============================================
const adjustProductStats = async (orderItems, isIncrement) => {
  try {
    const Product = require('../models/Product')
    const multiplier = isIncrement ? 1 : -1

    for (const item of orderItems) {
      if (!item.product) continue

      const product = await Product.findById(item.product)
      if (!product) continue

      // Update sales count (salesCount)
      product.salesCount = Math.max(0, (product.salesCount || 0) + (item.quantity * multiplier))

      // Update stock if it's a simple product
      if (product.productType === 'simple') {
        product.stock = Math.max(0, (product.stock || 0) - (item.quantity * multiplier))
      }
      // Update stock for variable products
      else if (product.productType === 'variable' && item.variantOptions && item.variantOptions.length > 0) {
        // Find matching variant based on options
        const isMatch = (variantOptions, itemOptions) => {
          if (!variantOptions || !itemOptions) return false
          if (variantOptions.length !== itemOptions.length) return false
          return itemOptions.every(io =>
            variantOptions.some(vo => vo.name === io.name && vo.value === io.value)
          )
        }

        const variant = product.variants.find(v => isMatch(v.options, item.variantOptions))
        if (variant) {
          variant.stock = Math.max(0, (variant.stock || 0) - (item.quantity * multiplier))
        }
      }

      // Save without triggering validations to avoid unrelated schema errors
      await product.save({ validateBeforeSave: false })
    }
  } catch (error) {
    console.error('Error in adjustProductStats:', error)
  }
}
const sanitizeOrderForCustomer = (order) => {
  if (!order) return order
  const sanitized = { ...order }

  delete sanitized.adminNotes
  delete sanitized.paymentGateway
  delete sanitized.paymentResult

  delete sanitized.zarinpalAuthority
  delete sanitized.zarinpalRefId

  delete sanitized.sadadToken
  delete sanitized.sadadOrderId
  delete sanitized.sadadTraceNumber

  return sanitized
}

// ============================================
// POST /api/orders - ایجاد سفارش جدید (Customer-Facing)
// ============================================
exports.createOrder = async (req, res) => {
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      shippingMethod,
      taxPrice,
      totalPrice,
      totalDiscount,
    } = req.body

    // اعتبارسنجی کاربر
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'کاربر شناسایی نشد. لطفاً مجدداً وارد شوید.',
      })
    }

    const userId = req.user._id

    // اعتبارسنجی سبد خرید
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'سبد خرید خالی است',
      })
    }

    // اعتبارسنجی آیتم‌های سفارش
    for (const item of orderItems) {
      if (!item.product || !item.product.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: `شناسه محصول نامعتبر است: ${item.name || 'نامشخص'}`,
        })
      }
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'آدرس ارسال الزامی است',
      })
    }

    // ایجاد سفارش
    const order = new Order({
      user: userId,
      orderItems,
      shippingAddress,
      paymentMethod: paymentMethod || 'online',
      itemsPrice,
      shippingPrice,
      shippingMethod,
      taxPrice: taxPrice || 0,
      totalPrice,
      totalDiscount: totalDiscount || 0,
      orderStatus: paymentMethod === 'cod' ? 'Processing' : 'Pending',
    })

    const createdOrder = await order.save()

    // NEW LOGIC: Adjust stats if order is Cash-On-Delivery
    if (createdOrder.paymentMethod === 'cod') {
      await adjustProductStats(createdOrder.orderItems, true)
      // Record SalesEvents for Bestsellers scoring engine
      await recordSalesEvents(createdOrder.orderItems, createdOrder._id)
    }

    // پاک کردن سبد خرید کاربر بعد از ثبت سفارش
    const cart = await Cart.findOne({ user: userId, status: 'active' })
    if (cart) {
      cart.items = []
      cart.totalPrice = 0
      cart.status = 'converted' // تبدیل به سفارش
      await cart.save()
    }

    res.status(201).json({
      success: true,
      message: 'سفارش با موفقیت ثبت شد',
      data: createdOrder,
    })
  } catch (error) {
    console.error('Error creating order:', error)
    res.status(500).json({
      success: false,
      message: `خطا در ثبت سفارش: ${error.message}`,
      error: error.message,
    })
  }
}

// ============================================
// GET /api/orders - لیست سفارش‌ها با فیلتر و صفحه‌بندی
// ============================================
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.orderStatus) {
      filter.orderStatus = req.query.orderStatus
    }

    if (req.query.isPaid !== undefined) {
      filter.isPaid = req.query.isPaid === 'true'
    }

    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: 'i' }
      const orConditions = [
        { orderCode: searchRegex },
        { trackingCode: searchRegex },
      ]

      // Only search by _id if the search term is a valid ObjectId (exact match)
      // or if we really want regex on ObjectId, we can't do it easily in find() without aggregation.
      // Assuming exact match for ID is sufficient for admin.
      const mongoose = require('mongoose')
      if (mongoose.Types.ObjectId.isValid(req.query.search)) {
        orConditions.push({ _id: req.query.search })
      }

      filter.$or = orConditions
    }

    // فیلتر بر اساس کاربر (برای نمایش سفارشات یک مشتری خاص)
    if (req.query.userId) {
      filter.user = req.query.userId
    }

    const totalItems = await Order.countDocuments(filter)

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست سفارشات',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/orders/:id - جزئیات یک سفارش
// مشتری فقط می‌تواند سفارش خود را ببیند، ادمین همه را می‌بیند
// ============================================
exports.getOrderById = async (req, res) => {
  try {
    const userRole = req.user?.role || 'guest'
    const userPermissions = ROLES[userRole] || []
    const canReadAllOrders = userPermissions.includes(PERMISSIONS.ORDER_READ_ALL)

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email mobile')
      .populate('orderItems.product', 'name images sku')
      .lean()

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'سفارش مورد نظر یافت نشد',
      })
    }

    // بررسی دسترسی: فقط صاحب سفارش یا ادمین
    const orderUserId = order.user?._id ? order.user._id.toString() : order.user?.toString()
    const isOwner = Boolean(orderUserId && req.user?._id && orderUserId === req.user._id.toString())

    if (!canReadAllOrders && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'شما اجازه دسترسی به این سفارش را ندارید',
      })
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')

    res.json({
      success: true,
      data: canReadAllOrders ? order : sanitizeOrderForCustomer(order),
    })
  } catch (error) {
    console.error('Error fetching order:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت جزئیات سفارش',
      error: error.message,
    })
  }
}

// ============================================
// PUT /api/orders/:id/status - به‌روزرسانی وضعیت سفارش
// فقط فیلدهای مرتبط را لمس می‌کنیم
// ============================================
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت سفارش الزامی است',
      })
    }

    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت سفارش نامعتبر است',
      })
    }

    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'سفارش مورد نظر یافت نشد',
      })
    }

    const updates = {
      orderStatus: status,
    }

    if (status === 'Shipped' && !order.shippedAt) {
      updates.shippedAt = new Date()
    }
    if (status === 'Delivered' && !order.deliveredAt) {
      updates.deliveredAt = new Date()
    }

    if (req.body.trackingCode !== undefined) {
      updates.trackingCode = req.body.trackingCode
    }

    if (req.body.courierName !== undefined) {
      updates.courierName = req.body.courierName
    }

    if (req.body.preparedTrackingUrl !== undefined) {
      updates.preparedTrackingUrl = req.body.preparedTrackingUrl
    }

    // تنظیم زمان تکمیل خودکار (اگر روز وارد شده باشد)
    if (status === 'Shipped' && req.body.deliveryDays) {
      const normalizedDaysStr = convertPersianToEnglishDigits(req.body.deliveryDays)
      const days = parseInt(normalizedDaysStr, 10)
      if (!isNaN(days) && days > 0) {
        const completionDate = new Date()
        completionDate.setDate(completionDate.getDate() + days)
        updates.autoCompleteAt = completionDate
      }
    } else if (status !== 'Shipped') {
      // پاک کردن تایمر وقتی وضعیت دیگر «ارسال‌شده» نیست (مثلاً Delivered، لغو، در انتظار)
      updates.autoCompleteAt = null
    }

    // نرمال‌سازی یادداشت ادمین تا خطای CastError ندهد
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

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: false,
      },
    )

    // NEW LOGIC: Revert stats if Cancelled, or re-apply if uncanceled
    const previousStatus = order.orderStatus
    if (status === 'Cancelled' && previousStatus !== 'Cancelled') {
      // Revert if it was a paid order or COD
      if (order.isPaid || order.paymentMethod === 'cod') {
        await adjustProductStats(order.orderItems, false)
        // Revert SalesEvents for Bestsellers scoring engine
        await revertSalesEvents(order._id)
      }
    } else if (previousStatus === 'Cancelled' && status !== 'Cancelled') {
      // Re-apply if uncanceled and it's paid or COD
      if (order.isPaid || order.paymentMethod === 'cod') {
        await adjustProductStats(order.orderItems, true)
        // Re-record SalesEvents for Bestsellers scoring engine
        await recordSalesEvents(order.orderItems, order._id)
      }
    }

    // Audit Log
    const { logAction } = require('../utils/auditLogger')
    await logAction({
      action: 'UPDATE_ORDER_STATUS',
      entity: 'Order',
      entityId: order._id,
      userId: req.user._id,
      details: {
        oldStatus: order.orderStatus,
        newStatus: status,
        adminNotes: updates.adminNotes,
        trackingCode: updates.trackingCode,
      },
      req,
    })

    res.json({
      success: true,
      message: 'وضعیت سفارش با موفقیت به‌روزرسانی شد',
      data: updatedOrder,
    })
  } catch (error) {
    console.error('Error updating order status:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی وضعیت سفارش',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/orders/my-orders - دریافت سفارشات کاربر جاری
// OPTIMIZED: Only select necessary fields for profile page
// ============================================
exports.getMyOrders = async (req, res) => {
  try {
    // 🚀 OPTIMIZATION: Only select fields needed for display
    // This reduces data transfer and speeds up the query
    const orders = await Order.find({ user: req.user._id })
      .select('_id orderCode orderStatus totalPrice createdAt isPaid itemsPrice shippingPrice orderItems courierName trackingCode preparedTrackingUrl shippedAt deliveredAt')
      .sort({ createdAt: -1 })
      .limit(50) // Limit to last 50 orders for performance
      .lean()

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')

    res.json({
      success: true,
      data: orders,
    })
  } catch (error) {
    console.error('Error fetching my orders:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت سفارشات',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/orders/my-stats - آمار سریع سفارشات کاربر
// FAST endpoint for profile page order counts
// ============================================
exports.getMyOrderStats = async (req, res) => {
  try {
    // 🚀 OPTIMIZATION: Use aggregation pipeline for fast counting
    const stats = await Order.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 }
        }
      }
    ])

    // Transform to expected format
    const result = {
      pending: 0,
      processing: 0,
      delivered: 0,
      cancelled: 0,
      total: 0
    }

    stats.forEach(stat => {
      result.total += stat.count
      if (stat._id === 'Pending') {
        result.pending = stat.count
      } else if (['Processing', 'Shipped'].includes(stat._id)) {
        result.processing += stat.count
      } else if (stat._id === 'Delivered') {
        result.delivered = stat.count
      } else if (stat._id === 'Cancelled') {
        result.cancelled = stat.count
      }
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error fetching order stats:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار سفارشات',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/orders/:id/pay - شروع فرآیند پرداخت
// ============================================
exports.payOrder = async (req, res) => {
  try {
    const orderId = req.params.id

    // پیدا کردن سفارش
    const order = await Order.findById(orderId).populate('user', 'email mobile')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'سفارش مورد نظر یافت نشد',
      })
    }

    // بررسی مالکیت سفارش
    const isOwner = order.user._id.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'شما اجازه دسترسی به این سفارش را ندارید',
      })
    }

    // بررسی اینکه آیا قبلاً پرداخت شده
    if (order.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'این سفارش قبلاً پرداخت شده است',
      })
    }

    // URL بازگشت بعد از پرداخت
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    // اطمینان از وجود پروتکل
    if (!frontendUrl.startsWith('http')) {
      frontendUrl = `https://${frontendUrl}`
    }
    // حذف اسلش اضافه در انتها
    frontendUrl = frontendUrl.replace(/\/$/, '')
    const callbackUrl = `${frontendUrl}/payment/result`

    // دریافت درگاه انتخابی از درخواست (اگر ارسال شده باشد)
    const selectedGateway = req.body.gateway || req.query.gateway

    // درخواست پرداخت از درگاه فعال
    const paymentRequest = await paymentService.requestPayment({
      amount: Math.round(order.totalPrice), // مبلغ به تومان
      callbackUrl: callbackUrl,
      description: `پرداخت سفارش #${order._id.toString().substring(0, 8)}`,
      email: order.user?.email || '',
      mobile: order.user?.mobile || order.shippingAddress?.phone || '',
      orderId: order._id.toString(), // برای Sadad الزامی
      gatewayName: selectedGateway, // ارسال نام درگاه انتخابی
    })

    // ذخیره اطلاعات پرداخت در سفارش بر اساس درگاه
    order.paymentGateway = paymentRequest.gateway

    if (paymentRequest.gateway === 'zarinpal') {
      order.zarinpalAuthority = paymentRequest.authority
    } else if (paymentRequest.gateway === 'sadad') {
      order.sadadToken = paymentRequest.token
      order.sadadOrderId = paymentRequest.orderId
    }

    await order.save()

    res.json({
      success: true,
      message: 'درخواست پرداخت با موفقیت ایجاد شد',
      data: {
        paymentUrl: paymentRequest.url,
        authority: paymentRequest.authority, // برای ZarinPal
        token: paymentRequest.token, // برای Sadad
        gateway: paymentRequest.gateway,
      },
    })
  } catch (error) {
    console.error('Error initiating payment:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'خطا در ایجاد درخواست پرداخت',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/orders/verify-payment - تایید پرداخت
// ============================================
exports.verifyPayment = async (req, res) => {
  try {
    const { Authority, Status, Token, ResCode, OrderId } = req.body

    let order = null

    // پیدا کردن سفارش بر اساس نوع درگاه
    if (Authority) {
      // ZarinPal
      order = await Order.findOne({ zarinpalAuthority: Authority })
    } else if (Token || OrderId) {
      // Sadad
      order = await Order.findOne({
        $or: [{ sadadToken: Token }, { sadadOrderId: OrderId }],
      })
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'سفارش مورد نظر یافت نشد',
      })
    }

    // بررسی اینکه آیا کاربر لغو کرده
    if (Status === 'NOK' || Status === 'Cancel' || ResCode === '17') {
      return res.status(400).json({
        success: false,
        message: 'پرداخت توسط کاربر لغو شد',
        orderId: order._id,
      })
    }

    // بررسی اینکه آیا قبلاً تایید شده
    if (order.isPaid) {
      return res.json({
        success: true,
        message: 'این سفارش قبلاً تایید شده است',
        data: {
          orderId: order._id,
          refId: order.zarinpalRefId || order.sadadTraceNumber,
          isPaid: true,
        },
      })
    }

    // تعیین نوع درگاه
    const gateway = order.paymentGateway || 'zarinpal'

    // تایید پرداخت از درگاه
    const verifyParams = {
      gateway,
      amount: order.totalPrice,
    }

    if (gateway === 'zarinpal') {
      verifyParams.authority = Authority
    } else if (gateway === 'sadad') {
      verifyParams.token = Token || order.sadadToken
      verifyParams.orderId = OrderId || order.sadadOrderId
    }

    const verifyResult = await paymentService.verifyPayment(verifyParams)

    if (verifyResult.success) {
      // به‌روزرسانی سفارش
      order.isPaid = true
      order.paidAt = new Date()
      order.orderStatus = 'Processing' // تغییر وضعیت به "در حال پردازش"

      // ذخیره اطلاعات تایید بر اساس درگاه
      if (gateway === 'zarinpal') {
        order.zarinpalRefId = verifyResult.refId
        order.paymentResult = {
          id: verifyResult.refId,
          status: 'success',
          update_time: new Date().toISOString(),
        }
      } else if (gateway === 'sadad') {
        order.sadadTraceNumber = verifyResult.traceNumber
        order.paymentResult = {
          id: verifyResult.refId,
          status: 'success',
          update_time: new Date().toISOString(),
        }
      }

      await order.save()

      // NEW LOGIC: Adjust stats after successful payment
      await adjustProductStats(order.orderItems, true)

      // Record SalesEvents for Bestsellers scoring engine
      await recordSalesEvents(order.orderItems, order._id)

      // Audit Log
      const { logAction } = require('../utils/auditLogger')
      await logAction({
        action: 'PAYMENT_VERIFIED',
        entity: 'Order',
        entityId: order._id,
        userId: order.user,
        details: {
          gateway,
          refId: verifyResult.refId,
          amount: order.totalPrice,
          authority: Authority,
          token: Token,
        },
      })

      res.json({
        success: true,
        message: 'پرداخت با موفقیت انجام شد',
        data: {
          orderId: order._id,
          refId: verifyResult.refId,
          isPaid: true,
          cardPan: verifyResult.cardPan,
          gateway,
        },
      })
    } else {
      res.status(400).json({
        success: false,
        message: verifyResult.message || 'تایید پرداخت ناموفق بود',
        code: verifyResult.code,
        orderId: order._id,
      })
    }
  } catch (error) {
    console.error('Error verifying payment:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در تایید پرداخت',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/orders/track/:orderCode - پیگیری سفارش (بدون نیاز به لاگین)
// ============================================
exports.trackOrder = async (req, res) => {
  try {
    const { orderCode } = req.params
    const { phone } = req.query

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: 'کد سفارش الزامی است',
      })
    }

    const normalizedOrderCode = String(orderCode).trim().toUpperCase()
    const phoneParam = typeof phone === 'string' ? phone.trim() : ''
    const shouldVerifyPhone = phoneParam.length > 0

    // Find order by orderCode
    const orderQuery = Order.findOne({ orderCode: normalizedOrderCode })

    const order = await (shouldVerifyPhone
      ? orderQuery
        .populate('user', 'mobile')
        .select('_id orderCode orderStatus createdAt totalPrice trackingCode courierName preparedTrackingUrl shippingAddress user')
      : orderQuery.select('_id orderCode orderStatus createdAt totalPrice trackingCode courierName preparedTrackingUrl')
    )
      .lean()

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'سفارشی با این کد یافت نشد',
      })
    }

    if (shouldVerifyPhone) {
      // Normalize phone number (remove spaces, dashes, etc.)
      const normalizedPhone = phoneParam.replace(/[\s\-\.]/g, '')

      // Verify phone number matches either user's mobile or shipping address phone
      const userMobile = order.user?.mobile?.replace(/[\s\-\.]/g, '') || ''
      const shippingPhone = order.shippingAddress?.phone?.replace(/[\s\-\.]/g, '') || ''
      const last10UserMobile = userMobile.length >= 10 ? userMobile.slice(-10) : ''
      const last10ShippingPhone = shippingPhone.length >= 10 ? shippingPhone.slice(-10) : ''

      const phoneMatches =
        (userMobile && normalizedPhone === userMobile) ||
        (shippingPhone && normalizedPhone === shippingPhone) ||
        (last10UserMobile && normalizedPhone.endsWith(last10UserMobile)) ||
        (last10ShippingPhone && normalizedPhone.endsWith(last10ShippingPhone))

      if (!phoneMatches) {
        return res.status(403).json({
          success: false,
          message: 'شماره موبایل با اطلاعات سفارش مطابقت ندارد',
        })
      }
    }

    // Return limited order information for guest tracking
    res.json({
      success: true,
      data: {
        _id: order._id,
        orderCode: order.orderCode,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
        totalPrice: order.totalPrice,
        trackingCode: order.trackingCode || null,
        courierName: order.courierName || null,
        preparedTrackingUrl: order.preparedTrackingUrl || null,
      },
    })
  } catch (error) {
    console.error('Error tracking order:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در پیگیری سفارش',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/orders/admin/create - ایجاد سفارش توسط ادمین (Admin-Only)
// ============================================
exports.createOrderForUser = async (req, res) => {
  try {
    const {
      userId,
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      shippingMethod,
      taxPrice,
      totalPrice,
      totalDiscount,
      adminNotes,
    } = req.body

    // اعتبارسنجی کاربر هدف
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'شناسه کاربر نامعتبر است',
      })
    }

    // اعتبارسنجی سبد خرید
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'سبد خرید خالی است',
      })
    }

    // اعتبارسنجی آیتم‌های سفارش
    for (const item of orderItems) {
      if (!item.product || !item.product.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: `شناسه محصول نامعتبر است: ${item.name || 'نامشخص'}`,
        })
      }
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'آدرس ارسال الزامی است',
      })
    }

    // ایجاد سفارش
    const order = new Order({
      user: userId,
      orderItems,
      shippingAddress,
      paymentMethod: paymentMethod || 'online',
      itemsPrice,
      shippingPrice,
      shippingMethod,
      taxPrice: taxPrice || 0,
      totalPrice,
      totalDiscount: totalDiscount || 0,
      orderStatus: paymentMethod === 'cod' ? 'Processing' : 'Pending',
      adminNotes: adminNotes || '',
      isPaid: false, // Default not paid
    })

    const createdOrder = await order.save()

    // NEW LOGIC: Adjust stats if COD
    if (createdOrder.paymentMethod === 'cod') {
      await adjustProductStats(createdOrder.orderItems, true)
      // Record SalesEvents for Bestsellers scoring engine
      await recordSalesEvents(createdOrder.orderItems, createdOrder._id)
    }

    // Audit Log
    const { logAction } = require('../utils/auditLogger')
    await logAction({
      action: 'CREATE_ORDER_FOR_USER',
      entity: 'Order',
      entityId: createdOrder._id,
      userId: req.user._id,
      details: {
        targetUserId: userId,
        orderCode: createdOrder.orderCode,
        totalPrice: createdOrder.totalPrice,
        paymentMethod: createdOrder.paymentMethod,
      },
      req,
    })

    res.status(201).json({
      success: true,
      message: 'سفارش با موفقیت ایجاد شد',
      data: createdOrder,
    })
  } catch (error) {
    console.error('Error creating order for user:', error)
    res.status(500).json({
      success: false,
      message: `خطا در ایجاد سفارش: ${error.message}`,
      error: error.message,
    })
  }
}

