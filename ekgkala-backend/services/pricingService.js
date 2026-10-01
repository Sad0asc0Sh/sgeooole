// ============================================
// قرارداد مرکزی قیمت (price contract)
// --------------------------------------------
// مبنای تخفیف درصدی همیشه «price» ثبت‌شده است؛ compareAtPrice فقط قیمت
// خط‌خورده‌ی نمایشی است و هرگز مبنای محاسبه نیست.
// تنها استثنا (سازگاری با داده‌ی قدیمی): اگر price از قبل تخفیف‌خورده ذخیره
// شده باشد، یعنی compareAtPrice > price و رابطه‌ی
//   price ≈ compareAtPrice × (1 − storedDiscount/100)
// با تلرانس رُند شدن برقرار باشد، آنگاه compareAtPrice مبناست. این تشخیص فقط
// با تخفیف ثبت‌شده‌ی خود محصول انجام می‌شود چون کمپین Sale درصد را جایگزین می‌کند.
// ============================================

// تلرانس تشخیص داده‌ی قدیمی (خطای رُند شدن، به تومان)
const LEGACY_BASE_TOLERANCE = 1

const resolveBasePrice = (price, compareAtPrice, storedDiscount = 0) => {
  const p = Number(price) || 0
  const c = Number(compareAtPrice) || 0
  // قیمت صفر/نامعتبر: رفتار قبلی (max) حفظ می‌شود تا «قیمت ۰ + تخفیف» نشکند
  if (p <= 0) return Math.max(p, c)
  if (c > p) {
    const d = Number(storedDiscount) || 0
    if (d > 0 && d <= 100 && Math.abs(p - c * (1 - d / 100)) <= LEGACY_BASE_TOLERANCE) {
      return c
    }
  }
  return p
}

// اعمال درصد تخفیف روی آبجکت محصول برای پاسخ جزئیات: price به قیمت نهایی
// و compareAtPrice به مبنای resolved تبدیل می‌شود. قرارداد API عوض نمی‌شود.
const applyDiscountToObject = (target, discountPct, storedDiscount = 0) => {
  if (!target || !(discountPct > 0)) return target
  if (target.price !== undefined && target.price > 0) {
    const orig = resolveBasePrice(target.price, target.compareAtPrice, storedDiscount)
    const dAmount = (orig * discountPct) / 100
    target.price = Math.round(orig - dAmount)
    target.compareAtPrice = orig
  }
  if (Array.isArray(target.variants) && target.variants.length > 0) {
    target.variants = target.variants.map((v) => {
      const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v }
      if (vObj.price > 0) {
        const origV = resolveBasePrice(vObj.price, vObj.compareAtPrice, storedDiscount)
        const vDiscount = (origV * discountPct) / 100
        vObj.price = Math.round(origV - vDiscount)
        vObj.compareAtPrice = origV
      }
      return vObj
    })
  }
  return target
}

// پاک‌سازی ورودی compareAtPrice:
// - اگر ≤ قیمت باشد نادیده گرفته می‌شود (null برمی‌گردد تا پاک شود)
// - اگر بیش از ۱۰ برابر قیمت باشد فقط هشدار می‌دهد (خطای سخت نیست)
const sanitizeCompareAtPrice = (price, compareAtPrice) => {
  const p = Number(price) || 0
  if (compareAtPrice === null || compareAtPrice === undefined || compareAtPrice === '') {
    return { value: null, warning: null }
  }
  const c = Number(compareAtPrice)
  if (!Number.isFinite(c)) return { value: null, warning: null }
  if (c <= p) return { value: null, warning: null }
  if (p > 0 && c > p * 10) {
    return { value: c, warning: `قیمت خط‌خورده (${c.toLocaleString('fa-IR')}) بیش از ۱۰ برابر قیمت (${p.toLocaleString('fa-IR')}) است؛ احتمال اشتباه تایپی وجود دارد` }
  }
  return { value: c, warning: null }
}

