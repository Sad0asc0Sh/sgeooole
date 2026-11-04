const stripHtml = (value) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 500)

const asIsoDate = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date(0).toISOString()
}

const imageUrls = (images) => (Array.isArray(images) ? images : [])
  .map((image) => (typeof image === 'string' ? image : image?.url))
  .filter((url) => typeof url === 'string' && url.trim())

/**
 * مشخصات فنی برای فید ترب.
 *
 * منبع اول نام برند و گارانتی محصول است تا ترب بتواند کالا را به درستی تطبیق دهد.
 * سپس `product.specifications` (شیء رسمی) و `product.properties` ({label, value})
 * و در نهایت ویژگی‌های خاص تنوع انتخابی (`variant.options`) اضافه می‌شوند.
 */
const MAX_SPEC_ENTRIES = 80

const mapSpecifications = (product, variant = null) => {
  const { normCompareKey, canonicalizeSpecLabel } = require('../services/specNormalization')
  const spec = {}
  const seenKeys = new Set()
  let count = 0
  const put = (name, value) => {
    if (count >= MAX_SPEC_ENTRIES) return
    const key = String(name == null ? '' : name).trim()
    const text = String(value == null ? '' : value).trim()
    if (!key || !text) return
    const compareKey = normCompareKey(canonicalizeSpecLabel(key))
    if (seenKeys.has(compareKey)) return
    seenKeys.add(compareKey)
    spec[key] = text
    count += 1
  }

  // ۱. برند (حیاتی برای موتور تطبیق خودکار ترب)
  const brandName = product?.brand?.name || (typeof product?.brand === 'string' ? product.brand : null)
  if (brandName) {
    put('برند', brandName)
  }

  // ۲. گارانتی
  if (product?.guarantee) {
    put('گارانتی', product.guarantee)
  }

  // ۳. مشخصات رسمی کالا
  const productSpecs = product?.specifications
  if (productSpecs && typeof productSpecs === 'object' && !Array.isArray(productSpecs)) {
    for (const [name, value] of Object.entries(productSpecs)) {
      if (value != null && value !== '') put(name, value)
    }
  }

  // ۴. ویژگی‌های مکمل کالا
  if (Array.isArray(product?.properties)) {
    for (const item of product.properties) {
      if (!item || typeof item !== 'object') continue
      put(item.label, item.value)
    }
  }

  // ۵. مشخصات خاص تنوع انتخابی (رنگ، سایز، اقلام مازاد و...)
  if (Array.isArray(variant?.options)) {
    for (const opt of variant.options) {
      if (!opt || typeof opt !== 'object') continue
      put(opt.name, opt.value)
    }
  }

  return spec
}

const buildSubtitle = (product, variant = null) => {
  if (variant && Array.isArray(variant.options) && variant.options.length > 0) {
    const parts = variant.options
      .map((opt) => (typeof opt === 'object' ? opt?.value : opt))
      .filter((val) => typeof val === 'string' && val.trim().length > 0)
    if (parts.length > 0) {
      return parts.join(' - ').slice(0, 500)
    }
  }
  return null
}

const { computeItemPricing } = require('../services/pricingService')

/**
 * تبدیل آرایه‌ای از اسناد Sale فعال به ساختار campaignContext مورد نیاز computeItemPricing
 */
const normalizeCampaignContext = (campaignOrSales) => {
  if (!campaignOrSales) return null
  if (campaignOrSales.campaignMap instanceof Map || campaignOrSales.categoryDiscountMap instanceof Map) {
    return campaignOrSales
  }
  if (Array.isArray(campaignOrSales)) {
    const campaignMap = new Map()
    const categoryDiscountMap = new Map()
    for (const sale of campaignOrSales) {
      if (!sale) continue
      if (Array.isArray(sale.products)) {
        for (const pid of sale.products) {
          const key = String(pid?._id || pid)
          if (!campaignMap.has(key)) {
            campaignMap.set(key, {
              name: sale.name,
              discount: sale.discountPercentage,
              theme: sale.badgeTheme,
              endDate: sale.endDate,
            })
          }
        }
      }
      if (Array.isArray(sale.categories)) {
        for (const cid of sale.categories) {
          const key = String(cid?._id || cid)
          if (!categoryDiscountMap.has(key)) {
            categoryDiscountMap.set(key, {
              name: sale.name,
              discount: sale.discountPercentage,
              theme: sale.badgeTheme,
              endDate: sale.endDate,
            })
          }
        }
      }
    }
    return { campaignMap, categoryDiscountMap }
  }
  return null
}

const getPricing = (product, variant, now = new Date(), campaignContext = null) => {
  const item = { product, variantOptions: variant?.options || [], price: variant?.price }
  const normalizedCtx = normalizeCampaignContext(campaignContext)
  const pricing = computeItemPricing(item, now, normalizedCtx)
  const currentPrice = Math.round(pricing.finalPrice)

  return {
    currentPrice,
    oldPrice:
      pricing.discount > 0 && Math.round(pricing.basePrice) > currentPrice
        ? Math.round(pricing.basePrice)
        : null,
  }
}

const buildPageUrl = (product) => {
  const baseUrl = String(process.env.FRONTEND_URL || '').replace(/\/$/, '')
  const productCode = String(product?.productCode || '').toLowerCase()
  const slug = String(product?.slug || '').trim()
  return `${baseUrl}/product/${productCode}/${slug}`
}

