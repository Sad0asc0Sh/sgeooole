const Product = require('../models/Product')
const logger = require('../utils/logger')
const { getTorobFeed } = require('../jobs/torobFeedCache')
const { flattenProduct, mapTorobProduct, getCanonicalVariant } = require('../utils/torobMapper')

// ثبت صریح مدل‌های Mongoose برای جلوگیری از خطای MissingSchemaError در فراخوانی‌های populate
require('../models/Category')
require('../models/Brand')
require('../models/Sale')

const PAGE_SIZE = 100
const SORTS = new Set(['date_added_desc', 'date_updated_desc'])

const response = (res, products, currentPage = 1, total = products.length) => res.json({
  api_version: 'torob_api_v3',
  current_page: currentPage,
  count: total,
  total,
  max_pages: total === 0 ? 1 : Math.ceil(total / PAGE_SIZE),
  products,
})

const validateRequest = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) return 'request body is empty'
  const hasPage = Object.prototype.hasOwnProperty.call(body, 'page')
  const hasSort = Object.prototype.hasOwnProperty.call(body, 'sort')
  const hasUrls = Object.prototype.hasOwnProperty.call(body, 'page_urls')
  const hasUniques = Object.prototype.hasOwnProperty.call(body, 'page_uniques')
  const groups = Number(hasUrls) + Number(hasUniques) + Number(hasPage || hasSort)
  if (groups !== 1 || (hasUrls && hasUniques)) return 'only one of page_urls, page_uniques or page+sort must be provided'
  if (hasPage && !hasSort) return 'sort parameter is not provided'
  if (!hasPage && hasSort) return 'page parameter is not provided'
  if (hasPage) {
    if (!Number.isInteger(body.page) || body.page < 1) return 'page parameter is invalid'
    if (!SORTS.has(body.sort)) return 'sort value is invalid'
    return null
  }
  const key = hasUrls ? 'page_urls' : 'page_uniques'
  if (!Array.isArray(body[key]) || body[key].length === 0) return `${key} must be a non-empty array`
  return null
}

const extractProductCode = (pageUrl) => {
  if (typeof pageUrl !== 'string') return null
  try {
    const match = new URL(pageUrl).pathname.match(/^\/product\/([^/]+)(?:\/|$)/i)
    return match ? decodeURIComponent(match[1]).toUpperCase() : null
  } catch (_) {
    return null
  }
}

const parsePageUnique = (pageUnique) => {
  if (typeof pageUnique !== 'string' || !pageUnique.trim()) return null
  const match = pageUnique.trim().match(/^(KY-[A-Z0-9-]+?)(?:_([a-fA-F0-9]{24}))?$/i)
  return match ? { productCode: match[1].toUpperCase(), variantId: match[2] || null } : null
}

const fetchProducts = async (requests, { singlePerCode = false } = {}) => {
  const codes = [...new Set(requests.map((item) => item.productCode))]
  if (codes.length === 0) return []
  const products = await Product.find({
    productCode: { $in: codes },
    isActive: true,
    excludeFromTorob: { $ne: true },
  })
    .populate('category', 'name')
    .populate('brand', 'name')
    .lean()
  const byCode = new Map(products.map((product) => [product.productCode, product]))

  return requests.flatMap(({ productCode, variantId, isUrlMode }) => {
    const product = byCode.get(productCode)
    if (!product) return []
    if (variantId) {
      if (product.productType !== 'variable') return []
      const variant = (product.variants || []).find((entry) => String(entry._id) === variantId)
      // اگر مستقیماً یک variantId خاص درخواست شده باشد:
      return variant ? [mapTorobProduct(product, variant, null, { isPrimaryVariant: false })].filter((row) => row.image_links.length > 0) : []
    }
    // در استعلام تک‌محصول با URL یا با کد محصول اصلی بدون شناسه تنوع:
    // شناسه کالا باید دقیقاً منطبق بر productCode باشد تا در جستجو و اعتبارسنجی ترب تطبیق یابد.
    if (singlePerCode || isUrlMode) {
      if (product.productType === 'variable') {
        const canonical = getCanonicalVariant(product)
        return canonical ? [mapTorobProduct(product, canonical, null, { isPrimaryVariant: true })].filter((row) => row.image_links.length > 0) : []
      }
      return [mapTorobProduct(product, null, null, { isPrimaryVariant: true })].filter((row) => row.image_links.length > 0)
    }
    return flattenProduct(product)
  })
}

const torobRequestLogger = (req, res, next) => {
  const started = Date.now()
  res.on('finish', () => {
    logger.info('[TOROB] Feed request', {
      ip: req.ip,
      mode: req.torobMode || 'invalid',
      products: res.locals.torobProductCount || 0,
      statusCode: res.statusCode,
      durationMs: Date.now() - started,
    })
  })
  next()
}

const getProducts = async (req, res, next) => {
  const validationError = validateRequest(req.body)
  if (validationError) return res.status(400).json({ error: validationError })

  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'page')) {
      req.torobMode = 'page'
      const feed = await getTorobFeed()
      const key = req.body.sort === 'date_added_desc' ? 'date_added' : 'date_updated'
      const sorted = [...feed].sort((a, b) => new Date(b[key]) - new Date(a[key]) || a.page_unique.localeCompare(b.page_unique))
      const total = sorted.length
      const products = sorted.slice((req.body.page - 1) * PAGE_SIZE, req.body.page * PAGE_SIZE)
      res.locals.torobProductCount = products.length
      return response(res, products, req.body.page, total)
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'page_urls')) {
      req.torobMode = 'page_urls'
      const requests = req.body.page_urls
        .map(extractProductCode)
        .filter(Boolean)
        .map((productCode) => ({ productCode, variantId: null, isUrlMode: true }))
      const products = await fetchProducts(requests, { singlePerCode: true })
      res.locals.torobProductCount = products.length
      return response(res, products)
    }

    req.torobMode = 'page_uniques'
    const requests = req.body.page_uniques.map(parsePageUnique).filter(Boolean)
    const products = await fetchProducts(requests, { singlePerCode: true })
    res.locals.torobProductCount = products.length
    return response(res, products)
  } catch (error) {
    return next(error)
  }
}

module.exports = { PAGE_SIZE, extractProductCode, fetchProducts, getProducts, parsePageUnique, torobRequestLogger, validateRequest }
