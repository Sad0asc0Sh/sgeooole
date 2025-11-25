const Cart = require('../models/Cart')
const Product = require('../models/Product')
const { sendReminderEmail, sendReminderSMS } = require('../utils/notificationService')

// ============================================
// GET /api/carts/admin/abandoned - دریافت سبدهای رها شده
// فقط برای ادمین
// ============================================
exports.getAbandonedCarts = async (req, res) => {
  try {
    // پارامترهای زمانی قابل تنظیم
    const hoursAgo = parseInt(req.query.hoursAgo, 10) || 1 // پیش‌فرض: 1 ساعت
    const daysAgo = parseInt(req.query.daysAgo, 10) || 7 // پیش‌فرض: 7 روز

    // محاسبه تاریخ‌ها
    const minTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    const maxTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    // پیدا کردن سبدهای رها شده
    // سبدهایی که:
    // 1. وضعیت active دارند
    // 2. updatedAt آن‌ها قدیمی‌تر از hoursAgo است (پیش‌فرض: 1 ساعت)
    // 3. updatedAt آن‌ها جدیدتر از daysAgo است (پیش‌فرض: 7 روز)
    const filter = {
      status: 'active',
      updatedAt: {
        $lte: minTime, // کمتر یا مساوی با زمان حداقل (قدیمی‌تر از 1 ساعت)
        $gte: maxTime, // بیشتر یا مساوی با زمان حداکثر (جدیدتر از 7 روز)
      },
      'items.0': { $exists: true }, // حداقل یک آیتم داشته باشد
    }

    const carts = await Cart.find(filter)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images sku price')
      .sort({ updatedAt: -1 })
      .lean()

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

    let cart = await Cart.findOne({ user: userId, status: 'active' })
      .populate('items.product', 'name price images countInStock discount')
      .lean()

    if (!cart) {
      return res.json({
        success: true,
        data: {
          items: [],
          totalPrice: 0,
        },
      })
    }

    // محاسبه totalPrice
    const totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity)
    }, 0)

    res.json({
      success: true,
      data: {
        items: cart.items,
        totalPrice,
        couponCode: cart.couponCode,
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

    // بازگرداندن سبد populated
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name price images countInStock discount')
      .lean()

    res.json({
      success: true,
      data: {
        items: populatedCart.items,
        totalPrice: populatedCart.totalPrice,
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
exports.addOrUpdateItem = async (req, res) => {
  try {
    const { product: productId, quantity, variantOptions } = req.body
    const userId = req.user._id

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'اطلاعات محصول نامعتبر است',
      })
    }

    // اعتبارسنجی محصول
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'محصول یافت نشد',
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

    // پیدا کردن آیتم در سبد
    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    )

    if (existingItemIndex > -1) {
      // به‌روزرسانی تعداد
      cart.items[existingItemIndex].quantity = quantity
      cart.items[existingItemIndex].price = product.price
    } else {
      // افزودن آیتم جدید
      cart.items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.images && product.images[0] ?
          (typeof product.images[0] === 'string' ? product.images[0] : product.images[0].url) :
          null,
        variantOptions: variantOptions || [],
      })
    }

    // محاسبه و ذخیره
    cart.calculateTotal()
    await cart.save()

    // بازگرداندن سبد populated
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name price images countInStock discount')
      .lean()

    res.json({
      success: true,
      data: {
        items: populatedCart.items,
        totalPrice: populatedCart.totalPrice,
      },
    })
  } catch (error) {
    console.error('Error adding/updating cart item:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در افزودن آیتم به سبد خرید',
      error: error.message,
    })
  }
}

// ============================================
// DELETE /api/cart/item/:productId - حذف آیتم
// ============================================
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params
    const userId = req.user._id

    const cart = await Cart.findOne({ user: userId, status: 'active' })

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'سبد خرید یافت نشد',
      })
    }

    // حذف آیتم
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    )

    // محاسبه و ذخیره
    cart.calculateTotal()
    await cart.save()

    // بازگرداندن سبد populated
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name price images countInStock discount')
      .lean()

    res.json({
      success: true,
      data: {
        items: populatedCart.items,
        totalPrice: populatedCart.totalPrice,
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
