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

const mapSpecifications = (product) => {
  const spec = {}
  const productSpecs = product?.specifications

  if (productSpecs && typeof productSpecs === 'object' && !Array.isArray(productSpecs)) {
    for (const [name, value] of Object.entries(productSpecs)) {
      if (value != null && value !== '') spec[String(name)] = String(value)
    }
  }

  return spec
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

const mapTorobProduct = (product, variantOrSales = null, campaignContext = null) => {
  const isSecondArgSales =
    Array.isArray(variantOrSales) ||
    (variantOrSales && (variantOrSales.campaignMap instanceof Map || variantOrSales.categoryDiscountMap instanceof Map))
  const variant = isSecondArgSales ? null : variantOrSales
  const effectiveCampaignCtx = isSecondArgSales ? variantOrSales : campaignContext

  const isVariable = product?.productType === 'variable'
  const variantId = variant?._id?.toString?.() || variant?._id
  const images = imageUrls(variant?.images).length > 0 ? imageUrls(variant.images) : imageUrls(product?.images)
  const pricing = getPricing(product, variant, new Date(), effectiveCampaignCtx)

  return {
    page_url: buildPageUrl(product),
    page_unique: isVariable ? `${product.productCode}_${variantId}` : product.productCode,
    product_group_id: isVariable ? product.productCode : null,
    title: String(product?.name || '').slice(0, 500),
    subtitle: null,
    short_desc: stripHtml(product?.description),
    category_name: product?.category?.name || null,
    guarantee: product?.guarantee || null,
    current_price: pricing.currentPrice,
    old_price: pricing.oldPrice,
    availability: Boolean(product?.isActive === true && (isVariable ? Number(variant?.stock) > 0 : Number(product?.stock) > 0)),
    image_links: images,
    spec: mapSpecifications(product),
    date_added: asIsoDate(product?.createdAt),
    date_updated: asIsoDate(product?.updatedAt),
  }
}

const flattenProduct = (product, campaignContext = null) => {
  if (!product || product.isActive !== true || product.excludeFromTorob === true) return []
  const rows = product.productType !== 'variable'
    ? [mapTorobProduct(product, null, campaignContext)]
    : (Array.isArray(product.variants) ? product.variants : []).map((variant) =>
        mapTorobProduct(product, variant, campaignContext),
      )
  return rows.filter((row) => row.image_links.length > 0)
}

module.exports = {
  buildPageUrl,
  flattenProduct,
  getPricing,
  mapTorobProduct,
  mapSpecifications,
  normalizeCampaignContext,
  stripHtml,
}
