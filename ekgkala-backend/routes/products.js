const express = require('express')
const router = express.Router()
const ExcelJS = require('exceljs')
const csv = require('csv-parser')
const fs = require('fs')
const multer = require('multer')
const path = require('path')

const Product = require('../models/Product')
const Sale = require('../models/Sale')
const Category = require('../models/Category')
const Brand = require('../models/Brand')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { upload, cloudinary } = require('../middleware/upload')
const { cacheMiddleware, clearCacheByKey, clearCacheByPrefix, CACHE_TTL } = require('../middleware/cache')

// ============================================
// Persian/Arabic Character Normalization for Search
// Converts search text to regex that matches both Arabic and Persian character variants
// ============================================
function buildPersianSearchRegex(text) {
  if (!text) return text

  // Define character equivalence groups
  const equivalences = [
    ['ی', 'ي', 'ئ'],           // ی فارسی ↔ ي عربی ↔ ئ
    ['ک', 'ك'],                // ک فارسی ↔ ك عربی
    ['ه', 'ة'],                // ه ↔ ة
    ['آ', 'أ', 'إ', 'ا'],         // آ ↔ أ ↔ إ ↔ ا
    ['و', 'ؤ'],                // و ↔ ؤ
    ['۰', '٠', '0'],           // ۰ ↔ ٠ ↔ 0
    ['۱', '١', '1'],           // ۱ ↔ ١ ↔ 1
    ['۲', '٢', '2'],           // ۲ ↔ ٢ ↔ 2
    ['۳', '٣', '3'],           // ۳ ↔ ٣ ↔ 3
    ['۴', '٤', '4'],           // ۴ ↔ ٤ ↔ 4
    ['۵', '٥', '5'],           // ۵ ↔ ٥ ↔ 5
    ['۶', '٦', '6'],           // ۶ ↔ ٦ ↔ 6
    ['۷', '٧', '7'],           // ۷ ↔ ٧ ↔ 7
    ['۸', '٨', '8'],           // ۸ ↔ ٨ ↔ 8
    ['۹', '٩', '9'],           // ۹ ↔ ٩ ↔ 9
  ]

  // Build char-to-group map
  const charMap = new Map()
  for (const group of equivalences) {
    const charClass = `[${group.join('')}]`
    for (const ch of group) {
      charMap.set(ch, charClass)
    }
  }

  // Special regex characters that need escaping
  const regexSpecial = /[.*+?^${}()|[\]\\]/g

  let pattern = ''
  for (const ch of text) {
    if (charMap.has(ch)) {
      pattern += charMap.get(ch)
    } else if (regexSpecial.test(ch)) {
      pattern += '\\' + ch
    } else {
      pattern += ch
    }
  }

  return pattern
}

// Joi Validation
const validate = require('../middleware/validate')
const {
  productCreateSchema,
  productUpdateSchema,
  productListQuerySchema,
} = require('../validators/joiSchemas/productSchemas')

// Multer configuration for CSV upload (local storage)
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/csv')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname))
  },
})

const csvUpload = multer({
  storage: csvStorage,
  limits: {
    // 25MB default - override with env for larger catalogs
    fileSize: Number(process.env.CSV_IMPORT_MAX_FILE_SIZE || 25 * 1024 * 1024),
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ])

    if (allowedMimeTypes.has(file.mimetype) || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true)
    } else {
      cb(new Error('فقط فایل‌های CSV مجاز هستند'))
    }
  },
})

const CSV_IMPORT_TIMEOUT_MS = Number(process.env.CSV_IMPORT_TIMEOUT_MS || 15 * 60 * 1000)
const CSV_IMPORT_BATCH_SIZE = Number(process.env.CSV_IMPORT_BATCH_SIZE || 500)

const safeUnlink = (targetPath) => {
  if (!targetPath) return
  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath)
    }
  } catch (unlinkError) {
    console.error(`Failed to clean temp file: ${targetPath}`, unlinkError.message)
  }
}

const normalizeDigits = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
}

const parseCsvNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback
  const normalized = normalizeDigits(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
  if (!normalized) return fallback
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseCsvBoolean = (value) => {
  const normalized = normalizeDigits(value)
    .trim()
    .toLowerCase()

  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'on' ||
    normalized === 'بله'
  )
}

const parseCsvFile = (filePath) => new Promise((resolve, reject) => {
  const rows = []

  fs.createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header }) => (header || '').replace(/\uFEFF/g, '').trim(),
      mapValues: ({ value }) => (typeof value === 'string' ? value.trim() : value),
    }))
    .on('data', (row) => rows.push(row))
    .on('end', () => resolve(rows))
    .on('error', reject)
})

const handleCsvUpload = (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (!err) return next()

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'حجم فایل بالاتر از حد مجاز است',
        })
      }

      return res.status(400).json({
        success: false,
        message: `خطا در آپلود فایل: ${err.message}`,
      })
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'خطا در آپلود فایل CSV',
    })
  })
}

// ============================================
// Helpers
// ============================================

// Normalize Cloudinary file object to { url, public_id }
const extractImageInfo = (file) => {
  if (!file) return null
  return {
    url: file.path,
    public_id: file.filename,
  }
}

// Recursively collect all descendant category IDs using $graphLookup (Optimized)
const getAllDescendantCategoryIds = async (parentId) => {
  try {
    const mongoose = require('mongoose')
    const result = await Category.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(parentId) } },
      {
        $graphLookup: {
          from: 'categories', // Collection name (mongoose default: lowercase plural)
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          as: 'descendants',
          maxDepth: 10,
        },
      },
      {
        $project: {
          descendantIds: '$descendants._id',
        },
      },
    ])

    if (!result || result.length === 0) return []
    return result[0].descendantIds || []
  } catch (error) {
    console.error('Error fetching descendant categories:', error)
    return []
  }
}

