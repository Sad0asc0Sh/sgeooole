const mongoose = require('mongoose')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const Settings = require('../models/Settings')
const { sendReminderEmail, sendReminderSMS } = require('../utils/notificationService')

const CART_PRODUCT_FIELDS = 'name price compareAtPrice images discount isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime campaignLabel productType variants'

// Helper function to get cart settings
async function getCartSettings() {
  try {
    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
    return {
      ttlHours: settings?.cartSettings?.cartTTLHours || 1,
      autoExpireEnabled: settings?.cartSettings?.autoExpireEnabled !== false,
      permanentCart: settings?.cartSettings?.permanentCart || false,
      expiryWarningEnabled: settings?.cartSettings?.expiryWarningEnabled || false,
      expiryWarningMinutes: settings?.cartSettings?.expiryWarningMinutes || 30,
    }
  } catch (error) {
    console.error('Error fetching cart settings:', error)
    return {
      ttlHours: 1,
      autoExpireEnabled: true,
      permanentCart: false,
      expiryWarningEnabled: false,
      expiryWarningMinutes: 30,
    }
  }
}

const findMatchingVariant = (product, variantOptions) => {
  if (
    !product ||
    product.productType !== 'variable' ||
    !Array.isArray(product.variants) ||
    !Array.isArray(variantOptions) ||
    variantOptions.length === 0
  ) {
    return null
  }

  return product.variants.find((variant) => {
    if (!Array.isArray(variant.options) || variant.options.length === 0) return false

    return variant.options.every((opt) =>
      variantOptions.some(
        (vo) =>
          vo &&
          opt &&
          String(vo.name).trim() === String(opt.name).trim() &&
          String(vo.value).trim() === String(opt.value).trim(),
      ),
    )
  })
}

const computeItemPricing = (item, now = new Date()) => {
  const product = item?.product || {}
  const quantity = Number(item.quantity || item.qty || 1) || 1
  const matchingVariant = findMatchingVariant(product, item.variantOptions)

  const basePrice =
    Number(
      (matchingVariant && matchingVariant.price) ??
        product.price ??
        item.price ??
        0,
    ) || 0

  const rawDiscount = Number(product.discount) || 0
  const flashEnd = product.flashDealEndTime ? new Date(product.flashDealEndTime) : null
  const specialEnd = product.specialOfferEndTime ? new Date(product.specialOfferEndTime) : null

  const flashActive = Boolean(product.isFlashDeal && (!flashEnd || flashEnd > now))
  const specialActive = Boolean(product.isSpecialOffer && (!specialEnd || specialEnd > now))

  let appliedDiscount = 0
  let campaignLabel = product.campaignLabel || null

  if (flashActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || '??????? ???????'
  } else if (specialActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || '??????????'
  } else if (!product.isFlashDeal && !product.isSpecialOffer && rawDiscount > 0) {
    // Non-timer discounts remain valid when no countdown flags are set
    appliedDiscount = rawDiscount
  }

  const finalPrice =
    appliedDiscount > 0
      ? Math.max(0, basePrice - (basePrice * appliedDiscount) / 100)
      : basePrice

  return {
    basePrice,
    finalPrice,
    discount: appliedDiscount,
    campaignLabel,
    flashActive,
    specialActive,
    quantity,
  }
}

