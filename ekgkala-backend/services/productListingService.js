const mongoose = require('mongoose')
const { resolveSort, buildSort, sortStages } = require('./productSorting')

const MAX_PAGE = 100000
const MAX_LIMIT = 100
const OPERATORS = new Set(['eq', 'lt', 'gt', 'gte', 'lte'])
const NUMBERS = new Set(['price', 'stock', 'discount', 'rating', 'numReviews', 'views', 'salesCount', 'clickCount'])
const BOOLEANS = new Set(['isActive', 'isFeatured', 'isOnSale', 'isFlashDeal', 'isSpecialOffer'])
const DATES = new Set(['createdAt', 'updatedAt', 'flashDealEndTime', 'specialOfferEndTime'])
const STRINGS = new Set(['name', 'sku', 'slug', 'productCode', 'productType'])
const IDS = new Set(['_id', 'brand', 'category'])
const INTERNAL = '__listing'

class ListingQueryError extends Error {
  constructor(message) {
    super(message)
    this.statusCode = 400
  }
}

function text(value, name, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new ListingQueryError(`Invalid ${name}`)
  }
  return value.trim()
}

function number(value, name, max = Number.MAX_SAFE_INTEGER) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '') {
    throw new ListingQueryError(`Invalid ${name}`)
  }
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0 || result > max) {
    throw new ListingQueryError(`${name} must be a finite nonnegative number <= ${max}`)
  }
  return result
}

function boolean(value, name) {
  if ([true, 'true', 1, '1'].includes(value)) return true
  if ([false, 'false', 0, '0'].includes(value)) return false
  throw new ListingQueryError(`Invalid ${name}`)
}

function boundedInteger(value, fallback, max, name) {
  if (value === undefined) return fallback
  const result = number(value, name)
  if (!Number.isSafeInteger(result) || result < 1) throw new ListingQueryError(`Invalid ${name}`)
  return Math.min(result, max)
}

const objectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
  ? new mongoose.Types.ObjectId(value) : null