// Helper to build base filter object from query (without text search)
const buildProductFilter = (query) => {
  const filter = {}

  // By default, only active products unless includeInactive=true
  if (!query.includeInactive) {
    filter.isActive = true
  }

  // Handle simple boolean parameters (without operators)
  // e.g., isFlashDeal=true, isSpecialOffer=true
  if (query.isFlashDeal !== undefined) {
    filter.isFlashDeal = query.isFlashDeal === 'true' || query.isFlashDeal === true
  }
  if (query.isSpecialOffer !== undefined) {
    filter.isSpecialOffer = query.isSpecialOffer === 'true' || query.isSpecialOffer === true
  }

  // ===== PRICE RANGE FILTER =====
  // Handle minPrice and maxPrice parameters
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {}
    if (query.minPrice !== undefined) {
      const minPrice = Number(query.minPrice)
      // Allow 0 as a valid minPrice (means no minimum filter)
      // Only add filter if minPrice > 0
      if (!isNaN(minPrice) && minPrice > 0) {
        filter.price.$gte = minPrice
      }
    }
    if (query.maxPrice !== undefined) {
      const maxPrice = Number(query.maxPrice)
      // Always apply maxPrice filter if it's a valid number > 0
      if (!isNaN(maxPrice) && maxPrice > 0) {
        filter.price.$lte = maxPrice
      }
    }
    // Clean up empty price filter
    if (Object.keys(filter.price).length === 0) {
      delete filter.price
    }
  }

  // Advanced filters like isActive[eq]=true, flashDealEndTime[gt]=2025-11-24T...
  Object.keys(query).forEach((key) => {
    const match = key.match(/^(.+)\[(.+)\]$/)
    if (!match) return

    const field = match[1]
    const op = match[2]
    const value = query[key]

    if (field === 'isActive') {
      const boolVal = value === 'true' || value === true
      if (op === 'eq') filter.isActive = boolVal
      return
    }

    // Handle date fields (flashDealEndTime, specialOfferEndTime, etc.)
    if (field.toLowerCase().includes('time') || field.toLowerCase().includes('date')) {
      const dateValue = new Date(value)
      if (!isNaN(dateValue.getTime())) {
        if (op === 'eq') {
          filter[field] = dateValue
        } else if (op === 'lt') {
          filter[field] = { $lt: dateValue }
        } else if (op === 'gt') {
          filter[field] = { $gt: dateValue }
        } else if (op === 'gte') {
          filter[field] = { $gte: dateValue }
        } else if (op === 'lte') {
          filter[field] = { $lte: dateValue }
        }
        return
      }
    }

    // Handle numeric fields
    if (op === 'eq') {
      filter[field] = value
    } else if (op === 'lt') {
      filter[field] = { $lt: Number(value) }
    } else if (op === 'gt') {
      filter[field] = { $gt: Number(value) }
    } else if (op === 'gte') {
      filter[field] = { $gte: Number(value) }
    } else if (op === 'lte') {
      filter[field] = { $lte: Number(value) }
    }
  })

  return filter
}

// Keep offer timers aligned with the current active master product
const syncOfferTimers = async (data, currentProduct = {}) => {
  const now = new Date()

  const effectiveSpecialOffer =
    data.isSpecialOffer !== undefined ? data.isSpecialOffer : currentProduct.isSpecialOffer
  if (effectiveSpecialOffer === true) {
    const activeMaster = await Product.findOne({
      isSpecialOffer: true,
      specialOfferEndTime: { $gt: now },
    }).select('specialOfferEndTime').lean()

    if (activeMaster && activeMaster.specialOfferEndTime) {
      console.log(`[SYNC SPECIAL] Enforcing master timer: ${activeMaster.specialOfferEndTime}`)
      data.specialOfferEndTime = activeMaster.specialOfferEndTime
    }
  } else if (data.isSpecialOffer !== undefined) {
    data.specialOfferEndTime = null
  }

  const effectiveFlashDeal =
    data.isFlashDeal !== undefined ? data.isFlashDeal : currentProduct.isFlashDeal
  if (effectiveFlashDeal === true) {
    const activeMaster = await Product.findOne({
      isFlashDeal: true,
      flashDealEndTime: { $gt: now },
    }).select('flashDealEndTime').lean()

    if (activeMaster && activeMaster.flashDealEndTime) {
      console.log(`[SYNC FLASH] Enforcing master timer: ${activeMaster.flashDealEndTime}`)
      data.flashDealEndTime = activeMaster.flashDealEndTime
    }
  } else if (data.isFlashDeal !== undefined) {
    data.flashDealEndTime = null
  }
}

// Validate that a product cannot be in both Flash Deal and Special Offer campaigns simultaneously
const validateCampaignExclusivity = (data, currentProduct = {}) => {
  const effectiveFlashDeal =
    data.isFlashDeal !== undefined ? data.isFlashDeal : currentProduct.isFlashDeal
  const effectiveSpecialOffer =
    data.isSpecialOffer !== undefined ? data.isSpecialOffer : currentProduct.isSpecialOffer

  if (effectiveFlashDeal === true && effectiveSpecialOffer === true) {
    return {
      valid: false,
      message: 'یک محصول نمی‌تواند همزمان در کمپین پیشنهاد لحظه‌ای و شگفت‌انگیز باشد. لطفاً فقط یکی را انتخاب کنید.',
    }
  }

  return { valid: true }
}

