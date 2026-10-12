const Order = require('../models/Order')
const Cart = require('../models/Cart')
const SalesEvent = require('../models/SalesEvent')
const paymentService = require('../utils/paymentService')
const inventoryService = require('../services/inventoryService')
const { ROLES, PERMISSIONS } = require('../config/rbac')
const {
  computeItemPricing,
  findMatchingVariant,
  getActiveSalesCampaignContext,
  normalizeVariantOptions,
} = require('../services/pricingService')

// ============================================
// Helper: Reprice order items from DB (live prices)
// NEVER trust item prices sent by the client: the browser may hold a stale
// (cached, pre-discount) price. Recompute every line from the current
// Product document + active sales campaigns so the charged amount is always
// the live price. Returns { items, itemsPrice, priceAdjusted }.
// ============================================
const repriceOrderItemsFromDb = async (orderItems) => {
  const Product = require('../models/Product')
  const now = new Date()
  const campaignContext = await getActiveSalesCampaignContext(now)

  let priceAdjusted = false
  const repriced = []

  for (const item of orderItems) {
    const product = await Product.findById(item.product).lean()
    if (!product || product.isActive === false) {
      const err = new Error(`محصول «${item.name || 'نامشخص'}» موجود نیست یا غیرفعال شده است`)
      err.statusCode = 400
      throw err
    }

    const variantOptions = normalizeVariantOptions(item.variantOptions)
    const quantity = Math.max(1, Number(item.quantity) || 1)

    // اعتبارسنجی موجودی variant (فقط محصول متغیر): ترکیب نامعتبر یا ناموجود
    // قابل سفارش نیست — کسر موجودی فقط تا صفر clamp می‌شود وگرنه oversell می‌شد.
    // محصول ساده دست‌نخورده (رفتار قبلی حفظ می‌شود).
    if (product.productType === 'variable' && variantOptions.length > 0) {
      const matchingVariant = findMatchingVariant(product, variantOptions)
      if (!matchingVariant) {
        const err = new Error(`ترکیب انتخابی برای محصول «${product.name || 'نامشخص'}» معتبر نیست`)
        err.statusCode = 400
        throw err
      }
      if (Number(matchingVariant.stock || 0) < quantity) {
        const err = new Error(`موجودی ترکیب انتخابی محصول «${product.name || 'نامشخص'}» کافی نیست`)
        err.statusCode = 400
        err.code = 'VARIANT_OUT_OF_STOCK'
        throw err
      }
    }

    const pricing = computeItemPricing(
      { product, quantity: item.quantity, variantOptions },
      now,
      campaignContext,
    )

    const serverPrice = Math.round(Number(pricing.finalPrice) || 0)
    const serverOriginal = Math.round(Number(pricing.basePrice) || serverPrice)
    if (Number(item.price) !== serverPrice) priceAdjusted = true

    let image = item.image
    if (Array.isArray(product.images) && product.images.length > 0) {
      const first = product.images[0]
      image = typeof first === 'string' ? first : (first?.url || image)
    }

    repriced.push({
      product: product._id,
      name: product.name || item.name,
      quantity: Math.max(1, Number(item.quantity) || 1),
      image,
      price: serverPrice,
      originalPrice: serverOriginal,
      discount: Number(pricing.discount) || 0,
      variantOptions,
    })
  }

  const itemsPrice = repriced.reduce((sum, it) => sum + it.price * it.quantity, 0)
  const productSavings = repriced.reduce(
    (sum, it) => sum + Math.max(0, (it.originalPrice - it.price)) * it.quantity,
    0,
  )
  return { items: repriced, itemsPrice, productSavings, priceAdjusted }
}

// Helper for converting Persian/Arabic digits to English
const convertPersianToEnglishDigits = (str) => {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
}

const MASHHAD_SPECIAL_PICKUP = 'mashhad_special_pickup'

const normalizeLocationName = (value) => String(value || '')
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/\u200c/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('fa-IR')

const isMashhadShippingAddress = (shippingAddress) =>
  normalizeLocationName(shippingAddress?.city) === 'مشهد' &&
  normalizeLocationName(shippingAddress?.province) === 'خراسان رضوی'

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

      // Schedule a score recalculation so this purchase moves the
      // bestsellers ranking within ~a minute instead of waiting for the
      // periodic 30-minute recalculation (which remains as backstop).
      try {
        const { scheduleRecalculation } = require('../services/bestsellersScoreEngine')
        scheduleRecalculation()
      } catch (recalcErr) {
        // Non-critical
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

      // Keep the ranking in sync after the revert as well
      try {
        const { scheduleRecalculation } = require('../services/bestsellersScoreEngine')
        scheduleRecalculation()
      } catch (recalcErr) {
        // Non-critical
      }
    }
  } catch (error) {
    console.error('[SalesEvent] ❌ Error reverting sales events:', error.message)
  }
}