// Literal search with the same Persian/Arabic equivalents as the legacy listing.
function searchPattern(value) {
  const groups = ['یيئ', 'کك', 'هة', 'آأإا', 'وؤ', '۰٠0', '۱١1', '۲٢2', '۳٣3', '۴٤4', '۵٥5', '۶٦6', '۷٧7', '۸٨8', '۹٩9']
  return [...value].map((char) => {
    const group = groups.find((item) => item.includes(char))
    return group ? `[${group}]` : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('')
}

function parseProjection(value) {
  if (value === undefined) return null
  const projection = {}
  const fields = text(value, 'fields', 2000).split(/[\s,]+/)
  for (const token of fields) {
    const field = token.replace(/^-/, '')
    if (!/^[a-zA-Z_][\w]*(\.[a-zA-Z_][\w]*)*$/.test(field) || field.startsWith(INTERNAL)) {
      throw new ListingQueryError('Invalid fields')
    }
    projection[field] = token.startsWith('-') ? 0 : 1
  }
  const modes = new Set(Object.entries(projection).filter(([key]) => key !== '_id').map(([, mode]) => mode))
  if (modes.size > 1) throw new ListingQueryError('Cannot mix included and excluded fields')
  const names = Object.keys(projection)
  if (names.some((name) => names.some((other) => other.startsWith(`${name}.`)))) {
    throw new ListingQueryError('Conflicting fields')
  }
  return projection
}

function parseListingQuery(query = {}) {
  const options = {
    page: boundedInteger(query.page, 1, MAX_PAGE, 'page'),
    limit: boundedInteger(query.limit, 20, MAX_LIMIT, 'limit'),
    skipDiscount: query.skipDiscount === undefined ? false : boolean(query.skipDiscount, 'skipDiscount'),
    inStock: query.inStock === undefined ? false : boolean(query.inStock, 'inStock'),
    onSale: query.onSale === undefined ? false : boolean(query.onSale, 'onSale'),
    // بخش «منتخب‌ها»ی صفحه اصلی: شگفت‌انگیزهای دستی + محصولات تخفیف‌های زمان‌داری که showInFeatured دارند
    featured: query.featured === undefined ? false : boolean(query.featured, 'featured'),
    includeChildren: query.includeChildren === undefined ? false : boolean(query.includeChildren, 'includeChildren'),
    projection: parseProjection(query.fields),
    conditions: [],
    priceConditions: [],
    properties: new Map(),
    brands: [],
  }
  let includeInactive = query.includeInactive
  if (Array.isArray(includeInactive)) includeInactive = includeInactive.some((v) => [true, 'true', 1, '1'].includes(v))
  let active = includeInactive !== undefined && boolean(includeInactive, 'includeInactive') ? undefined : true
  for (const key of ['minPrice', 'maxPrice']) {
    if (query[key] !== undefined) options[key] = number(query[key], key)
  }
  if (options.minPrice !== undefined && options.maxPrice !== undefined && options.minPrice > options.maxPrice) {
    throw new ListingQueryError('minPrice must not exceed maxPrice')
  }
  if (options.minPrice !== undefined) options.priceConditions.push({ [`${INTERNAL}.price`]: { $gte: options.minPrice } })
  if (options.maxPrice !== undefined) options.priceConditions.push({ [`${INTERNAL}.price`]: { $lte: options.maxPrice } })
  if (query.minRating !== undefined) options.conditions.push({ rating: { $gte: number(query.minRating, 'minRating', 5) } })
  if (query.minSalesCount !== undefined) options.conditions.push({ salesCount: { $gte: number(query.minSalesCount, 'minSalesCount') } })
  for (const field of BOOLEANS) {
    if (query[field] !== undefined && typeof query[field] !== 'object') {
      const value = boolean(query[field], field)
      if (field === 'isActive') active = value
      else options.conditions.push({ [field]: value })
    }
  }
  if (query.productType === 'variable') options.conditions.push({ productType: 'variable' })
  else if (query.productType === 'simple') options.conditions.push({ $or: [{ productType: { $exists: false } }, { productType: { $in: [null, '', 'simple'] } }] })
  else if (query.productType !== undefined && typeof query.productType !== 'object') throw new ListingQueryError('Invalid productType')

  const advanced = (field, op, raw) => {
    if (!OPERATORS.has(op)) throw new ListingQueryError('Invalid filter operator')
    let value = Array.isArray(raw) ? raw[0] : raw // Legacy advanced filter arrays used first value.
    if (NUMBERS.has(field)) value = number(value, field)
    else if (BOOLEANS.has(field)) {
      if (op !== 'eq') throw new ListingQueryError('Boolean filters only support eq')
      value = boolean(value, field)
    } else if (DATES.has(field)) {
      value = new Date(text(value, field))
      if (!Number.isFinite(value.getTime())) throw new ListingQueryError(`Invalid ${field}`)
    } else if (IDS.has(field)) {
      value = objectId(value)
      if (!value) throw new ListingQueryError(`Invalid ${field}`)
    } else if (STRINGS.has(field)) value = text(value, field)
    else throw new ListingQueryError(`Unsupported filter field: ${field}`)
    if (field === 'isActive') active = value
    else if (field === 'price') options.priceConditions.push({ [`${INTERNAL}.price`]: { [`$${op}`]: value } })
    else options.conditions.push({ [field]: { [`$${op}`]: value } })
  }
  for (const [field, value] of Object.entries(query)) {
    if (field !== 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, raw] of Object.entries(value)) advanced(field, op, raw)
    }
    const match = field.match(/^([^\[\]]+)\[(eq|lt|gt|gte|lte)\]$/)
    if (match && match[1] !== 'properties') advanced(match[1], match[2], value)
  }
  if (active !== undefined) options.conditions.push({ isActive: active })
  if (query.category !== undefined && (typeof query.category !== 'object' || Array.isArray(query.category))) options.category = text(query.category, 'category')
  if (query.brand !== undefined && (typeof query.brand !== 'object' || Array.isArray(query.brand))) {
    const rawBrands = Array.isArray(query.brand) ? query.brand.map((value) => text(value, 'brand')).join(',') : query.brand
    options.brands = [...new Set(text(rawBrands, 'brand', 6000).split(',').map((v) => v.trim()).filter(Boolean))]
    if (!options.brands.length || options.brands.length > 30) throw new ListingQueryError('Between 1 and 30 brands are allowed')
  }
  const addProperty = (name, raw) => {
    name = text(name, 'property name', 100)
    if (['__proto__', 'constructor', 'prototype'].includes(name)) throw new ListingQueryError('Invalid property name')
    const values = (Array.isArray(raw) ? raw : [raw]).map((v) => text(v, 'property value'))
    const combined = [...new Set([...(options.properties.get(name) || []), ...values])]
    if (!combined.length || combined.length > 30) throw new ListingQueryError('At most 30 values per property are allowed')
    options.properties.set(name, combined)
  }
  if (query.properties !== undefined) {
    if (!query.properties || typeof query.properties !== 'object' || Array.isArray(query.properties)) throw new ListingQueryError('Invalid properties')
    for (const [name, value] of Object.entries(query.properties)) addProperty(name, value)
  }
  for (const [key, value] of Object.entries(query)) {
    const match = key.match(/^properties\[([^\[\]]+)\](?:\[\])?$/)
    if (match) addProperty(match[1], value)
  }
  if (options.properties.size > 30) throw new ListingQueryError('At most 30 properties are allowed')
  for (const [label, values] of options.properties) options.conditions.push({ properties: { $elemMatch: { label, value: { $in: values } } } })
  if (query.search !== undefined) {
    options.search = text(query.search, 'search')
    const regex = { $regex: searchPattern(options.search), $options: 'i' }
    options.conditions.push(query.searchField === 'name' ? { name: regex } : {
      $or: [...(query.searchField === 'sku' ? [] : [{ name: regex }]), { sku: regex }, { 'variants.sku': regex }],
    })
  }
  options.sortMode = resolveSort(query.sort === undefined ? undefined : text(query.sort, 'sort'), options)
  options.sort = buildSort(options, new Set([...NUMBERS, ...DATES, 'name', 'sku', '_id']))
  return options
}