// ============================================
// GET /api/products
// Public products list with filters & pagination
// Query params:
// - skipDiscount=true: Returns raw product data without discount calculation (for admin panel)
// ============================================
router.get('/', cacheMiddleware(300), async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit
    const skipDiscount = req.query.skipDiscount === 'true';

    const sort = req.query.sort || '-createdAt'
    const fields = req.query.fields ? req.query.fields.split(',').join(' ') : undefined

    const baseFilter = buildProductFilter(req.query)
    const conditions = []

    // Debug: Log price filter
    if (req.query.minPrice || req.query.maxPrice) {
      console.log('[PRODUCTS] Price filter params:', { minPrice: req.query.minPrice, maxPrice: req.query.maxPrice })
      console.log('[PRODUCTS] Built price filter:', baseFilter.price)
    }

    if (Object.keys(baseFilter).length > 0) {
      conditions.push(baseFilter)
    }

    // productType filter (simple / variable)
    if (req.query.productType === 'variable') {
      conditions.push({
        productType: 'variable',
      })
    } else if (req.query.productType === 'simple') {
      // برای سازگاری عقب‌رو: محصولاتی که productType ندارند هم ساده محسوب می‌شوند
      conditions.push({
        $or: [
          { productType: { $exists: false } },
          { productType: null },
          { productType: '' },
          { productType: 'simple' },
        ],
      })
    }

    // Category filter with optional descendants
    if (req.query.category) {
      console.log('Processing category filter:', req.query.category)
      let categoryId = null

      const mongoose = require('mongoose')
      const isObjectId = mongoose.Types.ObjectId.isValid(req.query.category)

      // Resolve category by slug OR by id (but only if it exists)
      const categoryDoc = await Category.findOne(
        isObjectId
          ? { $or: [{ slug: req.query.category }, { _id: req.query.category }] }
          : { slug: req.query.category },
      ).select('_id')
      console.log('Category lookup result:', categoryDoc)

      if (categoryDoc) {
        categoryId = categoryDoc._id
      }

      if (categoryId) {
        if (req.query.includeChildren === 'true') {
          const ids = [categoryId]
          const descendants = await getAllDescendantCategoryIds(categoryId)
          ids.push(...descendants)
          conditions.push({ category: { $in: ids } })
        } else {
          conditions.push({ category: categoryId })
        }
      } else {
        // Category not found (neither slug nor ID), return empty result
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            itemsPerPage: limit,
            totalItems: 0,
            totalPages: 0,
          },
          priceRange: { min: 0, max: 0 }
        })
      }
    }

    // Brand filter (by slug or ID)
    if (req.query.brand) {
      console.log('Processing brand filter:', req.query.brand)
      let brandId = null

      // Try to find by slug first
      const brandDoc = await Brand.findOne({ slug: req.query.brand }).select('_id')
      console.log('Brand lookup result:', brandDoc)

      if (brandDoc) {
        brandId = brandDoc._id
      } else {
        // If not found by slug, check if it's a valid ObjectId
        const mongoose = require('mongoose')
        if (mongoose.Types.ObjectId.isValid(req.query.brand)) {
          brandId = req.query.brand
        }
      }

      if (brandId) {
        conditions.push({ brand: brandId })
      } else {
        // Brand not found (neither slug nor ID), return empty result
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            itemsPerPage: limit,
            totalItems: 0,
            totalPages: 0,
          },
          priceRange: { min: 0, max: 0 }
        })
      }
    }

    // Text search on name or SKU (and variant SKU)
    // Supports searchField param: 'name', 'sku', or 'all' (default)
    // Uses Persian/Arabic normalization to match both character variants
    if (req.query.search) {
      const normalizedPattern = buildPersianSearchRegex(req.query.search.trim())
      const regex = { $regex: normalizedPattern, $options: 'i' }
      const searchField = req.query.searchField || 'all'

      if (searchField === 'name') {
        conditions.push({ name: regex })
      } else if (searchField === 'sku') {
        conditions.push({
          $or: [{ sku: regex }, { 'variants.sku': regex }],
        })
      } else {
        // 'all' - search in both name and sku
        conditions.push({
          $or: [{ name: regex }, { sku: regex }, { 'variants.sku': regex }],
        })
      }
    }

    // Smart Filters (Properties)
    // Expecting query like: properties[Resolution]=4K&properties[Color]=Red
    if (req.query.properties) {
      const props = req.query.properties
      Object.keys(props).forEach((key) => {
        const value = props[key]
        if (value) {
          conditions.push({
            properties: {
              $elemMatch: { label: key, value: value },
            },
          })
        }
      })
    }

    const mongoFilter =
      conditions.length === 0
        ? {}
        : conditions.length === 1
          ? conditions[0]
          : { $and: conditions }

    // Handle sorting options
    // Convert frontend sort values to MongoDB sort format
    let finalSort = sort
    switch (sort) {
      case 'newest':
        finalSort = '-createdAt'
        break
      case 'oldest':
        finalSort = 'createdAt'
        break
      case 'priceAsc':
        finalSort = 'price'
        break
      case 'priceDesc':
        finalSort = '-price'
        break
      case 'popularity':
      case 'mostVisited':
        finalSort = '-views'
        break
      case 'bestSelling':
        finalSort = '-salesCount'
        break
      case 'discount':
        finalSort = '-discount'
        break
      case 'rating':
        finalSort = '-rating'
        break
      default:
        // If sort starts with - or is a valid field, use as-is
        // Otherwise default to newest
        if (!sort.startsWith('-') && !['price', 'createdAt', 'views', 'salesCount', 'rating', 'discount', 'name'].includes(sort)) {
          finalSort = '-createdAt'
        }
    }

    console.log('[PRODUCTS] Sort param:', sort, '-> MongoDB sort:', finalSort)

    // Use Aggregation to allow prioritizing exact matches
    const pipeline = []

    // 1. Match Filter
    if (Object.keys(mongoFilter).length > 0) {
      pipeline.push({ $match: mongoFilter })
    }

    // 2. Add Sort Priority
    // If searching, prioritize exact matches on SKU
    if (req.query.search) {
      const searchTerm = req.query.search.trim()
      pipeline.push({
        $addFields: {
          __sortPriority: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$sku', searchTerm] },
                  { $in: [searchTerm, { $ifNull: ['$variants.sku', []] }] },
                ],
              },
              then: 1, // Exact match gets high priority
              else: 0,
            },
          },
        },
      })
    }

    // 3. Sort
    const sortStage = {}

    // First sort by priority (descending)
    if (req.query.search) {
      sortStage.__sortPriority = -1
    }

    // Then apply user sort
    const sortParts = finalSort.split(' ')
    sortParts.forEach((part) => {
      if (part.startsWith('-')) {
        sortStage[part.substring(1)] = -1
      } else {
        sortStage[part] = 1
      }
    })

    pipeline.push({ $sort: sortStage })

    // 4. Projection
    if (fields) {
      const projectStage = {}
      fields.split(' ').forEach((f) => {
        if (f.startsWith('-')) {
          projectStage[f.substring(1)] = 0
        } else {
          projectStage[f] = 1
        }
      })
      if (Object.keys(projectStage).length > 0) {
        pipeline.push({ $project: projectStage })
      }
    } else {
      // Remove internal sort field
      if (req.query.search) {
        pipeline.push({ $project: { __sortPriority: 0 } })
      }
    }

    // 5. Pagination
    pipeline.push({ $skip: skip })
    pipeline.push({ $limit: limit })

    // Execute Aggregation
    const productQuery = Product.aggregate(pipeline)



    const now = new Date()

    // Calculate Price Stats (Min/Max) for the current filter
    // We want the range of the *category* (or other filters), NOT constrained by the price filter itself.
    // So we build a separate filter for stats that excludes 'price'.

    const baseFilterForStats = { ...baseFilter }
    delete baseFilterForStats.price

    const statsConditions = []
    if (Object.keys(baseFilterForStats).length > 0) {
      statsConditions.push(baseFilterForStats)
    }

    // Add other conditions (category, search, etc.) to statsConditions
    // We can reuse the logic that built 'conditions' but we need to be careful not to duplicate code too much.
    // A simpler way is to filter 'conditions' to remove price constraints.

    const statsFilterConditions = conditions.map(cond => {
      const newCond = { ...cond }
      delete newCond.price
      return newCond
    })

    const statsMongoFilter =
      statsFilterConditions.length === 0
        ? {}
        : statsFilterConditions.length === 1
          ? statsFilterConditions[0]
          : { $and: statsFilterConditions }

    const priceStatsPromise = Product.aggregate([
      { $match: statsMongoFilter },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
    ])

    const [items, total, activeSales, priceStats] = await Promise.all([
      productQuery,
      Product.countDocuments(mongoFilter),
      Sale.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .populate('categories', '_id')
        .select('name products categories discountPercentage badgeTheme endDate includeSubcategories')
        .lean(),
      priceStatsPromise,
    ])

    const minPrice = priceStats[0]?.minPrice || 0
    const maxPrice = priceStats[0]?.maxPrice || 0

    // Helper: Get all descendant category IDs for a given category
    const getCategoryWithDescendants = async (categoryId, includeSubcategories) => {
      if (!includeSubcategories) return [categoryId]
      const descendants = await getAllDescendantCategoryIds(categoryId)
      return [categoryId, ...descendants]
    }

    // Build campaign maps for both direct products and category-based products
    const campaignMap = new Map()
    const categoryDiscountMap = new Map() // Map: categoryId -> { name, discount, theme, endDate }

    // Process each active sale
    for (const sale of activeSales) {
      // 1. Handle direct product assignments
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

      // 2. Handle category-based assignments
      if (sale.categories && sale.categories.length > 0) {
        for (const cat of sale.categories) {
          const categoryId = cat._id || cat
          const categoryIds = await getCategoryWithDescendants(
            categoryId.toString(),
            sale.includeSubcategories !== false
          )

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

    // Apply discounts to products (skip if skipDiscount is true for admin panel)
    const itemsWithCampaign = skipDiscount ? items : items.map((item) => {
      const productId = item._id ? item._id.toString() : null
      const categoryId = item.category ? item.category.toString() : null

      // Priority 1: Direct product campaign
      let campaignInfo = productId ? campaignMap.get(productId) : undefined

      // Priority 2: Category-based campaign (if no direct campaign)
      if (!campaignInfo && categoryId) {
        campaignInfo = categoryDiscountMap.get(categoryId)
      }

      const newItem = { ...item }

      if (campaignInfo) {
        // Apply campaign discount
        newItem.campaignLabel = campaignInfo.name
        newItem.campaignTheme = campaignInfo.theme || 'green-orange'
        if (campaignInfo.discount > 0) {
          newItem.discount = campaignInfo.discount
          newItem.isSpecialOffer = true
          newItem.specialOfferEndTime = campaignInfo.endDate

          // Calculate final price
          const originalPrice = newItem.price
          const discountAmount = (originalPrice * campaignInfo.discount) / 100
          newItem.price = originalPrice - discountAmount
          newItem.compareAtPrice = originalPrice
        }
      } else if (newItem.discount > 0) {
        // Apply direct product discount (e.g. Flash Deal without Campaign)
        const originalPrice = newItem.price
        const discountAmount = (originalPrice * newItem.discount) / 100
        newItem.price = originalPrice - discountAmount
        newItem.compareAtPrice = originalPrice

        if (newItem.isFlashDeal) {
          newItem.campaignLabel = 'پیشنهاد لحظه‌ای'
          newItem.campaignTheme = 'gold-red'
        }
      }

      return newItem
    })

    res.json({
      success: true,
      data: itemsWithCampaign,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      priceRange: {
        min: minPrice,
        max: maxPrice,
      },
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message,
    })
  }
})