// ============================================
// موجودی و شمارنده‌ی فروش — واگذار شده به inventoryService
// --------------------------------------------
// قبلاً adjustProductStats همین‌جا با read-modify-save و clamp تا صفر کار
// می‌کرد: سفارش بزرگ‌تر از موجودی بی‌صدا رد می‌شد (oversell) و دو پرداخت
// همزمان روی هم می‌نوشتند. حالا:
//  - موجودی فقط با رزرو/آزادسازی اتمیک inventoryService جابه‌جا می‌شود
//    (رزرو هنگام ثبت سفارش، آزادسازی هنگام لغو — بر اساس فلگ stockDeducted).
//  - salesCount جدا و اتمیک در لحظه‌ی پرداخت موفق/برگشت آن تغییر می‌کند
//    (inventoryService.adjustSalesCount) تا معنای آماری فروش حفظ شود.
// ============================================
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
      shippingPrice: requestedShippingPrice,
      shippingMethod,
      fulfillmentType,
      taxPrice,
      totalPrice,
      totalDiscount,
      couponCode,
    } = req.body

    // اعتبارسنجی کاربر
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'کاربر شناسایی نشد. لطفاً مجدداً وارد شوید.',
      })
    }

    const userId = req.user._id

    // All customer-facing orders must be paid through the online gateway.
    if (paymentMethod !== 'online') {
      return res.status(400).json({
        success: false,
        message: 'پرداخت در محل غیرفعال است؛ لطفاً پرداخت آنلاین را انتخاب کنید.',
      })
    }

    const isMashhadSpecialPickup = fulfillmentType === MASHHAD_SPECIAL_PICKUP
    let finalShippingPrice = requestedShippingPrice
    let finalShippingMethod = shippingMethod

    if (isMashhadSpecialPickup) {
      if (!isMashhadShippingAddress(shippingAddress)) {
        return res.status(403).json({
          success: false,
          message: 'تحویل حضوری ویژه فقط برای نشانی شهر مشهد فعال است.',
        })
      }

      finalShippingPrice = 0
      finalShippingMethod = 'تحویل حضوری ویژه مشهد'
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

    // CRITICAL: Recompute all item prices from the live DB state (current
    // discounts/campaigns). Client-sent prices may be stale (browser cache)
    // and must never determine the charged amount.
    let serverItems
    let serverItemsPrice
    let serverProductSavings
    let priceAdjusted = false
    try {
      const repriced = await repriceOrderItemsFromDb(orderItems)
      serverItems = repriced.items
      serverItemsPrice = repriced.itemsPrice
      serverProductSavings = repriced.productSavings
      priceAdjusted = repriced.priceAdjusted
    } catch (repriceErr) {
      return res.status(repriceErr.statusCode || 400).json({
        success: false,
        message: repriceErr.message || 'خطا در محاسبه قیمت سفارش',
      })
    }

    // Server-side coupon validation against the LIVE items total.
    // The client discount is ignored: it may be stale or tampered with.
    let effectiveCouponDiscount = 0
    if (couponCode) {
      const Coupon = require('../models/Coupon')
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() })
      if (!coupon || !coupon.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'کد تخفیف نامعتبر یا منقضی شده است؛ لطفاً آن را حذف و دوباره تلاش کنید.',
        })
      }
      effectiveCouponDiscount = Math.max(
        0,
        Math.min(Number(coupon.calculateDiscount(serverItemsPrice)) || 0, serverItemsPrice),
      )
    }
    const serverTotalPrice = Math.max(
      0,
      Math.round(serverItemsPrice + (Number(finalShippingPrice) || 0) + (Number(taxPrice) || 0) - effectiveCouponDiscount),
    )

    // رزرو اتمیک موجودی — قلب اصلاح: سفارش فقط وقتی ثبت می‌شود که موجودی
    // همه‌ی اقلام (محصول ساده و ترکیب دقیق محصول متغیر، با جمع اقلام
    // تکراری) کافی باشد. کسر شرطیِ MongoDB (stock >= qty) جلوی oversell
    // و مسابقه‌ی دو خرید همزمان را می‌گیرد؛ اگر یک قلم کم باشد، رزرو
    // بقیه rollback می‌شود و هیچ سفارشی ثبت نمی‌شود.
    try {
      await inventoryService.reserveStock(serverItems)
    } catch (stockErr) {
      return res.status(stockErr.statusCode || 409).json({
        success: false,
        code: stockErr.code || 'INSUFFICIENT_STOCK',
        message: stockErr.message || 'موجودی کافی نیست',
        ...(stockErr.details ? { data: { insufficient: stockErr.details } } : {}),
      })
    }

    // ایجاد سفارش
    const order = new Order({
      user: userId,
      orderItems: serverItems,
      shippingAddress,
      paymentMethod: 'online',
      itemsPrice: serverItemsPrice,
      shippingPrice: finalShippingPrice,
      shippingMethod: finalShippingMethod,
      fulfillmentType: isMashhadSpecialPickup ? MASHHAD_SPECIAL_PICKUP : 'shipping',
      taxPrice: taxPrice || 0,
      totalPrice: serverTotalPrice,
      totalDiscount: Math.round(serverProductSavings + effectiveCouponDiscount),
      couponCode: couponCode ? String(couponCode).toUpperCase() : undefined,
      orderStatus: 'Pending',
      stockDeducted: true,
    })

    let createdOrder
    try {
      createdOrder = await order.save()
    } catch (saveErr) {
      // سفارش ثبت نشد => رزرو موجودی نباید بماند
      await inventoryService.releaseStock(serverItems)
      throw saveErr
    }

    // If couponCode was used, increment coupon usageCount
    if (couponCode) {
      try {
        const Coupon = require('../models/Coupon')
        await Coupon.findOneAndUpdate(
          { code: String(couponCode).toUpperCase() },
          { $inc: { usageCount: 1 } }
        )
      } catch (couponErr) {
        console.error('Error updating coupon usageCount:', couponErr)
      }
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
      message: priceAdjusted
        ? 'قیمت برخی کالاها از زمان مشاهده شما به‌روز شده و سفارش با قیمت‌های لحظه‌ای ثبت شد'
        : 'سفارش با موفقیت ثبت شد',
      priceAdjusted,
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
      .populate('orderItems.product', 'name images sku price compareAtPrice discount')
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

    // Auto-resolve preparedTrackingUrl from Settings if missing
    if ((!order.preparedTrackingUrl || String(order.preparedTrackingUrl).trim() === '') && order.courierName && order.trackingCode) {
      try {
        const Settings = require('../models/Settings')
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
        const couriers = settings?.shippingSettings?.couriers || []
        const matched = couriers.find((c) => c.name === order.courierName)
          || (!order.courierName
            ? couriers.find((c) => c.isDefault && c.isActive !== false)
              || couriers.find((c) => c.isActive !== false)
            : null)
        if (matched && !order.courierName) order.courierName = matched.name
        if (matched && matched.trackingUrlTemplate) {
          order.preparedTrackingUrl = matched.trackingUrlTemplate
            .replace('{{code}}', String(order.trackingCode).trim())
            .replace('{code}', String(order.trackingCode).trim())
        }
      } catch (err) {
        console.error('Error resolving tracking URL in getOrderById:', err)
      }
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

    const previousStatus = order.orderStatus

    // خروج از لغو یعنی سفارش دوباره به موجودی نیاز دارد: قبل از هر تغییری
    // رزرو اتمیک انجام می‌شود؛ اگر موجودی دیگر کافی نباشد، تغییر وضعیت
    // رد می‌شود تا سفارش لغوشده نتواند oversell بسازد.
    let stockReservedNow = false
    if (previousStatus === 'Cancelled' && status !== 'Cancelled' && !order.stockDeducted) {
      try {
        await inventoryService.reserveStock(order.orderItems)
        stockReservedNow = true
      } catch (stockErr) {
        return res.status(stockErr.statusCode || 409).json({
          success: false,
          code: stockErr.code || 'INSUFFICIENT_STOCK',
          message: stockErr.message || 'موجودی کافی نیست',
        })
      }
    }

    const updates = {
      orderStatus: status,
    }

    if (stockReservedNow) {
      updates.stockDeducted = true
    }

    // لغو سفارش: فلگ رزرو در همان آپدیت وضعیت خاموش می‌شود تا آزادسازی
    // موجودی (بعد از آپدیت) دوباره شمرده نشود.
    if (status === 'Cancelled' && previousStatus !== 'Cancelled' && order.stockDeducted) {
      updates.stockDeducted = false
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

    // Auto-generate preparedTrackingUrl if courierName and trackingCode are present but preparedTrackingUrl is empty
    const currentCode = updates.trackingCode !== undefined ? updates.trackingCode : order.trackingCode
    let currentCourier = updates.courierName !== undefined ? updates.courierName : order.courierName
    let currentUrl = updates.preparedTrackingUrl !== undefined ? updates.preparedTrackingUrl : order.preparedTrackingUrl

    if ((!currentCourier || String(currentCourier).trim() === '') && currentCode && String(currentCode).trim() !== '') {
      try {
        const Settings = require('../models/Settings')
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
        const couriers = settings?.shippingSettings?.couriers || []
        const defaultCourier = couriers.find((courier) => courier.isDefault && courier.isActive !== false)
          || couriers.find((courier) => courier.isActive !== false)
        if (defaultCourier) {
          currentCourier = defaultCourier.name
          updates.courierName = defaultCourier.name
        }
      } catch (err) {
        console.error('Error resolving default courier in updateOrderStatus:', err)
      }
    }

    if ((!currentUrl || String(currentUrl).trim() === '') && currentCourier && currentCode && String(currentCode).trim() !== '') {
      try {
        const Settings = require('../models/Settings')
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
        const couriers = settings?.shippingSettings?.couriers || []
        const matched = couriers.find((c) => c.name === currentCourier)
        if (matched && matched.trackingUrlTemplate) {
          const codeVal = String(currentCode).trim()
          updates.preparedTrackingUrl = matched.trackingUrlTemplate
            .replace('{{code}}', codeVal)
            .replace('{code}', codeVal)
        }
      } catch (err) {
        console.error('Error resolving template in updateOrderStatus:', err)
      }
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

    let updatedOrder
    try {
      updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        {
          new: true,
          runValidators: false,
        },
      )
    } catch (updateErr) {
      // تغییر وضعیت انجام نشد => رزروی که همین حالا گرفته شد نباید بماند
      if (stockReservedNow) {
        await inventoryService.releaseStock(order.orderItems)
      }
      throw updateErr
    }

    // موجودی و آمار فروش هنگام لغو / خروج از لغو:
    //  - موجودی: آزادسازی بر اساس فلگ stockDeducted است، نه پرداخت؛ چون
    //    رزرو هنگام ثبت سفارش انجام شده (حتی سفارش پرداخت‌نشده هم موجودی
    //    قفل کرده و لغوش باید آن را برگرداند).
    //  - salesCount و SalesEvent فقط برای فروش قطعی‌شده (پرداخت‌شده/ COD
    //    قدیمی) برمی‌گردد، دقیقاً مثل قبل.
    if (status === 'Cancelled' && previousStatus !== 'Cancelled') {
      // سفارش‌های قدیمیِ پرداخت‌شده فلگ ندارند ولی موجودی‌شان در سیستم
      // قبلی هنگام پرداخت کسر شده بود؛ آن‌ها هم باید برگردند. (شرط OR
      // است و آزادسازی فقط یک بار صدا زده می‌شود.)
      if (order.stockDeducted || order.isPaid) {
        await inventoryService.releaseStock(order.orderItems)
      }
      if (order.isPaid || order.paymentMethod === 'cod') {
        await inventoryService.adjustSalesCount(order.orderItems, -1)
        // Revert SalesEvents for Bestsellers scoring engine
        await revertSalesEvents(order._id)
      }
    } else if (previousStatus === 'Cancelled' && status !== 'Cancelled') {
      // Re-apply if uncanceled and it's paid or COD
      if (order.isPaid || order.paymentMethod === 'cod') {
        await inventoryService.adjustSalesCount(order.orderItems, 1)
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

    // سفارش لغوشده قابل پرداخت نیست (رزرو موجودی‌اش آزاد شده است)
    if (order.orderStatus === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'این سفارش لغو شده است و قابل پرداخت نیست',
      })
    }

    // سفارش‌های قدیمی (قبل از رزرو هنگام ثبت) هنوز موجودی رزرو نکرده‌اند:
    // قبل از فرستادن کاربر به درگاه، موجودی را زودهنگام چک می‌کنیم تا
    // برای کالای ناموجود پول گرفته نشود. تضمین نهایی هنگام تایید پرداخت
    // با رزرو اتمیک در verifyPayment است.
    if (!order.stockDeducted) {
      try {
        await inventoryService.assertAvailable(order.orderItems)
      } catch (stockErr) {
        return res.status(stockErr.statusCode || 409).json({
          success: false,
          code: stockErr.code || 'INSUFFICIENT_STOCK',
          message: stockErr.message || 'موجودی کافی نیست',
        })
      }
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

    // سفارش لغوشده (مثلاً توسط ادمین وقتی کاربر در درگاه بوده) نباید با
    // تایید پرداخت دوباره رزرو/فعال شود.
    if (order.orderStatus === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'این سفارش لغو شده است',
        orderId: order._id,
      })
    }

    // سفارش‌های جدید موجودی‌شان هنگام ثبت رزرو شده و این‌جا دوباره کسر
    // نمی‌شوند. سفارش‌های قدیمیِ بدون رزرو، قبل از تایید نهایی پرداخت
    // (capture) به‌صورت اتمیک رزرو می‌شوند؛ اگر موجودی کافی نباشد پرداخت
    // تایید نمی‌شود تا پول برای کالای ناموجود قطعی نشود.
    let reservedForLegacyOrder = false
    if (!order.stockDeducted) {
      try {
        await inventoryService.reserveStock(order.orderItems)
        reservedForLegacyOrder = true
      } catch (stockErr) {
        return res.status(stockErr.statusCode || 409).json({
          success: false,
          code: stockErr.code || 'INSUFFICIENT_STOCK',
          message: stockErr.message || 'موجودی کافی نیست',
          orderId: order._id,
        })
      }
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
      if (reservedForLegacyOrder) {
        order.stockDeducted = true
      }

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

      // موجودی قبلاً رزرو شده (هنگام ثبت سفارش یا همین‌جا برای سفارش
      // قدیمی) و دوباره کسر نمی‌شود؛ فقط شمارنده‌ی فروش قطعی می‌شود.
      await inventoryService.adjustSalesCount(order.orderItems, 1)

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
      // تایید درگاه ناموفق بود: رزروی که برای سفارش قدیمی همین‌جا گرفته
      // شد آزاد می‌شود تا موجودی بی‌دلیل قفل نماند. (سفارش‌های جدید
      // رزروشان را نگه می‌دارند چون سفارش هنوز Pending و قابل پرداخت است.)
      if (reservedForLegacyOrder) {
        await inventoryService.releaseStock(order.orderItems)
      }

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

    if (paymentMethod && paymentMethod !== 'online') {
      return res.status(400).json({
        success: false,
        message: 'پرداخت در محل غیرفعال است؛ سفارش ادمین نیز باید با پرداخت آنلاین ثبت شود.',
      })
    }

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

    // Admin-created orders are repriced from live DB state as well, so the
    // charged amount can never be based on a stale admin-panel snapshot.
    let serverAdminItems
    let serverAdminItemsPrice
    let serverAdminSavings = 0
    try {
      const repriced = await repriceOrderItemsFromDb(orderItems)
      serverAdminItems = repriced.items
      serverAdminItemsPrice = repriced.itemsPrice
      serverAdminSavings = repriced.productSavings
    } catch (repriceErr) {
      return res.status(repriceErr.statusCode || 400).json({
        success: false,
        message: repriceErr.message || 'خطا در محاسبه قیمت سفارش',
      })
    }
    const serverAdminTotal = Math.max(
      0,
      Math.round(serverAdminItemsPrice + (Number(shippingPrice) || 0) + (Number(taxPrice) || 0)),
    )

    // رزرو اتمیک موجودی — سفارش ادمین هم از همان قانون سفارش مشتری پیروی
    // می‌کند: بدون موجودی کافی، سفارشی ثبت نمی‌شود.
    try {
      await inventoryService.reserveStock(serverAdminItems)
    } catch (stockErr) {
      return res.status(stockErr.statusCode || 409).json({
        success: false,
        code: stockErr.code || 'INSUFFICIENT_STOCK',
        message: stockErr.message || 'موجودی کافی نیست',
        ...(stockErr.details ? { data: { insufficient: stockErr.details } } : {}),
      })
    }

    // ایجاد سفارش
    const order = new Order({
      user: userId,
      orderItems: serverAdminItems,
      shippingAddress,
      paymentMethod: 'online',
      itemsPrice: serverAdminItemsPrice,
      shippingPrice,
      shippingMethod,
      taxPrice: taxPrice || 0,
      totalPrice: serverAdminTotal,
      totalDiscount: Math.round(serverAdminSavings),
      orderStatus: 'Pending',
      adminNotes: adminNotes || '',
      isPaid: false, // Default not paid
      stockDeducted: true,
    })

    let createdOrder
    try {
      createdOrder = await order.save()
    } catch (saveErr) {
      await inventoryService.releaseStock(serverAdminItems)
      throw saveErr
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

