// ============================================
// سرویس مرکزی موجودی انبار (Inventory) — تنها مرجع کسر/بازگشت موجودی
// --------------------------------------------
// قراردادها:
//  ۱) موجودی هرگز منفی نمی‌شود: کسر فقط با آپدیت اتمیک شرطیِ MongoDB
//     انجام می‌شود (فیلتر stock >= qty + ‏$inc)؛ clamp کردن تا صفر ممنوع است
//     چون همان oversell پنهان است.
//  ۲) رزرو در لحظه‌ی «ثبت سفارش» انجام می‌شود (نه بعد از پرداخت)، همه یا
//     هیچ‌کدام: اگر یک قلم موجودی نداشته باشد، رزرو اقلام قبلی rollback
//     می‌شود و هیچ سفارشی ثبت نمی‌شود.
//  ۳) اقلام تکراری یک سفارش (همان محصول + همان ترکیب) قبل از رزرو با هم
//     جمع می‌شوند تا دور زدن سقف موجودی با چند خط جدا ممکن نباشد.
//  ۴) محصول متغیر فقط با ترکیب دقیق (exact match روی همه‌ی گزینه‌ها)
//     قابل رزرو است؛ ترکیب ناقص/ناموجود خطاست. استثنا: محصولی که فقط یک
//     ترکیب دارد بدون گزینه هم قابل سفارش است (ابهامی وجود ندارد).
//  ۵) آزادسازی (لغو/انقضای رزرو) tolerant است: هرگز throw نمی‌کند تا مسیر
//     لغو سفارش به‌خاطر خطای موجودی قفل نشود؛ خطاها لاگ می‌شوند.
// ============================================

const Product = require('../models/Product')
const { normalizeVariantOptions, getVariantKey } = require('./pricingService')

class InventoryError extends Error {
  constructor(message, { statusCode = 400, code = 'INVENTORY_ERROR', details = undefined } = {}) {
    super(message)
    this.name = 'InventoryError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

const toCount = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

// --------------------------------------------
// اعتبارسنجی تعداد + تجمیع خطوط تکراری سفارش
// --------------------------------------------
const aggregateOrderItems = (orderItems) => {
  if (!Array.isArray(orderItems)) return []

  const byKey = new Map()
  for (const item of orderItems) {
    if (!item || !item.product) continue

    const quantity = Number(item.quantity ?? item.qty)
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new InventoryError(`تعداد سفارش برای «${item.name || 'محصول'}» نامعتبر است`, {
        statusCode: 400,
        code: 'INVALID_QUANTITY',
      })
    }

    const variantOptions = normalizeVariantOptions(item.variantOptions)
    const key = `${String(item.product)}::${getVariantKey(variantOptions)}`
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += quantity
    } else {
      byKey.set(key, {
        product: item.product,
        name: item.name || null,
        quantity,
        variantOptions,
      })
    }
  }
  return [...byKey.values()]
}

// --------------------------------------------
// پیدا کردن ترکیب دقیق یک محصول متغیر.
// strict=true (مسیر رزرو): ترکیب نامعتبر/ناقص خطاست.
// strict=false (مسیر آزادسازی): اگر پیدا نشد null برمی‌گردد تا بشود رد شد.
// --------------------------------------------
const resolveVariantExact = (product, variantOptions, { strict = true } = {}) => {
  if (!product || product.productType !== 'variable') return null

  const variants = Array.isArray(product.variants) ? product.variants : []
  const options = normalizeVariantOptions(variantOptions)

  if (options.length > 0) {
    const match = variants.find((variant) => {
      const vOptions = Array.isArray(variant?.options) ? variant.options : []
      if (vOptions.length !== options.length) return false
      return vOptions.every((vo) =>
        options.some(
          (io) => String(vo.name).trim() === String(io.name).trim() && String(vo.value).trim() === String(io.value).trim(),
        ),
      )
    })
    if (match) return match
    if (strict) {
      throw new InventoryError(`ترکیب انتخابی برای محصول «${product.name || 'نامشخص'}» معتبر نیست`, {
        statusCode: 400,
        code: 'INVALID_VARIANT',
      })
    }
    return null
  }

  // بدون گزینه: فقط وقتی ابهامی نیست می‌شود ترکیب را حدس زد.
  if (variants.length === 1) return variants[0]
  if (variants.length === 0) return null // داده‌ی ناقص: موجودی سطح محصول ملاک است
  if (strict) {
    throw new InventoryError(
      `برای محصول «${product.name || 'نامشخص'}» باید مدل/ترکیب انتخاب شود؛ لطفاً قلم را از سبد حذف و از صفحه‌ی محصول با انتخاب مدل دوباره اضافه کنید`,
      { statusCode: 400, code: 'VARIANT_REQUIRED' },
    )
  }
  return null
}