// پاک‌سازی قیمت خط‌خورده‌ی واریانت‌ها با همان قاعده‌ی محصول ساده.
// هشدارها را برمی‌گرداند تا caller در پاسخ/لاگ بگذارد.
const sanitizeVariantsCompareAtPrice = (variants) => {
  const warnings = []
  if (!Array.isArray(variants)) return { variants, warnings }
  const cleaned = variants.map((v, i) => {
    if (!v || typeof v !== 'object') return v
    const { value, warning } = sanitizeCompareAtPrice(v.price, v.compareAtPrice)
    if (warning) warnings.push(`واریانت ${i + 1}: ${warning}`)
    if (value === null) {
      const { compareAtPrice: _drop, ...rest } = v
      return rest
    }
    return { ...v, compareAtPrice: value }
  })
  return { variants: cleaned, warnings }
}

const normalizeVariantOptions = (variantOptions) => {
  if (!Array.isArray(variantOptions)) return []

  return variantOptions
    .filter((vo) => vo && vo.name != null && vo.value != null)
    .map((vo) => ({
      name: String(vo.name).trim(),
      value: String(vo.value).trim(),
    }))
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name)
      if (nameCompare !== 0) return nameCompare
      return a.value.localeCompare(b.value)
    })
}

const getVariantKey = (normalizedVariantOptions) => {
  if (!Array.isArray(normalizedVariantOptions) || normalizedVariantOptions.length === 0) {
    return 'no-variant'
  }

  return normalizedVariantOptions
    .map((vo) => `${String(vo.name).trim()}:${String(vo.value).trim()}`)
    .join('|')
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

const getAllDescendantCategoryIds = async (categoryId) => {
  try {
    const Category = require('../models/Category')
    const children = await Category.find({ parent: categoryId }).select('_id').lean()
    if (!children.length) return []
    const childIds = children.map((c) => c._id.toString())
    const subChildren = await Promise.all(
      childIds.map((id) => getAllDescendantCategoryIds(id))
    )
    return [...childIds, ...subChildren.flat()]
  } catch (error) {
    console.error('Error in getAllDescendantCategoryIds:', error)
    return []
  }
}

const getActiveSalesCampaignContext = async (now = new Date()) => {
  try {
    const Sale = require('../models/Sale')
    const activeSales = await Sale.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now },
    })
      .populate('categories', '_id')
      .select('name products categories discountPercentage badgeTheme endDate includeSubcategories')
      .lean()

    const campaignMap = new Map()
    const categoryDiscountMap = new Map()

    for (const sale of activeSales) {
      if (sale.products && sale.products.length > 0) {
        sale.products.forEach((pid) => {
          const key = pid.toString()
          if (!campaignMap.has(key)) {
            campaignMap.set(key, {
              name: sale.name,
              discount: sale.discountPercentage,
              theme: sale.badgeTheme,
              endDate: sale.endDate,
            })
          }
        })
      }

      if (sale.categories && sale.categories.length > 0) {
        for (const cat of sale.categories) {
          const categoryId = (cat._id || cat).toString()
          const categoryIds = sale.includeSubcategories !== false
            ? [categoryId, ...(await getAllDescendantCategoryIds(categoryId))]
            : [categoryId]

          categoryIds.forEach((cid) => {
            const key = cid.toString()
            if (!categoryDiscountMap.has(key)) {
              categoryDiscountMap.set(key, {
                name: sale.name,
                discount: sale.discountPercentage,
                theme: sale.badgeTheme,
                endDate: sale.endDate,
              })
            }
          })
        }
      }
    }

    return { campaignMap, categoryDiscountMap }
  } catch (err) {
    console.error('Error fetching active sales campaigns:', err)
    return { campaignMap: new Map(), categoryDiscountMap: new Map() }
  }
}