const mapTorobProduct = (product, variantOrSales = null, campaignContext = null, options = {}) => {
  const isSecondArgSales =
    Array.isArray(variantOrSales) ||
    (variantOrSales && (variantOrSales.campaignMap instanceof Map || variantOrSales.categoryDiscountMap instanceof Map))
  const variant = isSecondArgSales ? null : variantOrSales
  const effectiveCampaignCtx = isSecondArgSales ? variantOrSales : campaignContext
  const { isPrimaryVariant = false } = options

  const isVariable = product?.productType === 'variable'
  const variantId = variant?._id?.toString?.() || variant?._id
  const images = imageUrls(variant?.images).length > 0 ? imageUrls(variant.images) : imageUrls(product?.images)
  const pricing = getPricing(product, variant, new Date(), effectiveCampaignCtx)

  const inStock = Boolean(
    product?.isActive === true &&
    (isVariable ? Number(variant?.stock) > 0 : Number(product?.stock) > 0) &&
    pricing.currentPrice > 0
  )

  const addedDate = asIsoDate(product?.createdAt)
  const updatedDate = asIsoDate(product?.updatedAt || product?.createdAt)

  // برای واریانت اصلی (یا محصولات ساده)، page_unique دقیقاً برابر با productCode است
  // تا شناسه محصول ثبت‌شده در دیتابیس ترب بدون تغییر باقی بماند و خطای access=False رفع شود.
  // واریانت‌های جانبی شناسه ترکیبی دریافت می‌کنند.
  let pageUnique = product.productCode
  if (isVariable && variantId && !isPrimaryVariant) {
    pageUnique = `${product.productCode}_${variantId}`
  }

  return {
    page_url: buildPageUrl(product),
    page_unique: pageUnique,
    product_group_id: isVariable ? product.productCode : null,
    title: String(product?.name || '').slice(0, 500),
    subtitle: buildSubtitle(product, variant),
    short_desc: stripHtml(product?.description),
    category_name: product?.category?.name ? String(product.category.name).slice(0, 200) : null,
    guarantee: product?.guarantee ? String(product.guarantee).slice(0, 200) : null,
    stock_status: 'new',
    current_price: pricing.currentPrice,
    old_price: pricing.oldPrice,
    availability: inStock,
    image_links: images,
    spec: mapSpecifications(product, variant),
    date_added: addedDate,
    date_updated: updatedDate,
  }
}

/**
 * تعیین واریانت کانونیکال (معمولاً ارزان‌ترین واریانت موجود در انبار) برای نمایش تک‌محصول
 */
const getCanonicalVariant = (product, campaignContext = null) => {
  if (!product || product.productType !== 'variable' || !Array.isArray(product.variants) || product.variants.length === 0) {
    return null
  }
  const effectiveCampaignCtx = normalizeCampaignContext(campaignContext)
  const available = product.variants.filter((v) => Number(v.stock) > 0 && Number(v.price) > 0)
  const pool = available.length > 0 ? available : product.variants

  const sorted = [...pool].sort((a, b) => {
    const priceA = getPricing(product, a, new Date(), effectiveCampaignCtx).currentPrice
    const priceB = getPricing(product, b, new Date(), effectiveCampaignCtx).currentPrice
    return priceA - priceB
  })

  return sorted[0] || null
}

/**
 * قرارداد پایدار فید ترب: هر صفحه‌ی محصول (page_url) دقیقاً «یک» ردیف دارد.
 *
 * - محصول ساده: یک ردیف با page_unique = productCode.
 * - محصول متغیر: یک ردیف با تنوع کانونیکال (ارزان‌ترین تنوع موجود) و باز هم
 *   page_unique = productCode. شناسه‌ی تنوع‌ها (_id) هرگز وارد page_unique نمی‌شود؛
 *   چون با ذخیره‌ی دوباره‌ی تنوع‌ها در ادمین عوض می‌شود و ترب آن را «حذف‌شده» می‌بیند.
 *
 * چرا یک ردیف: در خروجی پنل ترب (۱۳ آبان) هر ۷ محصول چندتنوعی که چند ردیف با
 * page_url یکسان در فید داشتند «وضعیت دسترسی: False» بودند، و همه‌ی محصولاتی که
 * دقیقاً یک ردیف داشتند True بودند. پاسخ حالت page_urls هم همیشه تک‌ردیفی است؛
 * این تابع فید کامل را با آن هم‌شکل می‌کند.
 */
const flattenProduct = (product, campaignContext = null) => {
  if (!product || product.isActive !== true || product.excludeFromTorob === true) return []
  const variants = Array.isArray(product.variants) ? product.variants : []
  const variant =
    product.productType === 'variable' && variants.length > 0
      ? getCanonicalVariant(product, campaignContext) || variants[0]
      : null
  return [mapTorobProduct(product, variant, campaignContext, { isPrimaryVariant: true })].filter(
    (row) => row.image_links.length > 0,
  )
}

module.exports = {
  buildPageUrl,
  buildSubtitle,
  flattenProduct,
  getCanonicalVariant,
  getPricing,
  mapTorobProduct,
  mapSpecifications,
  normalizeCampaignContext,
  stripHtml,
}