// موجودی فعلی یک خط (محصول + ترکیب) روی یک سند محصولِ خوانده‌شده.
const stockOfLine = (product, line) => {
  const variant = resolveVariantExact(product, line.variantOptions, { strict: false })
  if (product.productType === 'variable' && Array.isArray(product.variants) && product.variants.length > 0) {
    return variant ? toCount(variant.stock) : 0
  }
  return toCount(product.stock)
}

const insufficientError = (line, available) =>
  new InventoryError(
    `موجودی «${line.name || 'محصول'}» کافی نیست؛ موجودی فعلی ${available} عدد است و ${line.quantity} عدد درخواست شده است`,
    {
      statusCode: 409,
      code: 'INSUFFICIENT_STOCK',
      details: [
        {
          product: String(line.product),
          name: line.name || null,
          requested: line.quantity,
          available,
          variantOptions: line.variantOptions,
        },
      ],
    },
  )

// حل خطوط سفارش به هدف‌های موجودی (محصول خوانده‌شده از دیتابیس + ترکیب دقیق)،
// با ادغام خطوطی که به یک هدف می‌رسند (مثلاً یک خط با گزینه و یک خط بدون
// گزینه روی محصول تک‌ترکیبی).
const resolveLines = async (orderItems, { strict = true } = {}) => {
  const aggregated = aggregateOrderItems(orderItems)
  const byTarget = new Map()

  for (const line of aggregated) {
    const product = await Product.findById(line.product)
    if (!product || product.isActive === false) {
      if (!strict) continue
      throw new InventoryError(`محصول «${line.name || 'نامشخص'}» موجود نیست یا غیرفعال شده است`, {
        statusCode: 400,
        code: 'PRODUCT_UNAVAILABLE',
      })
    }

    const variant = resolveVariantExact(product, line.variantOptions, { strict })
    const isVariantTarget =
      product.productType === 'variable' && Array.isArray(product.variants) && product.variants.length > 0
    if (isVariantTarget && !variant) {
      // strict=false و ترکیب پیدا نشد (مثلاً ترکیب بعد از ثبت سفارش حذف شده):
      // این خط قابل بازگشت نیست؛ رد می‌شویم و در releaseStock لاگ می‌خورد.
      if (!strict) continue
    }

    const targetKey = `${String(product._id)}::${variant ? String(variant._id) : 'product'}`
    const existing = byTarget.get(targetKey)
    if (existing) {
      existing.quantity += line.quantity
    } else {
      byTarget.set(targetKey, {
        productId: product._id,
        productDoc: product,
        name: product.name || line.name,
        quantity: line.quantity,
        variantOptions: line.variantOptions,
        variant: variant || null,
      })
    }
  }
  return [...byTarget.values()]
}

// یک کسر اتمیک شرطی؛ true یعنی موجودی واقعاً کم شد.
const atomicDecrement = async (line) => {
  if (line.variant) {
    const result = await Product.updateOne(
      {
        _id: line.productId,
        variants: { $elemMatch: { _id: line.variant._id, stock: { $gte: line.quantity } } },
      },
      { $inc: { 'variants.$.stock': -line.quantity } },
    )
    return Boolean(result && result.modifiedCount === 1)
  }

  const result = await Product.updateOne(
    { _id: line.productId, stock: { $gte: line.quantity } },
    { $inc: { stock: -line.quantity } },
  )
  return Boolean(result && result.modifiedCount === 1)
}

// یک افزایش اتمیک (بازگشت موجودی)؛ مقدار برگشتی modifiedCount است.
const atomicIncrement = async (line) => {
  if (line.variant) {
    const result = await Product.updateOne(
      { _id: line.productId, 'variants._id': line.variant._id },
      { $inc: { 'variants.$.stock': line.quantity } },
    )
    return result?.modifiedCount || 0
  }

  const result = await Product.updateOne(
    { _id: line.productId },
    { $inc: { stock: line.quantity } },
  )
  return result?.modifiedCount || 0
}

// --------------------------------------------
// رزرو موجودی برای یک سفارش (همه یا هیچ‌کدام).
// موفق: آرایه‌ی خطوط رزروشده. ناموفق: InventoryError و rollback کامل.
// --------------------------------------------
const reserveStock = async (orderItems) => {
  const lines = await resolveLines(orderItems, { strict: true })
  const reserved = []

  try {
    for (const line of lines) {
      const ok = await atomicDecrement(line)
      if (!ok) {
        // موجودی بین خواندن و کسر تغییر کرده یا از ابتدا کافی نبوده:
        // عدد واقعی را تازه می‌خوانیم تا پیام خطا دقیق باشد.
        const fresh = await Product.findById(line.productId).lean()
        const available = fresh ? stockOfLine(fresh, line) : 0
        throw insufficientError(line, available)
      }
      reserved.push(line)
    }
  } catch (err) {
    // Rollback رزروهای همین فراخوانی — نباید هیچ قلمی نیمه‌رزرو بماند.
    for (const line of reserved) {
      try {
        await atomicIncrement(line)
      } catch (rollbackErr) {
        console.error('[Inventory] ❌ Rollback failed for product', String(line.productId), rollbackErr.message)
      }
    }
    throw err
  }

  return reserved
}