const buildCartResponse = async (cartId, { updateStoredTotal = false } = {}) => {
  if (!cartId) {
    return {
      items: [],
      totalPrice: 0,
    }
  }

  const populatedCart = await Cart.findById(cartId)
    .populate('items.product', CART_PRODUCT_FIELDS)
    .lean()

  if (!populatedCart) {
    return {
      items: [],
      totalPrice: 0,
    }
  }

  const now = new Date()

  const enhancedItems = (populatedCart.items || []).map((item) => {
    const pricing = computeItemPricing(item, now)
    const product = item.product || {}

    const normalizedImage =
      item.image ||
      (Array.isArray(product.images) && product.images.length > 0
        ? typeof product.images[0] === 'string'
          ? product.images[0]
          : product.images[0]?.url
        : null)

    return {
      ...item,
      price: pricing.basePrice, // original/base price
      originalPrice: pricing.basePrice,
      finalPrice: pricing.finalPrice,
      discount: pricing.discount,
      campaignLabel: pricing.campaignLabel,
      isFlashDeal: Boolean(product.isFlashDeal),
      flashDealEndTime: product.flashDealEndTime
        ? new Date(product.flashDealEndTime).toISOString()
        : undefined,
      isSpecialOffer: Boolean(product.isSpecialOffer),
      specialOfferEndTime: product.specialOfferEndTime
        ? new Date(product.specialOfferEndTime).toISOString()
        : undefined,
      quantity: Number(item.quantity || item.qty || 1),
      qty: Number(item.quantity || item.qty || 1),
      totalItemPrice: pricing.finalPrice * (Number(item.quantity || item.qty || 1)),
      image: normalizedImage,
    }
  })

  const totalPrice = enhancedItems.reduce((acc, item) => acc + (item.totalItemPrice || 0), 0)

  if (updateStoredTotal) {
    await Cart.updateOne({ _id: cartId }, { $set: { totalPrice } })
  }

  return {
    items: enhancedItems,
    totalPrice,
    couponCode: populatedCart.couponCode,
  }
}