// Sales/category metadata is small; products are never loaded or filtered in JS.
// Explicit ObjectId casting matters: Mongoose does NOT cast aggregation matches.
async function resolveListingContext(options, { Category, Brand, Sale }, now) {
  const conditions = [...options.conditions]
  const descendants = new Map()
  const categoryIds = async (id) => {
    const key = String(id)
    if (!descendants.has(key)) {
      descendants.set(key, Category.aggregate([
        { $match: { _id: objectId(key) } },
        { $graphLookup: { from: Category.collection.name, startWith: '$_id', connectFromField: '_id', connectToField: 'parent', as: 'descendants', maxDepth: 20 } },
        { $project: { ids: '$descendants._id' } },
      ]).then((rows) => [objectId(key), ...(rows[0]?.ids || [])]))
    }
    return descendants.get(key)
  }
  if (options.category) {
    const id = objectId(options.category)
    const category = await Category.findOne(id ? { $or: [{ slug: options.category }, { _id: id }] } : { slug: options.category }).select('_id').lean()
    conditions.push({ category: { $in: category ? options.includeChildren ? await categoryIds(category._id) : [category._id] : [] } })
  }
  if (options.brands.length) {
    const brands = await Brand.find({ slug: { $in: options.brands } }).select('_id').lean()
    conditions.push({ brand: { $in: [...brands.map((b) => b._id), ...options.brands.map(objectId).filter(Boolean)] } })
  }
  const campaigns = []
  if (!options.skipDiscount) {
    const sales = await Sale.find({ isActive: true, startDate: { $lte: now }, endDate: { $gt: now } })
      .select('name products categories discountPercentage badgeTheme endDate includeSubcategories showInFeatured').sort({ _id: 1 }).lean()
    for (const sale of sales) {
      const categories = []
      for (const id of sale.categories || []) categories.push(...(sale.includeSubcategories !== false ? await categoryIds(id) : [id]))
      campaigns.push({ ...sale, categories })
    }
  }
  if (options.featured && !options.skipDiscount) {
    const featuredOr = [{ isSpecialOffer: true, specialOfferEndTime: { $gt: now } }]
    for (const sale of campaigns) {
      if (sale.showInFeatured === false) continue
      if (sale.products?.length) featuredOr.push({ _id: { $in: sale.products } })
      if (sale.categories?.length) featuredOr.push({ category: { $in: sale.categories } })
    }
    conditions.push({ $or: featuredOr })
  }
  return { conditions, campaigns }
}

