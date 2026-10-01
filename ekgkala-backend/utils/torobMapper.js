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

  // specifications در مدل Product از نوع Mixed است و مدیر آن را به صورت
  // Key/Value در پنل ادمین ثبت می‌کند (مثلاً: {"رزولوشن": "5MP", "نوع لنز": "ثابت"})
  if (productSpecs && typeof productSpecs === 'object' && !Array.isArray(productSpecs)) {
    for (const [name, value] of Object.entries(productSpecs)) {
      if (value != null && value !== '') spec[String(name)] = String(value)
    }
  }

  return spec
}

const { computeItemPricing } = require('../services/pricingService')

const getPricing = (product, variant, now = new Date()) => {
  const item = { product, variantOptions: variant?.options || [], price: variant?.price };
  const pricing = computeItemPricing(item, now);
  const currentPrice = Math.round(pricing.finalPrice);

  // قیمت خط‌خورده فقط با تخفیف واقعی فعال از مبنای resolved می‌آید؛ compare کهنه‌ی خام هرگز oldPrice نمی‌شود
  return {
    currentPrice,
    oldPrice: (pricing.discount > 0 && Math.round(pricing.basePrice) > currentPrice)
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

const mapTorobProduct = (product, variant = null) => {
  const isVariable = product?.productType === 'variable'
  const variantId = variant?._id?.toString?.() || variant?._id
  const images = imageUrls(variant?.images).length > 0 ? imageUrls(variant.images) : imageUrls(product?.images)
  const pricing = getPricing(product, variant)

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

const flattenProduct = (product) => {
  if (!product || product.isActive !== true || product.excludeFromTorob === true) return []
  const rows = product.productType !== 'variable'
    ? [mapTorobProduct(product)]
    : (Array.isArray(product.variants) ? product.variants : []).map((variant) => mapTorobProduct(product, variant))
  // Torob requires a primary image for every published row.
  return rows.filter((row) => row.image_links.length > 0)
}

module.exports = { buildPageUrl, flattenProduct, getPricing, mapTorobProduct, mapSpecifications, stripHtml }
