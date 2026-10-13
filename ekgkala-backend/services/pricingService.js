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
/**
 * بازگرداندن قیمت پایه‌ی یک پروموشنِ منقضی‌شده روی شیء پاسخ (آینه‌ی شاخه‌ی expired در pipeline لیست).
 * - فقط اگر price از قبل تخفیف‌خورده ذخیره شده باشد (داده‌ی قدیمی: price ≈ compareAtPrice × (1 − تخفیف ثبت‌شده))
 *   قیمت به compareAtPrice برمی‌گردد؛ در غیر این صورت price دست‌نخورده می‌ماند.
 *   (قبلاً هر compareAtPrice بزرگ‌تر از price جایگزین قیمت می‌شد؛ یک compareAtPrice کهنه مثل ۳۰م قیمت ۴٫۸م را
 *   بعد از انقضا به ۳۰م می‌رساند.)
 * - compareAtPrice حذف می‌شود تا قیمت خط‌خورده‌ی کهنه/جعلی (و درصد جعلی) ساخته نشود.
 */
const restoreBasePriceOnObject = (target, storedDiscount = 0) => {
  if (!target) return target
  if (target.price !== undefined && target.price > 0) {
    target.price = resolveBasePrice(target.price, target.compareAtPrice, storedDiscount)
  }
  delete target.compareAtPrice
  if (Array.isArray(target.variants) && target.variants.length > 0) {
    target.variants = target.variants.map((v) => {
      const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v }
      if (vObj.price > 0) vObj.price = resolveBasePrice(vObj.price, vObj.compareAtPrice, storedDiscount)
      delete vObj.compareAtPrice
      return vObj
    })
  }
  return target
}

// متغیر مستثنی‌شده هیچ تخفیفی نمی‌گیرد (تیک تخفیف در پنل ادمین خاموش شده).
// داده‌های قدیمی بدون این فیلد => falsy => رفتار قبلی (شامل تخفیف).
const isVariantExcluded = (variant) => Boolean(variant && variant.excludeFromPromotion === true)

// محصولِ دارای متغیر که «همه‌ی» متغیرهایش از تخفیف مستثنی شده‌اند: هیچ مدلِ مشمولی
// وجود ندارد، پس هیچ پروموشنی (تخفیف زمان‌دار / لحظه‌ای / شگفت‌انگیز) برای این محصول
// معنا ندارد و نباید برچسب، تایمر یا درصد تخفیفی روی آن بنشیند.
// محصول ساده، محصول بدون متغیر و محصولی که حتی یک متغیر مشمول دارد => false (رفتار قبلی).
// ورودی‌های خراب (null / غیرآبجکت) نادیده گرفته می‌شوند.
const areAllVariantsExcluded = (product) => {
  if (!product || !Array.isArray(product.variants)) return false
  const list = product.variants.filter((v) => v && typeof v === 'object')
  return list.length > 0 && list.every(isVariantExcluded)
}

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
      if (isVariantExcluded(vObj)) {
        // مستثنی: قیمت به پایه برمی‌گردد و مقایسه‌ی تخفیفی ساخته نمی‌شود
        if (vObj.price > 0) vObj.price = resolveBasePrice(vObj.price, vObj.compareAtPrice, storedDiscount)
        delete vObj.compareAtPrice
        return vObj
      }
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

// ============================================
// قاعده‌ی واحد تخفیف خودِ محصول (بخش «فروش ویژه و تخفیف» در پنل ادمین)
// --------------------------------------------
// فیلد discount محصول فقط «درصدِ» پیشنهاد لحظه‌ای / شگفت‌انگیز است و به‌تنهایی
// هیچ اعتباری ندارد: فقط وقتی اعمال می‌شود که یکی از این دو روی همان محصول «زنده»
// باشد (فلگ روشن و تایمر نگذشته). با غیرفعال‌شدن دستی یا پایان تایمر، تخفیف
// کاملاً حذف می‌شود و هرگز به‌عنوان «تخفیف ساده» باقی نمی‌ماند.
// تخفیف زمان‌دار (Sale / بخش مالی) مسیر مستقل خودش را دارد و از این قاعده تأثیر نمی‌گیرد.
// ============================================
const isTimerLive = (flag, end, now = new Date()) => {
  if (!flag) return false
  if (!end) return true // فلگ روشن بدون زمان پایان = بدون انقضا (رفتار قبلی حفظ می‌شود)
  const d = new Date(end)
  return !Number.isNaN(d.getTime()) && d > now
}

const isOwnPromotionLive = (product, now = new Date()) =>
  Boolean(product) && (
    isTimerLive(product.isFlashDeal, product.flashDealEndTime, now) ||
    isTimerLive(product.isSpecialOffer, product.specialOfferEndTime, now)
  )