const literal = (value) => ({ $literal: value })
const numeric = (path) => ({ $convert: { input: path, to: 'double', onNull: 0, onError: 0 } })
// Mongo $round uses banker's rounding; storefront pricing uses Math.round.
const round = (value) => ({ $floor: { $add: [value, 0.5] } })
const ref = (key) => `$${INTERNAL}.${key}`
const timedActive = (flag, end, now) => ({ $and: [flag, { $or: [{ $eq: [{ $ifNull: [end, null] }, null] }, { $gt: [end, now] }] }] })
const timedExpired = (flag, end, now) => ({ $and: [flag, { $ne: [{ $ifNull: [end, null] }, null] }, { $lte: [end, now] }] })

function pricingStages(campaigns, now) {
  // Direct assignment wins over category assignment, regardless of discount size.
  // Within a tier use oldest ObjectId, making overlapping campaigns deterministic.
  const branches = ['products', 'categories'].flatMap((key) => campaigns.filter((c) => c[key]?.length).map((sale) => ({
    case: { $in: [key === 'products' ? '$_id' : '$category', literal(sale[key])] },
    then: literal({ name: sale.name, discount: sale.discountPercentage, theme: sale.badgeTheme || 'green-orange', endDate: sale.endDate, featured: sale.showInFeatured !== false }),
  })))
  const hasCampaign = { $ne: [ref('campaign'), null] }
  // آینه‌ی resolveBasePrice با عملگرهای مونگو (pipeline نمی‌تواند JS صدا بزند).
  // هر تغییری در منطق باید در هر دو جا اعمال و با تست همسانی پوشش داده شود.
  // discountExpr برای سطح وariant قابل بازنویسی است تا وariant مستثنی
  // (excludeFromPromotion=true) تخفیف صفر بگیرد؛ ریشه همیشه ref('discount').
  const priceObject = (source, storedDiscountExpr, discountExpr = ref('discount')) => {
    const price = numeric(`${source}.price`)
    const compare = numeric(`${source}.compareAtPrice`)
    const storedDiscount = storedDiscountExpr
    const legacyMatch = {
      $and: [
        { $gt: [compare, price] },
        { $gt: [storedDiscount, 0] },
        { $lte: [storedDiscount, 100] },
        // |price − compare×(1 − d/100)| ≤ ۱ : تلرانس رُند شدن
        { $lte: [{ $abs: { $subtract: [price, { $multiply: [compare, { $subtract: [1, { $divide: [storedDiscount, 100] }] }] }] } }, 1] },
      ],
    }
    const base = {
      $cond: [
        { $lte: [price, 0] },
        { $max: [price, compare] },
        { $cond: [legacyMatch, compare, price] },
      ],
    }
    return {
      price: { $cond: [ref('expired'), base, { $cond: [{ $and: [{ $gt: [discountExpr, 0] }, { $gt: [price, 0] }] }, round({ $subtract: [base, { $divide: [{ $multiply: [base, discountExpr] }, 100] }] }), price] }] },
      compareAtPrice: { $cond: [{ $or: [ref('expired'), { $gt: [discountExpr, 0] }] }, base, compare] },
    }
  }
  return [
    { $addFields: { [INTERNAL]: { campaign: branches.length ? { $switch: { branches, default: null } } : null } } },
    // محصول متغیری که «همه‌ی» متغیرهایش excludeFromPromotion=true دارند هیچ مدل مشمولی ندارد:
    // هیچ پروموشنی (Sale / لحظه‌ای / شگفت‌انگیز) روی آن معنا ندارد. (آینه‌ی areAllVariantsExcluded)
    // بقیه‌ی محصولات (ساده، متغیرِ دارای حداقل یک مدل مشمول) دقیقاً مثل قبل پردازش می‌شوند.
    { $addFields: { [`${INTERNAL}.suppressed`]: { $and: [
      { $eq: ['$productType', 'variable'] },
      { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] },
      { $not: [{ $anyElementTrue: [{ $map: { input: { $ifNull: ['$variants', []] }, as: 'v', in: { $ne: ['$$v.excludeFromPromotion', true] } } }] }] },
    ] } } },
    { $addFields: { [`${INTERNAL}.campaign`]: { $cond: [ref('suppressed'), null, ref('campaign')] } } },
    { $addFields: {
      [`${INTERNAL}.eligible`]: { $and: [{ $not: [ref('suppressed')] }, { $or: [hasCampaign, timedActive('$isFlashDeal', '$flashDealEndTime', now), timedActive('$isSpecialOffer', '$specialOfferEndTime', now)] }] },
      [`${INTERNAL}.variable`]: { $and: [{ $eq: ['$productType', 'variable'] }, { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] }] },
    } },
    { $addFields: {
      [`${INTERNAL}.discount`]: { $cond: [ref('eligible'), { $min: [100, { $max: [0, { $cond: [hasCampaign, ref('campaign.discount'), numeric('$discount')] }] }] }, 0] },
      [`${INTERNAL}.expired`]: { $or: [timedExpired('$isFlashDeal', '$flashDealEndTime', now), timedExpired('$isSpecialOffer', '$specialOfferEndTime', now)] },
      [`${INTERNAL}.stock`]: { $cond: [{ $eq: ['$productType', 'variable'] }, { $sum: '$variants.stock' }, numeric('$stock')] },
    } },
    { $addFields: {
      // تخفیف ثبت‌شده‌ی خود محصول برای تشخیص داده‌ی قدیمی؛ داخل $map هم به سند ریشه اشاره می‌کند
      [`${INTERNAL}.root`]: priceObject('$$ROOT', numeric('$discount')),
      // وariant مستثنی (excludeFromPromotion=true) تخفیف صفر می‌گیرد و با قیمت پایه می‌ماند؛
      // بقیه دقیقاً مثل قبل با تخفیف محصول/کمپین محاسبه می‌شوند. فیلد ناموجود => falsy => شامل تخفیف.
      [`${INTERNAL}.variants`]: { $map: { input: { $ifNull: ['$variants', []] }, as: 'variant', in: { $mergeObjects: ['$$variant', priceObject('$$variant', numeric('$discount'), { $cond: [{ $eq: ['$$variant.excludeFromPromotion', true] }, 0, ref('discount')] })] } } },
    } },
    { $addFields: {
      [`${INTERNAL}.display`]: { $cond: [ref('variable'), { $reduce: { input: ref('variants'), initialValue: null, in: { $cond: [{ $or: [{ $eq: ['$$value', null] }, { $lt: ['$$this.price', '$$value.price'] }] }, '$$this', '$$value'] } } }, ref('root')] },
    } },
    { $addFields: {
      [`${INTERNAL}.price`]: ref('display.price'),
      // onSale must reflect a REAL discount only. A stale inflated
      // compareAtPrice with discount=0 must not mark a product as on sale.
      [`${INTERNAL}.onSale`]: { $gt: [ref('discount'), 0] },
    } },
  ]
}

