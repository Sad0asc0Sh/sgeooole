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
const { protect, authorize } = require('../middleware/auth')
const { upload, cloudinary } = require('../middleware/upload')

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
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname) === '.csv') {
      cb(null, true)
    } else {
      cb(new Error('فقط فایل‌های CSV مجاز هستند'))
    }
  },
})

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

// ============================================
// GET /api/products
// Public products list with filters & pagination
// ============================================
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const sort = req.query.sort || '-createdAt'
    const fields = req.query.fields ? req.query.fields.split(',').join(' ') : undefined

    const baseFilter = buildProductFilter(req.query)
    const conditions = []

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

      // Try to find by slug first
      const categoryDoc = await Category.findOne({ slug: req.query.category }).select('_id')
      console.log('Category lookup result:', categoryDoc)

      if (categoryDoc) {
        categoryId = categoryDoc._id
      } else {
        // If not found by slug, check if it's a valid ObjectId
        const mongoose = require('mongoose')
        if (mongoose.Types.ObjectId.isValid(req.query.category)) {
          categoryId = req.query.category
        }
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

    // Text search on name or SKU (and variant SKU)
    if (req.query.search) {
      const regex = { $regex: req.query.search, $options: 'i' }
      conditions.push({
        $or: [{ name: regex }, { sku: regex }, { 'variants.sku': regex }],
      })
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

    // Handle "popularity" sort
    // Fix: sort variable is const, so we create a new variable
    let finalSort = sort
    if (sort === 'popularity') {
      finalSort = '-views'
    } else if (sort === 'bestSelling') {
      finalSort = '-salesCount'
    } else if (sort === 'mostVisited') {
      finalSort = '-views'
    }

    const query = Product.find(mongoFilter).sort(finalSort).skip(skip).limit(limit)

    if (fields) {
      query.select(fields)
    }

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
      query.lean(),
      Product.countDocuments(mongoFilter),
      Sale.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .select('name products discountPercentage badgeTheme')
        .lean(),
      priceStatsPromise,
    ])

    const minPrice = priceStats[0]?.minPrice || 0
    const maxPrice = priceStats[0]?.maxPrice || 0

    // Build a quick lookup map of productId -> campaign name
    const campaignMap = new Map()
    activeSales.forEach((sale) => {
      ; (sale.products || []).forEach((pid) => {
        const key = pid.toString()
        if (!campaignMap.has(key)) {
          campaignMap.set(key, { name: sale.name, discount: sale.discountPercentage, theme: sale.badgeTheme, endDate: sale.endDate })
        }
      })
    })

    const itemsWithCampaign = items.map((item) => {
      const productId = item._id ? item._id.toString() : null
      const campaignInfo = productId ? campaignMap.get(productId) : undefined

      const newItem = { ...item }

      if (campaignInfo) {
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
  authorize('admin', 'manager', 'superadmin'),
  async (req, res) => {
    try {
      const { endTime, disable } = req.body

      if (disable) {
        // Clear timer for all special offer products
        const result = await Product.updateMany(
          { isSpecialOffer: true },
          { $unset: { specialOfferEndTime: "" } }
        )

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

      console.log('[ADMIN] Updating special offer timer to:', endTime)

      // Update all products that have isSpecialOffer: true
      const result = await Product.updateMany(
        { isSpecialOffer: true },
        { $set: { specialOfferEndTime: endTime } }
      )

      console.log('[ADMIN] Update result:', result)

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
// GET /api/products/:id
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('brand', 'name logo')
      .populate({
        path: 'category',
        select: 'name slug parent',
        populate: {
          path: 'parent',
          select: 'name slug',
        },
      })
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    const now = new Date()
    const activeSale = await Sale.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      products: product._id,
    })
      .select('name discountPercentage badgeTheme endDate')
      .lean()

    const productObj = product.toObject()
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
  authorize('admin', 'manager', 'superadmin'),
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

      // Helper function to sync offer timers
      const syncOfferTimers = async (data) => {
        const Product = require('../models/Product');
        const now = new Date();

        // --- 1. Special Offer Sync ---
        if (data.isSpecialOffer === true) {
          const activeMaster = await Product.findOne({
            isSpecialOffer: true,
            specialOfferEndTime: { $gt: now }
          }).select('specialOfferEndTime');

          if (activeMaster && activeMaster.specialOfferEndTime) {
            console.log(`[SYNC SPECIAL] Enforcing master timer: ${activeMaster.specialOfferEndTime}`);
            data.specialOfferEndTime = activeMaster.specialOfferEndTime;
          }
        } else {
          data.specialOfferEndTime = null;
        }

        // --- 2. Flash Deal Sync ---
        if (data.isFlashDeal === true) {
          const activeMaster = await Product.findOne({
            isFlashDeal: true,
            flashDealEndTime: { $gt: now }
          }).select('flashDealEndTime');

          if (activeMaster && activeMaster.flashDealEndTime) {
            console.log(`[SYNC FLASH] Enforcing master timer: ${activeMaster.flashDealEndTime}`);
            data.flashDealEndTime = activeMaster.flashDealEndTime;
          }
        } else {
          data.flashDealEndTime = null;
        }
      };

      // Apply Timer Synchronization
      await syncOfferTimers(productData);

      const product = await Product.create(productData)

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
  authorize('admin', 'manager', 'superadmin'),
  async (req, res) => {
    try {
      const body = req.body || {}
      const { removeAllImages, imagesToRemove, ...updates } = body

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
        updates.images = []
      } else if (Array.isArray(imagesToRemove) && imagesToRemove.length > 0) {
        const toRemove = imagesToRemove

        const remainingImages = []

        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            const existingUrl =
              img && typeof img === 'object'
                ? img.url
                : typeof img === 'string'
                  ? img
                  : undefined
            const existingPublicId =
              img && typeof img === 'object' && img.public_id ? img.public_id : undefined

            const shouldRemove = toRemove.some((r) => {
              const rUrl =
                r && typeof r === 'object'
                  ? r.url
                  : typeof r === 'string'
                    ? r
                    : undefined
              const rPublicId =
                r && typeof r === 'object' && r.public_id ? r.public_id : undefined

              if (existingPublicId && rPublicId) {
                return existingPublicId === rPublicId
              }

              if (!existingPublicId && existingUrl && rUrl) {
                return existingUrl === rUrl
              }

              return false
            })

            if (shouldRemove) {
              if (existingPublicId) {
                try {
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

        updates.images = remainingImages
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

      // Apply Timer Synchronization
      await syncOfferTimers(updates, product);

      // Use findByIdAndUpdate for simple updates to avoid full validation
      console.log(`[UPDATE PRODUCT] ID: ${req.params.id}, Updates:`, updates)

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: false }
      )

      console.log(`[UPDATE PRODUCT] Result isSpecialOffer:`, updatedProduct.isSpecialOffer)

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
  authorize('admin', 'manager', 'superadmin'),
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
// DELETE /api/products/:id
// ============================================
router.delete(
  '/:id',
  protect,
  authorize('admin', 'manager', 'superadmin'),
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
  authorize('admin', 'manager', 'superadmin'),
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
  authorize('admin', 'manager', 'superadmin'),
  async (req, res) => {
    try {
      // Fetch all products with valid category references (for Excel export)
      const products = await Product.find({
        $or: [
          { category: { $type: 'objectId' } },
          { category: { $exists: false } },
          { category: null },
        ],
      }).lean()

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
  authorize('admin', 'manager', 'superadmin'),
  csvUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'فایل CSV آپلود نشده است',
        })
      }

      const filePath = req.file.path
      const products = []
      const errors = []

      // Read CSV file
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          products.push(row)
        })
        .on('end', async () => {
          try {
            const productsToCreate = []

            for (let i = 0; i < products.length; i++) {
              const row = products[i]

              try {
                // Find category by name
                let categoryId = null
                if (row.category) {
                  const category = await Category.findOne({ name: row.category.trim() })
                  if (category) {
                    categoryId = category._id
                  }
                }

                // Find brand by name
                let brandId = null
                if (row.brand) {
                  const brand = await Brand.findOne({ name: row.brand.trim() })
                  if (brand) {
                    brandId = brand._id
                  }
                }

                // Create product object
                const productData = {
                  name: row.name || `محصول ${i + 1}`,
                  sku: row.sku || '',
                  productType: row.productType || 'simple',
                  price: parseFloat(row.price) || 0,
                  compareAtPrice: row.compareAtPrice ? parseFloat(row.compareAtPrice) : undefined,
                  stock: parseInt(row.stock) || 0,
                  category: categoryId,
                  brand: brandId,
                  description: row.description || '',
                  isActive: row.isActive === 'بله' || row.isActive === 'true' || row.isActive === '1',
                  isFeatured:
                    row.isFeatured === 'بله' || row.isFeatured === 'true' || row.isFeatured === '1',
                }

                productsToCreate.push(productData)
              } catch (rowError) {
                errors.push(`خطا در ردیف ${i + 1}: ${rowError.message}`)
              }
            }

            // Insert products in bulk
            if (productsToCreate.length > 0) {
              await Product.insertMany(productsToCreate)
            }

            // Delete uploaded file
            fs.unlinkSync(filePath)

            // Send response
            const message = `تعداد ${productsToCreate.length} محصول با موفقیت درون‌ریزی شد`
            res.json({
              success: true,
              message,
              imported: productsToCreate.length,
              errors: errors.length > 0 ? errors : undefined,
            })
          } catch (error) {
            // Delete uploaded file on error
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
            }

            console.error('Error processing CSV:', error)
            res.status(500).json({
              success: false,
              message: 'خطا در پردازش فایل CSV',
              error: error.message,
            })
          }
        })
        .on('error', (error) => {
          // Delete uploaded file on error
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }

          console.error('Error reading CSV:', error)
          res.status(500).json({
            success: false,
            message: 'خطا در خواندن فایل CSV',
            error: error.message,
          })
        })
    } catch (error) {
      console.error('Error importing products from CSV:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در درون‌ریزی محصولات از CSV',
        error: error.message,
      })
    }
  },
)

module.exports = router