const computeItemPricing = (item, now = new Date(), campaignContext = null) => {
  const product = item?.product || {}
  const quantity = Number(item.quantity || item.qty || 1) || 1
  const matchingVariant = findMatchingVariant(product, item.variantOptions)

  let basePrice = 0
  // مبنای تخفیف طبق قرارداد مرکزی: همیشه price، مگر داده‌ی قدیمیِ از قبل تخفیف‌خورده
  const storedDiscount = Number(product.discount) || 0
  if (matchingVariant) {
    const vPrice = Number(matchingVariant.price) || 0
    const vCompareAt = Number(matchingVariant.compareAtPrice) || 0
    basePrice = resolveBasePrice(vPrice, vCompareAt, storedDiscount)
  } else {
    const rawCompareAt = Number(product.compareAtPrice) || 0
    const rawProdPrice = Number(product.price ?? item.price ?? 0) || 0
    basePrice = resolveBasePrice(rawProdPrice, rawCompareAt, storedDiscount)
  }

  let rawDiscount = Number(product.discount) || 0
  const flashEnd = product.flashDealEndTime ? new Date(product.flashDealEndTime) : null
  const specialEnd = product.specialOfferEndTime ? new Date(product.specialOfferEndTime) : null

  let flashActive = Boolean(product.isFlashDeal && (!flashEnd || flashEnd > now))
  let specialActive = Boolean(product.isSpecialOffer && (!specialEnd || specialEnd > now))
  let campaignLabel = product.campaignLabel || null
  let specialOfferEndTime = product.specialOfferEndTime || null

  // Check marketing campaign if context provided
  if (campaignContext) {
    const { campaignMap, categoryDiscountMap } = campaignContext
    const prodId = (product._id || item.product)?.toString()
    const catId = (product.category?._id || product.category)?.toString()

    const campaign = (prodId && campaignMap?.get(prodId)) || (catId && categoryDiscountMap?.get(catId))
    if (campaign && campaign.discount > 0) {
      if (campaign.discount > rawDiscount || (!flashActive && !specialActive)) {
        rawDiscount = campaign.discount
        specialActive = true
        campaignLabel = campaign.name || 'پیشنهاد شگفت‌انگیز'
        specialOfferEndTime = campaign.endDate || null
      }
    }
  }

  let appliedDiscount = 0

  if (flashActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'پیشنهاد لحظه‌ای'
  } else if (specialActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'پیشنهاد شگفت‌انگیز'
  } else if (!product.isFlashDeal && !product.isSpecialOffer && rawDiscount > 0) {
    // Non-timer discounts remain valid when no countdown flags are set
    appliedDiscount = rawDiscount
  }

  const finalPrice =
    appliedDiscount > 0
      ? Math.max(0, Math.round(basePrice * (1 - appliedDiscount / 100)))
      : basePrice

  return {
    basePrice,
    finalPrice,
    discount: appliedDiscount,
    campaignLabel,
    flashActive,
    specialActive,
    specialOfferEndTime,
    quantity,
  }
}

const FLASH_LABEL = 'پیشنهاد لحظه‌ای'
const FLASH_THEME = 'gold-red'

const isTimerLive = (flag, end, now) => Boolean(flag) && (!end || new Date(end) > now)

/**
 * لایه‌ی تخفیف/لیبل برای پاسخ جزئیات محصول (منبع حقیقتِ واحد برای GET /:id و GET by-code).
 *
 * قواعد (هم‌راستا با pipeline لیست محصولات):
 *  - Sale فعال (startDate ≤ now < endDate): درصد و لیبل Sale اعمال می‌شود.
 *  - بدون Sale: تخفیف خودِ محصول فقط وقتی اعمال می‌شود که محصول فلگ زمان‌دار نداشته باشد
 *    یا تایمرِ فلگ‌دارش هنوز نگذشته باشد. تایمر منقضی ⇒ تخفیف ۰، بدون لیبل، بدون قیمت خط‌خورده.
 *  - لیبل «پیشنهاد لحظه‌ای» فقط برای فلش زنده‌ی دارای تخفیف است.
 *
 * @returns {{ promotionEndsAt: Date|null }} نزدیک‌ترین زمان پایانِ پروموشنِ اعمال‌شده؛ برای محدودکردن TTL کش
 */