function buildListingPipeline(options, { conditions = options.conditions, campaigns = [] } = {}, now = new Date()) {
  const stages = conditions.length ? [{ $match: { $and: conditions } }] : []
  if (options.skipDiscount) {
    stages.push({ $addFields: { [INTERNAL]: { price: numeric('$price'), stock: numeric('$stock'), onSale: { $gt: [numeric('$compareAtPrice'), numeric('$price')] } } } })
  } else stages.push(...pricingStages(campaigns, now))
  const effectiveConditions = []
  if (options.inStock) effectiveConditions.push({ [`${INTERNAL}.stock`]: { $gt: 0 } })
  if (options.onSale) effectiveConditions.push({ [`${INTERNAL}.onSale`]: true })
  if (options.featured && !options.skipDiscount) {
    // اگر کمپینِ اعمال‌شده روی محصول تخفیف زمان‌دار است، فقط با showInFeatured وارد منتخب‌ها می‌شود؛
    // در غیر این صورت شگفت‌انگیز دستیِ فعال (با تایمر) ملاک است.
    effectiveConditions.push({ $expr: { $cond: [
      ref('suppressed'),
      false,
      { $cond: [
        { $ne: [ref('campaign'), null] },
        { $eq: [ref('campaign.featured'), true] },
        { $and: [{ $eq: ['$isSpecialOffer', true] }, { $gt: [{ $ifNull: ['$specialOfferEndTime', null] }, now] }] },
      ] },
    ] } })
  }
  if (effectiveConditions.length) stages.push({ $match: { $and: effectiveConditions } })
  const priceMatch = options.priceConditions.length ? [{ $match: { $and: options.priceConditions } }] : []
  const data = [...priceMatch, ...sortStages(options, searchPattern)]
  if (options.featured && !options.skipDiscount) {
    // «منتخب‌ها»: ترتیب کاملاً رندم؛ زمان فعال‌سازی نباید از ترتیب کارت‌ها قابل حدس باشد.
    data.push(
      { $addFields: { [`${INTERNAL}.randSort`]: { $rand: {} } } },
      { $sort: { [`${INTERNAL}.randSort`]: 1 } },
    )
  } else {
    data.push({ $sort: options.sort })
  }
  data.push({ $skip: (options.page - 1) * options.limit }, { $limit: options.limit })
  if (!options.skipDiscount) data.push({ $addFields: {
    price: ref('price'), stock: ref('stock'),
    // Expose compareAtPrice ONLY when a real discount exists. Otherwise a
    // stale inflated compareAtPrice would let clients derive a phantom 80%+.
    compareAtPrice: { $cond: [{ $gt: [ref('discount'), 0] }, ref('display.compareAtPrice'), '$$REMOVE'] },
    variants: ref('variants'), discount: ref('discount'),
    campaignLabel: { $cond: [ref('suppressed'), '$$REMOVE', { $cond: [{ $ne: [ref('campaign'), null] }, ref('campaign.name'), { $cond: [{ $and: ['$isFlashDeal', { $gt: [ref('discount'), 0] }] }, 'پیشنهاد لحظه‌ای', { $ifNull: ['$campaignLabel', '$$REMOVE'] }] }] }] },
    campaignTheme: { $cond: [ref('suppressed'), '$$REMOVE', { $cond: [{ $ne: [ref('campaign'), null] }, ref('campaign.theme'), { $cond: [{ $and: ['$isFlashDeal', { $gt: [ref('discount'), 0] }] }, 'gold-red', { $ifNull: ['$campaignTheme', '$$REMOVE'] }] }] }] },
    isSpecialOffer: { $cond: [ref('suppressed'), false, { $cond: [{ $gt: [ref('campaign.discount'), 0] }, true, '$isSpecialOffer'] }] },
    specialOfferEndTime: { $cond: [ref('suppressed'), '$$REMOVE', { $cond: [{ $gt: [ref('campaign.discount'), 0] }, ref('campaign.endDate'), '$specialOfferEndTime'] }] },
    isFlashDeal: { $cond: [ref('suppressed'), false, '$isFlashDeal'] },
    flashDealEndTime: { $cond: [ref('suppressed'), '$$REMOVE', '$flashDealEndTime'] },
  } })
  data.push({ $project: { [INTERNAL]: 0 } })
  if (options.projection) data.push({ $project: options.projection })
  stages.push({ $facet: {
    data,
    total: [...priceMatch, { $count: 'count' }],
    priceRange: [{ $group: { _id: null, min: { $min: ref('price') }, max: { $max: ref('price') } } }],
  } })
  return stages
}

async function listProducts(query, models, now = new Date()) {
  const options = parseListingQuery(query)
  const context = await resolveListingContext(options, models, now)
  const [result] = await models.Product.aggregate(buildListingPipeline(options, context, now)).allowDiskUse(true)
  const total = result?.total[0]?.count || 0
  return {
    success: true,
    data: result?.data || [],
    pagination: { currentPage: options.page, itemsPerPage: options.limit, totalItems: total, totalPages: Math.ceil(total / options.limit) || 1 },
    priceRange: { min: result?.priceRange[0]?.min ?? 0, max: result?.priceRange[0]?.max ?? 0 },
  }
}

module.exports = { listProducts, parseListingQuery, buildListingPipeline, resolveListingContext, ListingQueryError }