// --------------------------------------------
// آزادسازی موجودی رزروشده (لغو سفارش / انقضای رزرو / شکست پرداخت).
// tolerant: هرگز throw نمی‌کند؛ خروجی گزارش هر خط است.
// --------------------------------------------
const releaseStock = async (orderItems) => {
  const results = []
  try {
    const lines = await resolveLines(orderItems, { strict: false })
    for (const line of lines) {
      try {
        const modified = await atomicIncrement(line)
        if (modified !== 1) {
          console.error('[Inventory] ⚠️ Release matched nothing for product', String(line.productId))
        }
        results.push({ product: String(line.productId), released: modified === 1 })
      } catch (lineErr) {
        console.error('[Inventory] ❌ Release failed for product', String(line.productId), lineErr.message)
        results.push({ product: String(line.productId), released: false })
      }
    }
  } catch (err) {
    console.error('[Inventory] ❌ Release failed:', err.message)
  }
  return results
}

// --------------------------------------------
// بررسی خواندنی موجودی (بدون رزرو) — برای پیش‌چک قبل از درگاه پرداخت.
// تضمین نهایی فقط با reserveStock اتمیک است؛ این فقط خطای زودهنگام می‌دهد.
// --------------------------------------------
const assertAvailable = async (orderItems) => {
  const lines = await resolveLines(orderItems, { strict: true })
  for (const line of lines) {
    const available = stockOfLine(line.productDoc, line)
    if (available < line.quantity) {
      throw insufficientError(line, available)
    }
  }
  return true
}

// --------------------------------------------
// تغییر اتمیک شمارنده‌ی فروش (salesCount) — کف صفر، بدون read-modify-save.
// direction: ‏+1 برای فروش قطعی (پرداخت موفق)، ‎-1 برای برگشت (لغو).
// --------------------------------------------
const adjustSalesCount = async (orderItems, direction) => {
  try {
    const aggregated = aggregateOrderItems(orderItems)
    for (const line of aggregated) {
      const delta = line.quantity * (direction < 0 ? -1 : 1)
      await Product.updateOne({ _id: line.product }, [
        {
          $set: {
            salesCount: {
              $max: [0, { $add: [{ $ifNull: ['$salesCount', 0] }, delta] }],
            },
          },
        },
      ])
    }
  } catch (err) {
    console.error('[Inventory] ❌ adjustSalesCount failed:', err.message)
  }
}

// --------------------------------------------
// موجودی قابل نمایش/مصرف برای سبد خرید روی یک سند محصولِ از قبل خوانده‌شده.
// سبد رزرو نیست و مرجع نهایی محسوب نمی‌شود (مرجع، رزرو هنگام ثبت سفارش
// است)؛ این عدد فقط سقف تجربه‌ی کاربری است:
//  - محصول ساده: stock
//  - متغیر با ترکیب دقیق: موجودی همان ترکیب؛ با تطبیق جزئی (subset) همان
//    ترکیبی که pricing پیدا می‌کند؛ بدون گزینه: جمع موجودی ترکیب‌ها.
// --------------------------------------------
const availableForCart = (product, variantOptions) => {
  if (!product) return 0
  const options = normalizeVariantOptions(variantOptions)

  if (product.productType === 'variable' && Array.isArray(product.variants) && product.variants.length > 0) {
    if (options.length > 0) {
      const exact = resolveVariantExact(product, options, { strict: false })
      if (exact) return toCount(exact.stock)
      // تطبیق جزئی مثل pricingService: اولین ترکیبی که گزینه‌هایش زیرمجموعه‌ی انتخاب باشد
      const partial = product.variants.find((variant) => {
        const vOptions = Array.isArray(variant?.options) ? variant.options : []
        return (
          vOptions.length > 0 &&
          vOptions.every((vo) =>
            options.some(
              (io) => String(vo.name).trim() === String(io.name).trim() && String(vo.value).trim() === String(io.value).trim(),
            ),
          )
        )
      })
      return partial ? toCount(partial.stock) : 0
    }
    return product.variants.reduce((sum, v) => sum + toCount(v?.stock), 0)
  }

  return toCount(product.stock)
}

module.exports = {
  InventoryError,
  aggregateOrderItems,
  resolveVariantExact,
  reserveStock,
  releaseStock,
  assertAvailable,
  adjustSalesCount,
  availableForCart,
}