const applyPromotionOverlay = (productObj, { activeSale = null, now = new Date() } = {}) => {
  // تخفیف ثبت‌شده‌ی خود محصول، قبل از جایگزینی با درصد کمپین (برای تشخیص داده‌ی قدیمی در resolveBasePrice)
  const storedDiscount = Number(productObj.discount) || 0
  let promotionEndsAt = null
  const track = (date) => {
    if (!date) return
    const d = new Date(date)
    if (Number.isNaN(d.getTime()) || d <= now) return
    if (!promotionEndsAt || d < promotionEndsAt) promotionEndsAt = d
  }

  if (activeSale) {
    productObj.campaignLabel = activeSale.name
    productObj.campaignTheme = activeSale.badgeTheme || 'green-orange'
    if (activeSale.discountPercentage > 0) {
      productObj.discount = activeSale.discountPercentage
      productObj.isSpecialOffer = true
      productObj.isFromActiveSale = true
      productObj.specialOfferEndTime = activeSale.endDate
      applyDiscountToObject(productObj, activeSale.discountPercentage, storedDiscount)
    }
    track(activeSale.endDate)
    return { promotionEndsAt }
  }

  const flashLive = isTimerLive(productObj.isFlashDeal, productObj.flashDealEndTime, now)
  const specialLive = isTimerLive(productObj.isSpecialOffer, productObj.specialOfferEndTime, now)
  const hasTimerFlag = Boolean(productObj.isFlashDeal || productObj.isSpecialOffer)
  const timerExpired = hasTimerFlag && !flashLive && !specialLive

  if (timerExpired) {
    // تایمر تمام شده: خروجی مثل لیست محصولات (تخفیف ۰، قیمت پایه، بدون لیبل/قیمت خط‌خورده‌ی تخفیفی)
    productObj.discount = 0
    if (productObj.compareAtPrice && productObj.compareAtPrice > productObj.price) {
      productObj.price = productObj.compareAtPrice
    }
    delete productObj.compareAtPrice
    delete productObj.campaignLabel
    delete productObj.campaignTheme
    productObj.isSpecialOffer = false
    productObj.isFlashDeal = false
    if (Array.isArray(productObj.variants)) {
      productObj.variants = productObj.variants.map((v) => {
        const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v }
        if (vObj.compareAtPrice && vObj.compareAtPrice > vObj.price) {
          vObj.price = vObj.compareAtPrice
        }
        delete vObj.compareAtPrice
        return vObj
      })
    }
    return { promotionEndsAt: null }
  }

  if (storedDiscount > 0) {
    applyDiscountToObject(productObj, storedDiscount, storedDiscount)
    if (flashLive) {
      productObj.campaignLabel = FLASH_LABEL
      productObj.campaignTheme = FLASH_THEME
      track(productObj.flashDealEndTime)
    } else {
      delete productObj.campaignLabel
      delete productObj.campaignTheme
    }
    if (specialLive) track(productObj.specialOfferEndTime)
  } else {
    delete productObj.campaignLabel
    delete productObj.campaignTheme
    delete productObj.compareAtPrice
  }
  return { promotionEndsAt }
}

/** TTL کش (ثانیه) برای پاسخی که پروموشنش در promotionEndsAt تمام می‌شود؛ هرگز بیشتر از baseTtl و کمتر از ۱ نیست. */
const ttlUntil = (promotionEndsAt, baseTtl, now = new Date()) => {
  if (!promotionEndsAt) return baseTtl
  const seconds = Math.ceil((new Date(promotionEndsAt).getTime() - new Date(now).getTime()) / 1000)
  return Math.max(1, Math.min(baseTtl, seconds))
}

module.exports = {
  normalizeVariantOptions,
  getVariantKey,
  findMatchingVariant,
  computeItemPricing,
  getActiveSalesCampaignContext,
  resolveBasePrice,
  applyDiscountToObject,
  applyPromotionOverlay,
  ttlUntil,
  sanitizeCompareAtPrice,
  sanitizeVariantsCompareAtPrice,
  LEGACY_BASE_TOLERANCE,
}