// ============================================
// PUT /api/products/special-offers/timer
// Update timer for all active special offer products
// ============================================
router.put(
  '/special-offers/timer',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { endTime, disable } = req.body

      if (disable) {
        // Clear timer for all special offer products
        const result = await Product.updateMany(
          { isSpecialOffer: true },
          { $unset: { specialOfferEndTime: "" } }
        )

        clearCacheByPrefix('/api/products')
        clearCacheByPrefix('/api/v1/admin/products')

        return res.json({
          success: true,
          message: `Timer disabled for ${result.modifiedCount} products`,
          data: { modifiedCount: result.modifiedCount }
        })
      }

      if (!endTime) {
        return res.status(400).json({
          success: false,
          message: 'End time is required',
        })
      }

      const parsedEndTime = new Date(endTime)
      if (Number.isNaN(parsedEndTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end time value',
        })
      }

      console.log('[ADMIN] Updating special offer timer to:', parsedEndTime.toISOString())

      // Update all products that have isSpecialOffer: true
      const result = await Product.updateMany(
        { isSpecialOffer: true },
        { $set: { specialOfferEndTime: parsedEndTime } }
      )

      console.log('[ADMIN] Update result:', result)

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: `Updated timer for ${result.modifiedCount} products`,
        data: { modifiedCount: result.modifiedCount }
      })
    } catch (error) {
      console.error('Error updating special offer timer:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update timer',
        error: error.message,
      })
    }
  }
)

// ============================================
// PUT /api/products/flash-deals/timer
// Update timer for all active flash deal products
// ============================================
router.put(
  '/flash-deals/timer',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { endTime, disable } = req.body

      if (disable) {
        const result = await Product.updateMany(
          { isFlashDeal: true },
          { $unset: { flashDealEndTime: "" } }
        )

        clearCacheByPrefix('/api/products')
        clearCacheByPrefix('/api/v1/admin/products')

        return res.json({
          success: true,
          message: `Timer disabled for ${result.modifiedCount} products`,
          data: { modifiedCount: result.modifiedCount }
        })
      }

      if (!endTime) {
        return res.status(400).json({
          success: false,
          message: 'End time is required',
        })
      }

      const parsedEndTime = new Date(endTime)
      if (Number.isNaN(parsedEndTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end time value',
        })
      }

      console.log('[ADMIN] Updating flash deal timer to:', parsedEndTime.toISOString())

      const result = await Product.updateMany(
        { isFlashDeal: true },
        { $set: { flashDealEndTime: parsedEndTime } }
      )

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: `Updated timer for ${result.modifiedCount} products`,
        data: { modifiedCount: result.modifiedCount }
      })
    } catch (error) {
      console.error('Error updating flash deal timer:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update timer',
        error: error.message,
      })
    }
  }
)

// ============================================
// Helper: Build full category path from leaf to root
// Returns array of categories ordered from root to leaf
// ============================================
const buildCategoryPath = async (categoryId) => {
  if (!categoryId) return [];

  const path = [];
  let currentId = categoryId;
  const maxDepth = 10; // Prevent infinite loops
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const cat = await Category.findById(currentId).select('_id name slug parent').lean();
    if (!cat) break;

    path.unshift({
      _id: cat._id,
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug || cat._id.toString(),
    });

    currentId = cat.parent;
    depth++;
  }

  return path;
};

// ============================================
// GET /api/products/all-ids - Get all product IDs (for bulk select)
// Supports same filters as product list (search, category, status)
// MUST be defined BEFORE /:id route to avoid being caught by it
// ============================================
router.get(
  '/all-ids',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const filter = {}

      // Search filter (with Persian/Arabic normalization)
      if (req.query.search) {
        const normalizedPattern = buildPersianSearchRegex(req.query.search.trim())
        const regex = new RegExp(normalizedPattern, 'i')
        filter.$or = [{ name: regex }, { sku: regex }]
      }

      // Category filter
      if (req.query.category) {
        const mongoose = require('mongoose')
        if (mongoose.Types.ObjectId.isValid(req.query.category)) {
          if (req.query.includeChildren === 'true') {
            const descendantIds = await getAllDescendantCategoryIds(req.query.category)
            filter.category = { $in: descendantIds }
          } else {
            filter.category = req.query.category
          }
        }
      }

      // Status filter
      if (req.query['isActive[eq]'] === 'true') {
        filter.isActive = true
      } else if (req.query['isActive[eq]'] === 'false') {
        filter.isActive = false
      }

      // Product type filter
      if (req.query.productType) {
        filter.productType = req.query.productType
      }

      const products = await Product.find(filter).select('_id').lean()
      const ids = products.map(p => p._id)

      res.json({
        success: true,
        ids,
        total: ids.length,
      })
    } catch (error) {
      console.error('Error fetching all product IDs:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در دریافت شناسه محصولات',
        error: error.message,
      })
    }
  },
)