/** درصد تخفیف خودِ محصول که واقعاً قابل اعمال است (۰ اگر لحظه‌ای/شگفت‌انگیز زنده نباشد). */
const getEffectiveOwnDiscount = (product, now = new Date()) => {
  if (!isOwnPromotionLive(product, now)) return 0
  const d = Number(product.discount) || 0
  return d > 0 ? Math.min(100, d) : 0
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

  let flashActive = isTimerLive(product.isFlashDeal, product.flashDealEndTime, now)
  let specialActive = isTimerLive(product.isSpecialOffer, product.specialOfferEndTime, now)
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

  // مستثنی‌سازی سطح وariant: اگر ترکیب انتخابی تیک تخفیفش خاموش است،
  // هیچ تخفیفی (لحظه‌ای / شگفت‌انگیز / زمان‌دار) روی همین قلم اعمال نمی‌شود.
  // محصول ساده یا وariant بدون فلگ => رفتار قبلی.
  const variantExcluded = isVariantExcluded(matchingVariant)

  if (variantExcluded) {
    appliedDiscount = 0
    campaignLabel = null
  } else if (flashActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'پیشنهاد لحظه‌ای'
  } else if (specialActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'پیشنهاد شگفت‌انگیز'
  } else {
    // نه لحظه‌ای/شگفت‌انگیز زنده است و نه تخفیف زمان‌دار: تخفیف ثبت‌شده‌ی محصول
    // (حتی بدون فلگ) هرگز به‌عنوان «تخفیف ساده» اعمال نمی‌شود.
    campaignLabel = null
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

/**
 * لایه‌ی تخفیف/لیبل برای پاسخ جزئیات محصول (منبع حقیقتِ واحد برای GET /:id و GET by-code).
 *
 * قواعد (هم‌راستا با pipeline لیست محصولات):
 *  - Sale فعال (startDate ≤ now < endDate): درصد و لیبل Sale اعمال می‌شود.
 *  - بدون Sale: تخفیف خودِ محصول فقط وقتی اعمال می‌شود که پیشنهاد لحظه‌ای یا شگفت‌انگیزِ
 *    همان محصول زنده باشد. غیرفعال (دستی) یا تایمر منقضی ⇒ تخفیف ۰، بدون لیبل، بدون قیمت خط‌خورده.
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

  // همه‌ی متغیرها مستثنی‌اند: هیچ پروموشنی (حتی Sale فعال) روی این محصول نمی‌نشیند.
  // مسیر «بدون پروموشن زنده» پایین‌تر همه‌چیز را به قیمت پایه و بدون لیبل برمی‌گرداند.
  const suppressed = areAllVariantsExcluded(productObj)

  if (activeSale && !suppressed) {
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

  if (suppressed || (!flashLive && !specialLive)) {
    // لحظه‌ای/شگفت‌انگیز غیرفعال (دستی) یا تایمرش تمام شده — یا همه‌ی متغیرها مستثنی‌اند:
    // تخفیف کاملاً حذف می‌شود
    // (تخفیف ۰، قیمت پایه، بدون لیبل/قیمت خط‌خورده‌ی تخفیفی) — مثل لیست محصولات.
    productObj.discount = 0
    restoreBasePriceOnObject(productObj, storedDiscount)
    delete productObj.campaignLabel
    delete productObj.campaignTheme
    productObj.isSpecialOffer = false
    productObj.isFlashDeal = false
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

// مدل‌های قیمت‌گذاری‌شده برای کارت‌های خلاصه (مثلاً /bestsellers که pipeline
// لیست را اجرا نمی‌کند). آینه‌ی شاخه‌ی variants در productListingService با همان
// قرارداد، تا فرانت با resolvePricing دوباره دقیقاً همان را حساب کند (idempotent):
// - مدل مستثنی (excludeFromPromotion=true) یا بدون تخفیف زنده: قیمت پایه، بدون compareAtPrice
// - بقیه: همان درصدِ اعمال‌شده روی خود محصول روی مبنای legacy-aware
// ورودی‌های خراب (null/غیرآبجکت) نادیده گرفته می‌شوند؛ بقیه‌ی فیلدهای مدل دست‌نخورده می‌مانند.
const priceVariantsForCard = (variants, { discountPct = 0, storedDiscount = 0 } = {}) => {
  if (!Array.isArray(variants)) return []
  const d = Number(discountPct) || 0
  const stored = Number(storedDiscount) || 0
  return variants
    .filter((v) => v && typeof v === 'object')
    .map((v) => {
      const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v }
      const raw = Number(vObj.price) || 0
      const base = resolveBasePrice(vObj.price, vObj.compareAtPrice, stored)
      if (isVariantExcluded(vObj) || !(d > 0)) {
        return { ...vObj, price: base, compareAtPrice: undefined }
      }
      return {
        ...vObj,
        price: raw > 0 ? Math.round(base - (base * d) / 100) : raw,
        compareAtPrice: base,
      }
    })
}

module.exports = {
  normalizeVariantOptions,
  getVariantKey,
  findMatchingVariant,
  isVariantExcluded,
  areAllVariantsExcluded,
  priceVariantsForCard,
  computeItemPricing,
  getActiveSalesCampaignContext,
  isTimerLive,
  isOwnPromotionLive,
  getEffectiveOwnDiscount,
  resolveBasePrice,
  applyDiscountToObject,
  applyPromotionOverlay,
  restoreBasePriceOnObject,
  ttlUntil,
  sanitizeCompareAtPrice,
  sanitizeVariantsCompareAtPrice,
  LEGACY_BASE_TOLERANCE,
}