// ============================================
// GET /api/carts/admin/abandoned - دریافت سبدهای رها شده
// فقط برای ادمین
// ============================================
exports.getAbandonedCarts = async (req, res) => {
  try {
    // پارامترهای زمانی قابل تنظیم
    let hoursAgo = 1
    if (req.query.hoursAgo !== undefined && req.query.hoursAgo !== null && req.query.hoursAgo !== '') {
      hoursAgo = parseInt(req.query.hoursAgo, 10)
    }

    const daysAgo = parseInt(req.query.daysAgo, 10) || 7 // پیش‌فرض: 7 روز

    // محاسبه تاریخ‌ها
    const minTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    const maxTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    console.log('[ABANDONED] Request params:', { hoursAgo, daysAgo })
    console.log('[ABANDONED] Time range:', { minTime, maxTime })

    // پیدا کردن سبدهای رها شده
    // سبدهایی که:
    // 1. وضعیت active دارند
    // 2. updatedAt آن‌ها قدیمی‌تر از hoursAgo است (پیش‌فرض: 1 ساعت)
    // 3. updatedAt آن‌ها جدیدتر از daysAgo است (پیش‌فرض: 7 روز)
    const filter = {
      status: 'active',
      updatedAt: {
        $gte: maxTime, // بیشتر یا مساوی با زمان حداکثر (جدیدتر از 7 روز)
      },
      items: { $exists: true, $not: { $size: 0 } }, // حداقل یک آیتم داشته باشد
    }

    // اگر hoursAgo > 0 باشد، یعنی می‌خواهیم سبدهای "تازه" را فیلتر کنیم
    // مثلاً سبدهایی که حداقل 1 ساعت از آخرین تغییرشان گذشته باشد
    if (hoursAgo > 0) {
      filter.updatedAt.$lte = minTime
    }

    console.log('[ABANDONED] Filter:', JSON.stringify(filter, null, 2))

    const carts = await Cart.find(filter)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images sku price')
      .sort({ updatedAt: -1 })
      .lean()

    console.log(`[ABANDONED] Found ${carts.length} carts`)

    // محاسبه آمار
    const totalItems = carts.reduce((sum, cart) => {
      return sum + cart.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    }, 0)

    const totalValue = carts.reduce((sum, cart) => {
      return (
        sum +
        cart.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0)
      )
    }, 0)

    res.json({
      success: true,
      data: carts,
      stats: {
        totalCarts: carts.length,
        totalItems,
        totalValue,
      },
      filters: {
        hoursAgo,
        daysAgo,
        minTime,
        maxTime,
      },
    })
  } catch (error) {
    console.error('Error fetching abandoned carts:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت سبدهای رها شده',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/carts/admin/stats - آمار سبدها
// فقط برای ادمین
// ============================================
exports.getCartStats = async (req, res) => {
  try {
    const totalActiveCarts = await Cart.countDocuments({ status: 'active' })
    const totalConvertedCarts = await Cart.countDocuments({ status: 'converted' })

    // سبدهای رها شده (1 ساعت تا 7 روز)
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const abandonedCarts = await Cart.countDocuments({
      status: 'active',
      updatedAt: {
        $lte: oneHourAgo,
        $gte: sevenDaysAgo,
      },
      'items.0': { $exists: true },
    })

    res.json({
      success: true,
      stats: {
        totalActiveCarts,
        totalConvertedCarts,
        abandonedCarts,
        conversionRate:
          totalActiveCarts + totalConvertedCarts > 0
            ? ((totalConvertedCarts / (totalActiveCarts + totalConvertedCarts)) * 100).toFixed(2)
            : 0,
      },
    })
  } catch (error) {
    console.error('Error fetching cart stats:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار سبدها',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/carts/admin/remind/email/:cartId - ارسال یادآوری ایمیل
// فقط برای ادمین
// ============================================
exports.sendEmailReminder = async (req, res) => {
  try {
    const { cartId } = req.params

    // یافتن سبد خرید و populate کردن اطلاعات
    const cart = await Cart.findById(cartId)
      .populate('user', 'name email')
      .populate('items.product', 'name images price')
      .lean()

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'سبد خرید یافت نشد',
      })
    }

    // بررسی وجود ایمیل کاربر
    if (!cart.user || !cart.user.email) {
      return res.status(400).json({
        success: false,
        message: 'ایمیل کاربر یافت نشد',
      })
    }

    // بررسی وجود آیتم‌ها
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'سبد خرید خالی است',
      })
    }

    // ارسال ایمیل
    await sendReminderEmail(cart.user.email, cart.user.name, cart.items)

    res.json({
      success: true,
      message: 'ایمیل یادآوری با موفقیت ارسال شد',
    })
  } catch (error) {
    console.error('Error sending email reminder:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ارسال ایمیل یادآوری',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/carts/admin/remind/sms/:cartId - ارسال یادآوری پیامک
// فقط برای ادمین
// ============================================
exports.sendSmsReminder = async (req, res) => {
  try {
    const { cartId } = req.params

    // یافتن سبد خرید و populate کردن اطلاعات
    const cart = await Cart.findById(cartId)
      .populate('user', 'name phone')
      .lean()

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'سبد خرید یافت نشد',
      })
    }

    // بررسی وجود شماره موبایل کاربر
    if (!cart.user || !cart.user.phone) {
      return res.status(400).json({
        success: false,
        message: 'شماره موبایل کاربر یافت نشد',
      })
    }

    // بررسی وجود آیتم‌ها
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'سبد خرید خالی است',
      })
    }

    // ارسال پیامک
    const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    await sendReminderSMS(cart.user.phone, cart.user.name, itemsCount)

    res.json({
      success: true,
      message: 'پیامک یادآوری با موفقیت ارسال شد',
    })
  } catch (error) {
    console.error('Error sending SMS reminder:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ارسال پیامک یادآوری',
      error: error.message,
    })
  }
}

// ============================================
// CUSTOMER-FACING CART ENDPOINTS
// ============================================