// ============================================
// GET /api/products/:id
// Query params:
// - skipDiscount=true: Returns raw product data without discount calculation (for admin editing)
// ============================================
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    let product;
    const mongoose = require('mongoose');
    const { id } = req.params;
    const skipDiscount = req.query.skipDiscount === 'true';

    // 1. Try finding by ID if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id)
        .populate('brand', 'name logo slug')
        .populate({
          path: 'category',
          select: 'name slug parent',
        });
    }

    // 2. If not found by ID, try finding by slug
    if (!product) {
      product = await Product.findOne({ slug: id })
        .populate('brand', 'name logo slug')
        .populate({
          path: 'category',
          select: 'name slug parent',
        });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    const productObj = product.toObject()

    // Build full category path from root to leaf
    if (product.category && product.category._id) {
      productObj.categoryPath = await buildCategoryPath(product.category._id);
    }

    // If skipDiscount is true, return raw product data without discount calculation
    // This is used for admin editing to preserve original prices
    if (skipDiscount) {
      return res.json({
        success: true,
        data: productObj,
      })
    }

    const now = new Date()

    // Check for direct product campaign
    let activeSale = await Sale.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      products: product._id,
    })
      .select('name discountPercentage badgeTheme endDate')
      .lean()

    // If no direct campaign, check category-based campaign
    if (!activeSale && product.category) {
      const categoryId = typeof product.category === 'object' ? product.category._id : product.category

      // Support includeSubcategories sales by checking the full category path (ancestors)
      const categoryPathIds = Array.isArray(productObj.categoryPath) && productObj.categoryPath.length > 0
        ? productObj.categoryPath.map((c) => c._id).filter(Boolean)
        : [categoryId].filter(Boolean)

      const categorySales = await Sale.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        categories: { $in: categoryPathIds },
      })
        .select('name discountPercentage badgeTheme endDate includeSubcategories categories')
        .lean()

      const leafCategoryId = categoryId ? categoryId.toString() : null
      const ancestorIds = categoryPathIds.map((c) => c.toString())

      const matchedSale = categorySales.find((sale) => {
        const includeSubs = sale.includeSubcategories !== false
        const saleCategoryIds = Array.isArray(sale.categories) ? sale.categories.map((c) => c.toString()) : []

        // Always apply when the product is directly in the sale category
        if (leafCategoryId && saleCategoryIds.includes(leafCategoryId)) return true

        // Apply to descendants when includeSubcategories is enabled (sale category is an ancestor)
        return includeSubs && saleCategoryIds.some((cid) => ancestorIds.includes(cid))
      })

      if (matchedSale) {
        activeSale = matchedSale
      }
    }

    if (activeSale) {
      productObj.campaignLabel = activeSale.name
      productObj.campaignTheme = activeSale.badgeTheme || 'green-orange'
      if (activeSale.discountPercentage > 0) {
        productObj.discount = activeSale.discountPercentage
        productObj.isSpecialOffer = true
        productObj.isFromActiveSale = true
        productObj.specialOfferEndTime = activeSale.endDate

        // Calculate final price
        const originalPrice = productObj.price
        const discountAmount = (originalPrice * activeSale.discountPercentage) / 100
        productObj.price = originalPrice - discountAmount
        productObj.compareAtPrice = originalPrice
      }
    } else if (productObj.discount > 0) {
      // Apply direct product discount
      const originalPrice = productObj.price
      const discountAmount = (originalPrice * productObj.discount) / 100
      productObj.price = originalPrice - discountAmount
      productObj.compareAtPrice = originalPrice

      if (productObj.isFlashDeal) {
        productObj.campaignLabel = 'پیشنهاد لحظه‌ای'
        productObj.campaignTheme = 'gold-red'
      }
    }

    res.json({
      success: true,
      data: productObj,
    })
  } catch (error) {
    console.error('Error fetching product by id:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message,
    })
  }
})

// ============================================
// POST /api/products  (JSON create)
// Supports both simple and variable products
// ============================================
router.post(
  '/',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_CREATE),
  async (req, res) => {
    try {
      const {
        name,
        price,
        stock,
        category,
        brand,
        description,
        sku,
        productType,
        attributes,
        variants,
        isSpecialOffer,
        specialOfferEndTime,
        isFlashDeal,
        flashDealEndTime,
        discount,
        images,
        isFeatured,
        isActive,
        properties,
        specifications,
      } = req.body

      const productData = {
        name,
        description: description || '',
        sku: sku || undefined,
        productType: productType || 'simple',
        isSpecialOffer: isSpecialOffer || false,
        specialOfferEndTime,
        isFlashDeal: isFlashDeal || false,
        flashDealEndTime,
        discount: discount || 0,
        images: images || [],
        isFeatured: isFeatured || false,
        isActive: isActive !== undefined ? isActive : true,
        properties: properties || [],
        specifications: specifications || {},
      }

      // Validate and assign Category
      const mongoose = require('mongoose')
      if (category && mongoose.Types.ObjectId.isValid(category)) {
        productData.category = category
      } else {
        productData.category = null
      }

      // Validate and assign Brand
      if (brand && mongoose.Types.ObjectId.isValid(brand)) {
        productData.brand = brand
      } else {
        productData.brand = null
      }

      // فیلدهای قیمت و موجودی برای محصول ساده
      if (productType === 'simple' || !productType) {
        if (price !== undefined) productData.price = price
        if (stock !== undefined) productData.stock = stock
      }

      // ویژگی‌ها و متغیرها برای محصول متغیر
      if (productType === 'variable') {
        productData.attributes = attributes || []
        productData.variants = variants || []
      }

      // Validate campaign exclusivity (cannot be both Flash Deal and Special Offer)
      const exclusivityCheck = validateCampaignExclusivity(productData)
      if (!exclusivityCheck.valid) {
        return res.status(400).json({
          success: false,
          message: exclusivityCheck.message,
        })
      }

      // Apply Timer Synchronization
      await syncOfferTimers(productData)

      const product = await Product.create(productData)

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      })
    } catch (error) {
      console.error('Error creating product:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message,
      })
    }
  },
)

// ============================================
// PUT /api/products/:id  (update basic fields)
// Supports optional removeAllImages flag
// Supports both simple and variable products
// ============================================
router.put(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const body = req.body || {}
      const { removeAllImages, imagesToRemove, ...updates } = body

      // Allow clients to send arrays either as JSON arrays or JSON strings (FormData)
      const normalizeImageList = (value) => {
        if (value === undefined || value === null || value === '') return undefined
        if (Array.isArray(value)) return value
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (!trimmed) return undefined
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return parsed
          } catch (_) {
            // ignore JSON parse errors, fall back to single string
          }
          return [trimmed]
        }
        if (typeof value === 'object') return [value]
        return undefined
      }

      const getImageUrl = (img) => {
        if (!img) return undefined
        if (typeof img === 'string') return img
        if (typeof img === 'object' && typeof img.url === 'string') return img.url
        return undefined
      }

      const getImagePublicId = (img) => {
        if (!img || typeof img !== 'object') return undefined
        return typeof img.public_id === 'string' ? img.public_id : undefined
      }

      const imagesMatch = (a, b) => {
        const aId = getImagePublicId(a)
        const bId = getImagePublicId(b)
        if (aId && bId) return aId === bId

        const aUrl = getImageUrl(a)
        const bUrl = getImageUrl(b)
        if (aUrl && bUrl) return aUrl === bUrl

        return false
      }

      // Normalize `images` in updates (or drop it if it's an invalid type)
      const incomingImages = normalizeImageList(updates.images)
      if (incomingImages !== undefined) {
        updates.images = incomingImages
      } else if (updates.images !== undefined) {
        delete updates.images
      }

      const product = await Product.findById(req.params.id)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        })
      }

      // Remove all images (and from Cloudinary) if requested
      if (removeAllImages) {
        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            if (img && typeof img === 'object' && img.public_id) {
              try {
                await cloudinary.uploader.destroy(img.public_id)
              } catch (err) {
                console.error(
                  'Error deleting product image from Cloudinary during update:',
                  err.message,
                )
              }
            }
          }
        }
        // If client also sent a new images list, treat it as replacement after deletion
        updates.images = Array.isArray(updates.images) ? updates.images : []
      } else {
        const toRemove = normalizeImageList(imagesToRemove) || []
        if (Array.isArray(toRemove) && toRemove.length > 0) {
          console.log('[DEBUG] imagesToRemove:', JSON.stringify(toRemove, null, 2))
          console.log('[DEBUG] product.images (before):', JSON.stringify(product.images, null, 2))

          const remainingImages = []

          if (Array.isArray(product.images)) {
            for (const img of product.images) {
              const existingUrl = getImageUrl(img)
              const existingPublicId = getImagePublicId(img)

              const shouldRemove = toRemove.some((r) => imagesMatch(img, r))

              console.log(`[DEBUG] Comparing:
                Existing - ID: ${existingPublicId}, URL: ${existingUrl}
                Remove candidates: ${toRemove.length}
                Should remove: ${shouldRemove}`)

              if (shouldRemove) {
                if (existingPublicId) {
                  try {
                    console.log('[DEBUG] Deleting from Cloudinary:', existingPublicId)
                    await cloudinary.uploader.destroy(existingPublicId)
                  } catch (err) {
                    console.error(
                      'Error deleting product image from Cloudinary during partial update:',
                      err.message,
                    )
                  }
                }
              } else {
                remainingImages.push(img)
              }
            }
          }

          console.log('[DEBUG] remainingImages:', JSON.stringify(remainingImages, null, 2))

          // If the client sent a final images list (e.g., existing + newly uploaded),
          // don't drop new images just because imagesToRemove is present.
          if (Array.isArray(updates.images)) {
            updates.images = updates.images.filter((img) => !toRemove.some((r) => imagesMatch(img, r)))
          } else {
            updates.images = remainingImages
          }
        }
      }

      // Clean up invalid ObjectId references before updating
      // If brand or category is not a valid ObjectId, remove it from updates
      if (updates.brand !== undefined) {
        const mongoose = require('mongoose')
        if (updates.brand === null || updates.brand === '') {
          updates.brand = null
        } else if (typeof updates.brand === 'string' && !mongoose.Types.ObjectId.isValid(updates.brand)) {
          delete updates.brand
        }
      }

      if (updates.category !== undefined) {
        const mongoose = require('mongoose')
        if (updates.category === null || updates.category === '') {
          updates.category = null
        } else if (typeof updates.category === 'string' && !mongoose.Types.ObjectId.isValid(updates.category)) {
          delete updates.category
        }
      }

      // Validate campaign exclusivity (cannot be both Flash Deal and Special Offer)
      const exclusivityCheck = validateCampaignExclusivity(updates, product)
      if (!exclusivityCheck.valid) {
        return res.status(400).json({
          success: false,
          message: exclusivityCheck.message,
        })
      }

      // Apply Timer Synchronization
      await syncOfferTimers(updates, product);

      // Use findByIdAndUpdate for simple updates to avoid full validation
      console.log(`[UPDATE PRODUCT] ID: ${req.params.id}`)
      console.log(`[UPDATE PRODUCT] SKU in updates:`, updates.sku)
      console.log(`[UPDATE PRODUCT] Category in updates:`, updates.category)
      console.log(`[UPDATE PRODUCT] Brand in updates:`, updates.brand)

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: false }
      )

      console.log(`[UPDATE PRODUCT] Result category:`, updatedProduct.category)
      console.log(`[UPDATE PRODUCT] Result brand:`, updatedProduct.brand)

      // Invalidate ALL product-related caches
      // This clears: /api/products, /api/products?..., /api/products/:id, /api/products/:slug
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct,
      })
    } catch (error) {
      console.error('Error updating product:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/:id/images  (upload images)
// ============================================
router.post(
  '/:id/images',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  upload.array('images', 10),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        })
      }

      const newImages = (req.files || [])
        .map((file) => extractImageInfo(file))
        .filter(Boolean)

      product.images = [...(product.images || []), ...newImages]
      await product.save()

      clearCacheByKey(`/api/products/${req.params.id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'Images uploaded successfully',
        data: product,
      })
    } catch (error) {
      console.error('Error uploading product images:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to upload images',
        error: error.message,
      })
    }
  },
)

// ============================================
// DELETE /api/products/:id/images/:publicId
// حذف یک عکس خاص از محصول
// ============================================
router.delete(
  '/:id/images/:publicId',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  async (req, res) => {
    try {
      const { id } = req.params
      // Decode publicId چون از فرانت‌اند URL encoded می‌آید
      const publicId = decodeURIComponent(req.params.publicId)

      console.log(`[DELETE IMAGE] Product ID: ${id}, Public ID: ${publicId}`)

      // پیدا کردن محصول
      const product = await Product.findById(id)
      if (!product) {
        console.error(`[DELETE IMAGE] Product not found: ${id}`)
        return res.status(404).json({
          success: false,
          message: 'محصول یافت نشد',
        })
      }

      // پیدا کردن عکس با public_id
      const imageToDelete = product.images?.find(
        (img) => img.public_id === publicId
      )

      if (!imageToDelete) {
        console.error(`[DELETE IMAGE] Image not found in product. Public ID: ${publicId}`)
        console.error(`[DELETE IMAGE] Available images:`, product.images?.map(img => img.public_id))
        return res.status(404).json({
          success: false,
          message: 'تصویر در محصول یافت نشد',
        })
      }

      console.log(`[DELETE IMAGE] Found image:`, imageToDelete)

      // حذف از Cloudinary
      try {
        const cloudinaryResult = await cloudinary.uploader.destroy(publicId)
        console.log(`[DELETE IMAGE] Cloudinary result:`, cloudinaryResult)

        if (cloudinaryResult.result !== 'ok' && cloudinaryResult.result !== 'not found') {
          console.warn(`[DELETE IMAGE] Cloudinary deletion warning: ${cloudinaryResult.result}`)
        }
      } catch (cloudinaryError) {
        console.error(`[DELETE IMAGE] Cloudinary error:`, cloudinaryError)
        // ادامه می‌دهیم حتی اگر حذف از Cloudinary ناموفق باشد
        // چون ممکن است عکس قبلاً از Cloudinary حذف شده باشد
      }

      // حذف از آرایه images محصول
      product.images = product.images.filter(
        (img) => img.public_id !== publicId
      )

      // ذخیره محصول
      await product.save()

      console.log(`[DELETE IMAGE] Image deleted successfully. Remaining images: ${product.images.length}`)

      // پاک کردن کش
      clearCacheByKey(`/api/products/${id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'تصویر با موفقیت حذف شد',
        data: {
          product,
          deletedImage: imageToDelete,
        },
      })
    } catch (error) {
      console.error('[DELETE IMAGE] Error:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در حذف تصویر',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/bulk-status - Bulk activate/deactivate products
// Accepts { ids: ['id1', 'id2', ...], isActive: true/false } in request body
// ============================================
router.post(
  '/bulk-status',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { ids, isActive } = req.body

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لیست شناسه محصولات ارسال نشده است',
        })
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'وضعیت فعال/غیرفعال مشخص نشده است',
        })
      }

      const result = await Product.updateMany(
        { _id: { $in: ids } },
        { $set: { isActive } },
      )

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      const statusText = isActive ? 'فعال' : 'غیرفعال'
      res.json({
        success: true,
        message: `${result.modifiedCount} محصول با موفقیت ${statusText} شد`,
        modifiedCount: result.modifiedCount,
      })
    } catch (error) {
      console.error('Error bulk updating status:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در تغییر وضعیت محصولات',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/bulk-delete - Bulk delete products
// Accepts { ids: ['id1', 'id2', ...] } in request body
// ============================================
router.post(
  '/bulk-delete',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { ids } = req.body

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لیست شناسه محصولات ارسال نشده است',
        })
      }

      // Find all products to delete (for Cloudinary cleanup)
      const products = await Product.find({ _id: { $in: ids } }).select('images')

      // Delete Cloudinary images for all products
      const cloudinaryErrors = []
      for (const product of products) {
        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            if (img && typeof img === 'object' && img.public_id) {
              try {
                await cloudinary.uploader.destroy(img.public_id)
              } catch (err) {
                cloudinaryErrors.push(err.message)
                console.error('Error deleting product image from Cloudinary:', err.message)
              }
            }
          }
        }
      }

      // Bulk delete from database
      const result = await Product.deleteMany({ _id: { $in: ids } })

      // Clear caches
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: `تعداد ${result.deletedCount} محصول با موفقیت حذف شد`,
        deletedCount: result.deletedCount,
        requestedCount: ids.length,
      })
    } catch (error) {
      console.error('Error bulk deleting products:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در حذف گروهی محصولات',
        error: error.message,
      })
    }
  },
)