// ============================================
// GET /api/cart - دریافت سبد خرید کاربر
// ============================================
exports.getMyCart = async (req, res) => {
  try {
    const userId = req.user._id

    const cart = await Cart.findOne({ user: userId, status: 'active' }).select('_id couponCode')

    if (!cart) {
      return res.json({
        success: true,
        data: {
          items: [],
          totalPrice: 0,
        },
      })
    }

    const pricedCart = await buildCartResponse(cart._id, { updateStoredTotal: true })

    res.json({
      success: true,
      data: {
        items: pricedCart.items,
        totalPrice: pricedCart.totalPrice,
        couponCode: pricedCart.couponCode,
      },
    })
  } catch (error) {
    console.error('Error fetching user cart:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت سبد خرید',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/cart/sync - همگام‌سازی سبد خرید
// ============================================
exports.syncCart = async (req, res) => {
  try {
    const { items } = req.body // آرایه‌ای از آیتم‌های سبد خرید local
    const userId = req.user._id

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'فرمت داده نامعتبر است',
      })
    }

    // پیدا کردن یا ایجاد سبد خرید
    let cart = await Cart.findOne({ user: userId, status: 'active' })

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
        status: 'active',
      })
    }

    // همگام‌سازی آیتم‌ها
    for (const incomingItem of items) {
      // اعتبارسنجی محصول
      const product = await Product.findById(incomingItem.product)
      if (!product) {
        console.log(`Product not found: ${incomingItem.product}`)
        continue
      }

      // پیدا کردن آیتم در سبد موجود
      const existingItemIndex = cart.items.findIndex(
        (item) => item.product.toString() === incomingItem.product
      )

      if (existingItemIndex > -1) {
        // به‌روزرسانی تعداد (حداکثر مقدار)
        cart.items[existingItemIndex].quantity = Math.max(
          cart.items[existingItemIndex].quantity,
          incomingItem.quantity || 1
        )
        cart.items[existingItemIndex].price = product.price
      } else {
        // افزودن آیتم جدید
        cart.items.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: incomingItem.quantity || 1,
          image: product.images && product.images[0] ?
            (typeof product.images[0] === 'string' ? product.images[0] : product.images[0].url) :
            null,
          variantOptions: incomingItem.variantOptions || [],
        })
      }
    }

    // محاسبه و ذخیره
    cart.calculateTotal()
    await cart.save()

    // بازگرداندن سبد populated با اعمال تخفیف‌های فعال
    const pricedCart = await buildCartResponse(cart._id, { updateStoredTotal: true })

    res.json({
      success: true,
      data: {
        items: pricedCart.items,
        totalPrice: pricedCart.totalPrice,
        couponCode: pricedCart.couponCode,
      },
    })
  } catch (error) {
    console.error('Error syncing cart:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در همگام‌سازی سبد خرید',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/cart/item - افزودن/به‌روزرسانی آیتم
// ============================================
// ============================================
// POST /api/cart/item - افزودن/به‌روزرسانی آیتم
// ============================================
exports.addOrUpdateItem = async (req, res) => {
  try {
    console.log('[CART] Add/Update Item Request:', req.body)

    const { product: productId, quantity, variantOptions } = req.body

    if (!req.user || !req.user._id) {
      console.error('[CART] User not found in request')
      return res.status(401).json({
        success: false,
        message: 'کاربر احراز هویت نشده است',
      })
    }

    const userId = req.user._id
    console.log('[CART] User ID:', userId)

    if (!productId || !quantity || quantity < 1) {
      console.error('[CART] Invalid input:', { productId, quantity })
      return res.status(400).json({
        success: false,
        message: 'اطلاعات محصول نامعتبر است',
      })
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.error('[CART] Invalid Product ID format:', productId)
      return res.status(400).json({
        success: false,
        message: 'شناسه محصول نامعتبر است',
      })
    }

    // اعتبارسنجی محصول
    const product = await Product.findById(productId)
    if (!product) {
      console.error('[CART] Product not found:', productId)
      return res.status(404).json({
        success: false,
        message: 'محصول یافت نشد',
      })
    }

    console.log('[CART] Product found:', product.name)

    // تعیین قیمت محصول
    let finalPrice = product.price
    let finalImage = product.images && product.images[0] ?
      (typeof product.images[0] === 'string' ? product.images[0] : product.images[0].url) :
      null

    // اگر محصول متغیر است، قیمت را از واریانت پیدا کن
    if (product.productType === 'variable' && Array.isArray(variantOptions) && variantOptions.length > 0) {
      const matchingVariant = product.variants.find(variant => {
        // بررسی تطابق همه گزینه‌ها
        return variant.options.every(opt =>
          variantOptions.some(vo =>
            vo.name === opt.name && vo.value === opt.value
          )
        )
      })

      if (matchingVariant) {
        finalPrice = matchingVariant.price
        // اگر واریانت تصویر دارد، از آن استفاده کن
        if (matchingVariant.images && matchingVariant.images.length > 0) {
          finalImage = matchingVariant.images[0].url || matchingVariant.images[0]
        }
      }
    }

    // اگر قیمت هنوز مشخص نیست (مثلاً محصول متغیر بدون انتخاب واریانت صحیح)، خطا بده
    if (finalPrice === undefined || finalPrice === null) {
      console.warn('[CART] Price is undefined, defaulting to 0. Product:', product._id)
      // Fallback to product price if available, otherwise 0 (but 0 might be wrong)
      finalPrice = product.price || 0
    }

    console.log('[CART] Final Price:', finalPrice)

    // پیدا کردن یا ایجاد سبد خرید
    let cart = await Cart.findOne({ user: userId, status: 'active' })

    if (!cart) {
      console.log('[CART] Creating new cart for user')
      cart = new Cart({
        user: userId,
        items: [],
        status: 'active',
      })
    } else {
      console.log('[CART] Found existing cart:', cart._id)
    }

    // پیدا کردن آیتم در سبد - با در نظر گرفتن variantOptions
    const existingItemIndex = cart.items.findIndex((item) => {
      // بررسی product ID
      if (item.product.toString() !== productId) return false

      // بررسی variantOptions
      const itemVariants = Array.isArray(item.variantOptions) ? item.variantOptions : []
      const newVariants = Array.isArray(variantOptions) ? variantOptions : []

      // اگر تعداد variant ها فرق کند، آیتم‌های متفاوتی هستند
      if (itemVariants.length !== newVariants.length) return false

      // بررسی تطابق هر variant (با تبدیل به رشته برای اطمینان)
      return itemVariants.every((v1) =>
        newVariants.some((v2) =>
          v1 && v2 &&
          String(v1.name).trim() === String(v2.name).trim() &&
          String(v1.value).trim() === String(v2.value).trim()
        )
      )
    })

    if (existingItemIndex > -1) {
      // به‌روزرسانی تعداد
      cart.items[existingItemIndex].quantity = quantity
      cart.items[existingItemIndex].price = finalPrice
    } else {
      // افزودن آیتم جدید
      cart.items.push({
        product: product._id,
        name: product.name,
        price: finalPrice,
        quantity,
        image: finalImage,
        variantOptions: variantOptions || [],
      })
    }

    // محاسبه و ذخیره
    console.log('[CART] Calculating total...')
    cart.calculateTotal()
    console.log('[CART] Total calculated:', cart.totalPrice)

    // تنظیم زمان انقضا بر اساس تنظیمات
    console.log('[CART] Fetching settings...')
    const cartSettings = await getCartSettings()
    console.log('[CART] Settings fetched:', cartSettings)

    if (cartSettings.permanentCart) {
      // سبد ماندگار - بدون انقضا
      cart.expiresAt = null
      cart.isExpired = false
      cart.expiryWarningSent = false
    } else if (cartSettings.autoExpireEnabled) {
      // سبد با مهلت زمانی
      cart.setExpiry(cartSettings.ttlHours)
      cart.expiryWarningSent = false // Reset warning flag on cart update
    }

    console.log('[CART] Saving cart...')
    await cart.save()
    console.log('[CART] Cart saved successfully')

    // بازگرداندن سبد populated با تخفیف‌های فعال
    const pricedCart = await buildCartResponse(cart._id, { updateStoredTotal: true })

    res.json({
      success: true,
      data: {
        items: pricedCart.items,
        totalPrice: pricedCart.totalPrice,
        expiresAt: cart.expiresAt,
      },
    })
  } catch (error) {
    console.error('[CART] Critical Error adding/updating cart item:', error)
    console.error('[CART] Stack Trace:', error.stack)
    res.status(500).json({
      success: false,
      message: 'خطا در افزودن آیتم به سبد خرید',
      error: error.message,
    })
  }
}

// ============================================
// DELETE /api/cart/item/:productId - حذف آیتم
// Query params: variantOptions (optional JSON string)
// ============================================
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params
    const userId = req.user._id

    // دریافت variantOptions از query params یا body
    let variantOptions = []
    if (req.query.variantOptions) {
      try {
        variantOptions = JSON.parse(req.query.variantOptions)
      } catch (e) {
        variantOptions = []
      }
    } else if (req.body.variantOptions) {
      variantOptions = req.body.variantOptions
    }

    const cart = await Cart.findOne({ user: userId, status: 'active' })

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'سبد خرید یافت نشد',
      })
    }

    // حذف آیتم - با در نظر گرفتن variantOptions
    cart.items = cart.items.filter((item) => {
      // بررسی product ID
      if (item.product.toString() !== productId) return true

      // بررسی variantOptions
      const itemVariants = Array.isArray(item.variantOptions) ? item.variantOptions : []
      const targetVariants = Array.isArray(variantOptions) ? variantOptions : []

      // اگر تعداد variant ها فرق کند، آیتم‌های متفاوتی هستند
      if (itemVariants.length !== targetVariants.length) return true

      // بررسی تطابق هر variant - اگر match کرد، حذف شود (return false)
      const isMatch = itemVariants.every((v1) =>
        targetVariants.some((v2) =>
          v1 && v2 &&
          String(v1.name).trim() === String(v2.name).trim() &&
          String(v1.value).trim() === String(v2.value).trim()
        )
      )

      return !isMatch // true = نگه دار، false = حذف کن
    })

    // محاسبه و ذخیره
    cart.calculateTotal()
    await cart.save()

    // بازگرداندن سبد populated با محاسبه تخفیف‌های فعال
    const pricedCart = await buildCartResponse(cart._id, { updateStoredTotal: true })

    res.json({
      success: true,
      data: {
        items: pricedCart.items,
        totalPrice: pricedCart.totalPrice,
      },
    })
  } catch (error) {
    console.error('Error removing cart item:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف آیتم از سبد خرید',
      error: error.message,
    })
  }
}