// ============================================
// DELETE /api/products/:id
// ============================================
router.delete(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        })
      }

      // Delete any Cloudinary images associated with this product
      if (Array.isArray(product.images)) {
        for (const img of product.images) {
          if (img && typeof img === 'object' && img.public_id) {
            try {
              await cloudinary.uploader.destroy(img.public_id)
            } catch (err) {
              console.error('Error deleting product image from Cloudinary:', err.message)
            }
          }
        }
      }

      await product.deleteOne()

      clearCacheByKey(`/api/products/${req.params.id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'Product deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting product:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message,
      })
    }
  },
)

// ============================================
// PUT /api/products/:id/stock - Quick stock update
// Only for simple products
// ============================================
router.put(
  '/:id/stock',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_STOCK),
  async (req, res) => {
    try {
      const { stock } = req.body

      if (stock === undefined || stock === null || stock === '') {
        return res.status(400).json({
          success: false,
          message: 'مقدار موجودی معتبر نیست',
        })
      }

      const numericStock = Number(stock)
      if (!Number.isFinite(numericStock)) {
        return res.status(400).json({
          success: false,
          message: 'مقدار موجودی معتبر نیست',
        })
      }

      if (numericStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'موجودی نمی‌تواند منفی باشد',
        })
      }

      const product = await Product.findById(req.params.id)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'محصول یافت نشد',
        })
      }

      // Only simple products support direct stock field
      if (product.productType === 'variable') {
        return res.status(400).json({
          success: false,
          message:
            'مدیریت موجودی برای محصولات متغیر باید از طریق متغیرها انجام شود، نه فیلد stock اصلی محصول.',
        })
      }

      // Update stock only, without triggering validation on other fields
      const updated = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: { stock: numericStock } },
        { new: true, runValidators: false },
      )

      clearCacheByKey(`/api/products/${req.params.id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'موجودی محصول با موفقیت به‌روزرسانی شد',
        data: updated,
      })
    } catch (error) {
      console.error('Error updating stock:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در به‌روزرسانی موجودی',
        error: error.message,
      })
    }
  },
)

// ============================================
// GET /api/products/export/excel - Export products to Excel
// ============================================
router.get(
  '/export/excel',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_EXPORT),
  async (req, res) => {
    try {
      // Fetch all products with valid category references (for Excel export)
      const products = await Product.find({
        $or: [
          { category: { $type: 'objectId' } },
          { category: { $exists: false } },
          { category: null },
        ],
      })
        .select(
          'name sku productType price compareAtPrice stock category brand rating numReviews isFeatured isActive',
        )
        .populate('category', 'name')
        .populate('brand', 'name')
        .lean()

      // Create a new workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('محصولات')

      // Define columns
      worksheet.columns = [
        { header: 'نام محصول', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'نوع محصول', key: 'productType', width: 15 },
        { header: 'قیمت', key: 'price', width: 15 },
        { header: 'قیمت مقایسه', key: 'compareAtPrice', width: 15 },
        { header: 'موجودی', key: 'stock', width: 10 },
        { header: 'دسته‌بندی', key: 'category', width: 20 },
        { header: 'برند', key: 'brand', width: 20 },
        { header: 'امتیاز', key: 'rating', width: 10 },
        { header: 'تعداد نظرات', key: 'numReviews', width: 12 },
        { header: 'ویژه', key: 'isFeatured', width: 10 },
        { header: 'فعال', key: 'isActive', width: 10 },
      ]

      // Add rows
      products.forEach((product) => {
        worksheet.addRow({
          name: product.name || '',
          sku: product.sku || '',
          productType: product.productType || 'simple',
          price: product.price || 0,
          compareAtPrice: product.compareAtPrice || '',
          stock: product.stock || 0,
          category: product.category?.name || '',
          brand: product.brand?.name || '',
          rating: product.rating || 0,
          numReviews: product.numReviews || 0,
          isFeatured: product.isFeatured ? 'بله' : 'خیر',
          isActive: product.isActive ? 'بله' : 'خیر',
        })
      })

      // Style header row
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }

      // Set response headers for file download
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx')

      // Generate buffer and send as response
      const buffer = await workbook.xlsx.writeBuffer()
      res.send(buffer)
    } catch (error) {
      console.error('Error exporting products to Excel:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در برون‌ریزی محصولات به Excel',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/import/csv - Import products from CSV
// ============================================
router.post(
  '/import/csv',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_IMPORT),
  handleCsvUpload,
  async (req, res) => {
    req.setTimeout(CSV_IMPORT_TIMEOUT_MS)
    res.setTimeout(CSV_IMPORT_TIMEOUT_MS)

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'CSV file was not uploaded',
        })
      }

      const filePath = req.file.path
      const startedAt = Date.now()
      const products = await parseCsvFile(filePath)
      const errors = []

      if (!products.length) {
        safeUnlink(filePath)
        return res.status(400).json({
          success: false,
          message: 'CSV file is empty or has no valid rows',
        })
      }

      const productsToCreate = []

      // 1. Collect all unique category and brand names
      const categoryNames = new Set()
      const brandNames = new Set()

      products.forEach((row) => {
        if (row.category) categoryNames.add(String(row.category).trim())
        if (row.brand) brandNames.add(String(row.brand).trim())
      })

      // 2. Bulk fetch categories and brands
      const categories = await Category.find({
        name: { $in: Array.from(categoryNames) },
      }).select('_id name').lean()

      const brands = await Brand.find({
        name: { $in: Array.from(brandNames) },
      }).select('_id name').lean()

      // 3. Create lookup maps (Name -> ID)
      const categoryMap = new Map(categories.map((c) => [c.name, c._id]))
      const brandMap = new Map(brands.map((b) => [b.name, b._id]))

      // 4. Build documents
      for (let i = 0; i < products.length; i++) {
        const row = products[i]

        try {
          // Find category by name from map
          let categoryId = null
          if (row.category) {
            categoryId = categoryMap.get(String(row.category).trim())
          }

          // Find brand by name from map
          let brandId = null
          if (row.brand) {
            brandId = brandMap.get(String(row.brand).trim())
          }

          const productData = {
            name: row.name || `Product ${i + 1}`,
            sku: row.sku || '',
            productType: row.productType || 'simple',
            price: parseCsvNumber(row.price, 0),
            compareAtPrice: row.compareAtPrice ? parseCsvNumber(row.compareAtPrice, undefined) : undefined,
            stock: Math.max(0, Math.floor(parseCsvNumber(row.stock, 0))),
            category: categoryId,
            brand: brandId,
            description: row.description || '',
            isActive: parseCsvBoolean(row.isActive),
            isFeatured: parseCsvBoolean(row.isFeatured),
          }

          // Manual Slug Generation
          if (productData.name) {
            const base = productData.name.toString().trim().toLowerCase()
            let slug = base
              .replace(/\s+/g, '-')
              .replace(/[^\p{L}\p{N}\-]+/gu, '')
              .replace(/\-+/g, '-')
              .replace(/^-+/, '')
              .replace(/-+$/, '')

            if (!slug) slug = new mongoose.Types.ObjectId().toString()

            const uniqueSuffix = Math.floor(Math.random() * 1000).toString()
            productData.slug = `${slug}-${uniqueSuffix}-${Date.now()}`
          }

          // Manual ProductCode Generation
          if (productData.sku) {
            const skuDigits = normalizeDigits(productData.sku).replace(/\D/g, '')
            if (skuDigits.length > 0) {
              productData.productCode = `KY-${skuDigits.slice(-7).padStart(7, '0')}`
            }
          }

          if (!productData.productCode) {
            const uniqueNum = (Date.now() % 10000000) + i
            const code = (uniqueNum % 10000000).toString().padStart(7, '0')
            productData.productCode = `KY-${code}`
          }

          productsToCreate.push(productData)
        } catch (rowError) {
          errors.push(`Row ${i + 1} processing error: ${rowError.message}`)
        }
      }

      // Insert products in batches
      let totalImported = 0

      for (let i = 0; i < productsToCreate.length; i += CSV_IMPORT_BATCH_SIZE) {
        const chunk = productsToCreate.slice(i, i + CSV_IMPORT_BATCH_SIZE)
        try {
          const result = await Product.insertMany(chunk, { ordered: false })
          totalImported += result.length
        } catch (batchError) {
          console.error(`Error importing batch ${i / CSV_IMPORT_BATCH_SIZE + 1}:`, batchError.message)
          if (batchError.insertedDocs) {
            totalImported += batchError.insertedDocs.length
          }
          errors.push(`Batch ${Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1} save error: ${batchError.message}`)
        }
      }

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      safeUnlink(filePath)

      const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
      const message = `${totalImported} products imported successfully`

      return res.json({
        success: true,
        message,
        imported: totalImported,
        durationSeconds,
        errors: errors.length > 0 ? errors : undefined,
      })
    } catch (error) {
      console.error('Error importing products from CSV:', error)
      safeUnlink(req.file?.path)
      return res.status(500).json({
        success: false,
        message: 'Error importing products from CSV',
        error: error.message,
      })
    }
  },
)