// ============================================
// DELETE /api/cart - پاک کردن سبد خرید
// ============================================
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id

    const cart = await Cart.findOne({ user: userId, status: 'active' })

    if (!cart) {
      return res.json({
        success: true,
        message: 'سبد خرید خالی است',
        data: {
          items: [],
          totalPrice: 0,
        },
      })
    }

    // پاک کردن آیتم‌ها
    cart.items = []
    cart.totalPrice = 0
    await cart.save()

    res.json({
      success: true,
      message: 'سبد خرید پاک شد',
      data: {
        items: [],
        totalPrice: 0,
      },
    })
  } catch (error) {
    console.error('Error clearing cart:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در پاک کردن سبد خرید',
      error: error.message,
    })
  }
}

// ============================================
// DELETE /api/carts/admin/:cartId - حذف دستی سبد خرید توسط ادمین
// فقط برای ادمین
// ============================================
exports.deleteCartByAdmin = async (req, res) => {
  try {
    const { cartId } = req.params

    console.log('[DELETE CART] Request received for cartId:', cartId)

    // بررسی معتبر بودن ObjectId
    if (!mongoose.Types.ObjectId.isValid(cartId)) {
      console.error('[DELETE CART] Invalid ObjectId:', cartId)
      return res.status(400).json({
        success: false,
        message: 'شناسه سبد خرید نامعتبر است',
      })
    }

    // پیدا کردن و حذف سبد
    const cart = await Cart.findByIdAndDelete(cartId)

    if (!cart) {
      console.warn('[DELETE CART] Cart not found:', cartId)
      return res.status(404).json({
        success: false,
        message: 'سبد خرید یافت نشد',
      })
    }

    console.log('[DELETE CART] Successfully deleted cart:', cartId, 'for user:', cart.user)

    res.json({
      success: true,
      message: 'سبد خرید با موفقیت حذف شد',
      data: {
        deletedCartId: cartId,
        user: cart.user,
      },
    })
  } catch (error) {
    console.error('[DELETE CART] Error:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف سبد خرید',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/carts/admin/cleanup - پاکسازی خودکار سبدهای منقضی شده
// فقط برای ادمین
// ============================================
exports.cleanupExpiredCarts = async (req, res) => {
  try {
    const now = new Date()

    // پیدا کردن سبدهای منقضی شده
    const expiredCarts = await Cart.find({
      status: 'active',
      expiresAt: { $lte: now },
      isExpired: false,
    })

    // علامت‌گذاری به عنوان منقضی شده
    const updatePromises = expiredCarts.map(cart => {
      cart.isExpired = true
      cart.items = [] // پاک کردن آیتم‌ها
      cart.totalPrice = 0
      return cart.save()
    })

    await Promise.all(updatePromises)

    res.json({
      success: true,
      message: `${expiredCarts.length} سبد خرید منقضی شده پاکسازی شد`,
      count: expiredCarts.length,
    })
  } catch (error) {
    console.error('Error cleaning up expired carts:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در پاکسازی سبدهای منقضی شده',
      error: error.message,
    })
  }
}

// ============================================
// POST /api/carts/admin/send-expiry-warnings - ارسال هشدارهای انقضا
// فقط برای ادمین - می‌تواند به صورت دستی یا cron job فراخوانی شود
// ============================================
exports.sendExpiryWarnings = async (req, res) => {
  try {
    const cartSettings = await getCartSettings()

    // اگر هشدار انقضا غیرفعال است
    if (!cartSettings.expiryWarningEnabled) {
      return res.json({
        success: true,
        message: 'هشدار انقضا غیرفعال است',
        count: 0,
      })
    }

    const now = new Date()
    const warningTime = new Date(now.getTime() + cartSettings.expiryWarningMinutes * 60 * 1000)

    // پیدا کردن سبدهایی که نزدیک به انقضا هستند و هنوز هشدار برایشان ارسال نشده
    const cartsNearExpiry = await Cart.find({
      status: 'active',
      isExpired: false,
      expiryWarningSent: false,
      expiresAt: {
        $lte: warningTime,
        $gt: now,
      },
    })
      .populate('user', 'name email phone')
      .lean()

    let successCount = 0
    const errors = []

    for (const cart of cartsNearExpiry) {
      try {
        const user = cart.user
        if (!user) continue

        const minutesRemaining = Math.floor((new Date(cart.expiresAt) - now) / (60 * 1000))

        // ارسال ایمیل
        if (user.email) {
          try {
            await sendReminderEmail(user.email, {
              userName: user.name || 'کاربر',
              itemCount: cart.items?.length || 0,
              totalPrice: cart.totalPrice || 0,
              expiryMinutes: minutesRemaining,
              isWarning: true,
            })
          } catch (emailErr) {
            console.error('Error sending expiry warning email:', emailErr)
          }
        }

        // ارسال پیامک
        if (user.phone) {
          try {
            await sendReminderSMS(user.phone, {
              userName: user.name || 'کاربر',
              itemCount: cart.items?.length || 0,
              expiryMinutes: minutesRemaining,
              isWarning: true,
            })
          } catch (smsErr) {
            console.error('Error sending expiry warning SMS:', smsErr)
          }
        }

        // علامت‌گذاری به عنوان ارسال شده
        await Cart.findByIdAndUpdate(cart._id, {
          expiryWarningSent: true,
        })

        successCount++
      } catch (err) {
        errors.push({
          cartId: cart._id,
          error: err.message,
        })
      }
    }

    res.json({
      success: true,
      message: `هشدار انقضا برای ${successCount} سبد خرید ارسال شد`,
      count: successCount,
      totalFound: cartsNearExpiry.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error sending expiry warnings:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ارسال هشدارهای انقضا',
      error: error.message,
    })
  }
}