// ============================================
// GET /api/products/code/:code
// Get product by productCode (e.g., "KY-1234567")
// Public route - used for SEO-friendly URLs
// ============================================
router.get('/code/:code', cacheMiddleware(300), async (req, res) => {
  try {
    const { code } = req.params
    const normalizedCode = code.toUpperCase()
    const skipDiscount = req.query.skipDiscount === 'true'

    const product = await Product.findOne({ productCode: normalizedCode })
      .populate('category', '_id name slug parent')
      .populate('brand', '_id name slug')
      .lean()

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'محصول یافت نشد',
      })
    }

    const productObj = { ...product }

    // Build full category path from root to leaf
    if (productObj.category && productObj.category._id) {
      productObj.categoryPath = await buildCategoryPath(productObj.category._id)
    }

    // If skipDiscount is true, return raw product data without discount calculation
    // This is used for admin editing to preserve original prices
    if (!skipDiscount) {
      const now = new Date()

      // Check for direct product campaign
      let activeSale = await Sale.findOne({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        products: productObj._id,
      })
        .select('name discountPercentage badgeTheme endDate')
        .lean()

      // If no direct campaign, check category-based campaign (supports includeSubcategories)
      if (!activeSale && productObj.categoryPath && productObj.categoryPath.length > 0) {
        const leafCategoryId = productObj.categoryPath[productObj.categoryPath.length - 1]._id
        const categoryPathIds = productObj.categoryPath.map((c) => c._id).filter(Boolean)

        const categorySales = await Sale.find({
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
          categories: { $in: categoryPathIds },
        })
          .select('name discountPercentage badgeTheme endDate includeSubcategories categories')
          .lean()

        const leafCategoryIdStr = leafCategoryId ? leafCategoryId.toString() : null
        const ancestorIds = categoryPathIds.map((c) => c.toString())

        const matchedSale = categorySales.find((sale) => {
          const includeSubs = sale.includeSubcategories !== false
          const saleCategoryIds = Array.isArray(sale.categories) ? sale.categories.map((c) => c.toString()) : []

          // Always apply when the product is directly in the sale category
          if (leafCategoryIdStr && saleCategoryIds.includes(leafCategoryIdStr)) return true

          // Apply to descendants when includeSubcategories is enabled (sale category is an ancestor)
          return includeSubs && saleCategoryIds.some((cid) => ancestorIds.includes(cid))
        })

        if (matchedSale) {
          activeSale = matchedSale
        }
      }

      if (activeSale) {
        productObj.campaignLabel = activeSale.name
        productObj.campaignTheme = activeSale.badgeTheme || 'green-orange'
        if (activeSale.discountPercentage > 0) {
          productObj.discount = activeSale.discountPercentage
          productObj.isSpecialOffer = true
          productObj.isFromActiveSale = true
          productObj.specialOfferEndTime = activeSale.endDate

          // Calculate final price
          const originalPrice = productObj.price
          const discountAmount = (originalPrice * activeSale.discountPercentage) / 100
          productObj.price = originalPrice - discountAmount
          productObj.compareAtPrice = originalPrice
        }
      } else if (productObj.discount > 0) {
        // Apply direct product discount
        const originalPrice = productObj.price
        const discountAmount = (originalPrice * productObj.discount) / 100
        productObj.price = originalPrice - discountAmount
        productObj.compareAtPrice = originalPrice

        if (productObj.isFlashDeal) {
          productObj.campaignLabel = 'پیشنهاد لحظه‌ای'
          productObj.campaignTheme = 'gold-red'
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...productObj,
      },
    })
  } catch (error) {
    console.error('Error fetching product by code:', error)
    res.status(500).json({
      success: false,
      message: 'خطای سرور',
      error: error.message,
    })
  }
})

module.exports = router
