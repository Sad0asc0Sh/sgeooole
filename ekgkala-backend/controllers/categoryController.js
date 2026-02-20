const Category = require('../models/Category')
const Product = require('../models/Product')
const { cloudinary } = require('../middleware/upload')

const parseBooleanQueryParam = (value) =>
  value === true || value === 'true' || value === '1' || value === 1

const computeConnectedCategoryIdSet = (categories = []) => {
  const childrenByParentId = new Map()
  const rootIds = []

  const normalizeId = (value) => (value ? value.toString() : null)

  categories.forEach((cat) => {
    const id = normalizeId(cat?._id)
    if (!id) return

    const parentId = normalizeId(cat.parent)

    if (!parentId) {
      rootIds.push(id)
    }

    const key = parentId || null
    if (!childrenByParentId.has(key)) {
      childrenByParentId.set(key, [])
    }
    childrenByParentId.get(key).push(id)
  })

  const connectedIds = new Set()
  const stack = [...rootIds]

  while (stack.length > 0) {
    const id = stack.pop()
    if (!id || connectedIds.has(id)) continue
    connectedIds.add(id)

    const children = childrenByParentId.get(id) || []
    children.forEach((childId) => {
      if (!connectedIds.has(childId)) {
        stack.push(childId)
      }
    })
  }

  return connectedIds
}

// Normalize Cloudinary file object to { url, public_id }
const extractImageInfo = (file) => {
  if (!file) return null
  return {
    url: file.path,
    public_id: file.filename,
  }
}

// GET /api/categories/tree
exports.getCategoryTree = async (req, res) => {
  try {
    const includeOrphans = parseBooleanQueryParam(req.query.includeOrphans)

    const allCategories = await Category.find({ isActive: true }).lean()

    const connectedIds = computeConnectedCategoryIdSet(allCategories)
    const allIds = allCategories.map((c) => c._id.toString())
    const orphanIds = new Set(allIds.filter((id) => !connectedIds.has(id)))

    const categoriesById = new Map(allCategories.map((c) => [c._id.toString(), c]))
    const childrenByParentId = new Map()

    allCategories.forEach((cat) => {
      const parentId = cat.parent ? cat.parent.toString() : null
      const key = parentId || null
      if (!childrenByParentId.has(key)) {
        childrenByParentId.set(key, [])
      }
      childrenByParentId.get(key).push(cat._id.toString())
    })

    const sortIds = (ids = []) =>
      [...ids].sort((a, b) => {
        const ca = categoriesById.get(a)
        const cb = categoriesById.get(b)
        const orderDiff = (ca?.order || 0) - (cb?.order || 0)
        if (orderDiff !== 0) return orderDiff
        return String(ca?.name || '').localeCompare(String(cb?.name || ''), 'fa')
      })

    const visited = new Set()

    const buildNode = (id, stack = new Set()) => {
      const cat = categoriesById.get(id)
      if (!cat) return null

      if (visited.has(id)) return null

      if (stack.has(id)) {
        visited.add(id)
        return {
          _id: cat._id,
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          image: cat.image,
          isFeatured: cat.isFeatured,
          isPopular: cat.isPopular,
          parent: cat.parent,
          slug: cat.slug,
          order: cat.order,
          isActive: cat.isActive,
          properties: cat.properties || [],
          isOrphan: orphanIds.has(id),
          children: [],
        }
      }

      visited.add(id)

      const nextStack = new Set(stack)
      nextStack.add(id)

      const childIds = sortIds(childrenByParentId.get(id) || [])
      const children = childIds
        .map((childId) => buildNode(childId, nextStack))
        .filter(Boolean)

      return {
        _id: cat._id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        image: cat.image,
        isFeatured: cat.isFeatured,
        isPopular: cat.isPopular,
        parent: cat.parent,
        slug: cat.slug,
        order: cat.order,
        isActive: cat.isActive,
        properties: cat.properties || [], // Include category-specific attributes
        isOrphan: orphanIds.has(id),
        children,
      }
    }

    const tree = []

    // 1) Normal connected roots (parent=null)
    const rootIds = sortIds(childrenByParentId.get(null) || [])
    rootIds.forEach((rootId) => {
      const node = buildNode(rootId)
      if (node) {
        tree.push(node)
      }
    })

    // 2) Optionally include orphan components as additional roots (for debugging/cleanup)
    if (includeOrphans) {
      // Prefer "top-level" orphans first (orphans whose parent is not an orphan),
      // so orphan subtrees don't get duplicated as multiple roots.
      const orphanRootIds = sortIds(
        allIds.filter((id) => {
          if (!orphanIds.has(id)) return false
          const parent = categoriesById.get(id)?.parent
          const parentId = parent ? parent.toString() : null
          if (!parentId) return true
          return !orphanIds.has(parentId)
        }),
      )

      orphanRootIds.forEach((id) => {
        const node = buildNode(id)
        if (node) {
          tree.push(node)
        }
      })

      // Fallback: include any remaining unreachable categories (e.g. cycles) as roots.
      const remainingOrphanIds = sortIds(
        allIds.filter((id) => orphanIds.has(id) && !visited.has(id)),
      )
      remainingOrphanIds.forEach((id) => {
        const node = buildNode(id)
        if (node) {
          tree.push(node)
        }
      })
    }

    res.json({
      success: true,
      data: tree,
      count: allCategories.length,
      connectedCount: connectedIds.size,
      orphanCount: orphanIds.size,
    })
  } catch (error) {
    console.error('Error fetching category tree:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت درخت دسته‌بندی‌ها',
      error: error.message,
    })
  }
}

// GET /api/categories
exports.getAllCategories = async (req, res) => {
  try {
    const { limit = 1000, fields, parent, isFeatured, isPopular } = req.query

    const includeOrphans = parseBooleanQueryParam(req.query.includeOrphans)
    const onlyOrphans = parseBooleanQueryParam(req.query.onlyOrphans)

    const query = { isActive: true }

    if (parent !== undefined) {
      query.parent = parent === 'null' ? null : parent
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true'
    }

    if (isPopular !== undefined) {
      query.isPopular = isPopular === 'true'
    }

    let categoriesQuery = Category.find(query)
      .limit(parseInt(limit, 10))
      .sort({ order: 1, name: 1 })

    if (fields) {
      categoriesQuery = categoriesQuery.select(fields.split(',').join(' '))
    }

    const categoriesList = await categoriesQuery.lean()

    let finalCategories = categoriesList
    let meta = {
      mode: onlyOrphans ? 'onlyOrphans' : (includeOrphans ? 'allActive' : 'connectedOnly'),
    }

    // For scoped queries (e.g. parent=...), keep the historical behavior: return what Mongo returns.
    // Connectivity filtering is applied only for the "full list" use case (dropdown filters, etc).
    const isScopedQuery = parent !== undefined || isFeatured !== undefined || isPopular !== undefined

    if (!isScopedQuery && (onlyOrphans || !includeOrphans)) {
      const minimalActive = await Category.find({ isActive: true }).select('_id parent').lean()
      const connectedIds = computeConnectedCategoryIdSet(minimalActive)

      const orphanIdSet = new Set()
      minimalActive.forEach((cat) => {
        const id = cat._id.toString()
        if (!connectedIds.has(id)) {
          orphanIdSet.add(id)
        }
      })

      if (onlyOrphans) {
        finalCategories = categoriesList.filter((c) => orphanIdSet.has(c._id.toString()))
        meta = {
          ...meta,
          totalActive: minimalActive.length,
          connectedActive: connectedIds.size,
          orphanActive: orphanIdSet.size,
        }
      } else {
        finalCategories = categoriesList.filter((c) => connectedIds.has(c._id.toString()))
        meta = {
          ...meta,
          totalActive: minimalActive.length,
          connectedActive: connectedIds.size,
          orphanActive: orphanIdSet.size,
        }
      }
    } else if (isScopedQuery) {
      meta = {
        mode: 'scopedQuery',
      }
    }

    res.json({
      success: true,
      data: finalCategories,
      count: finalCategories.length,
      meta,
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت دسته‌بندی‌ها',
      error: error.message,
    })
  }
}

// GET /api/categories/orphans
// Admin/maintenance: list active categories that are not reachable from a root (parent=null)
exports.getOrphanCategories = async (req, res) => {
  try {
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 500)

    const minimalActive = await Category.find({ isActive: true }).select('_id parent').lean()
    const connectedIds = computeConnectedCategoryIdSet(minimalActive)

    const orphanIds = minimalActive
      .map((c) => c._id.toString())
      .filter((id) => !connectedIds.has(id))

    const data = await Category.find({ isActive: true, _id: { $in: orphanIds } })
      .sort({ order: 1, name: 1 })
      .limit(limit)
      .select('name parent slug order isActive isFeatured isPopular')
      .lean()

    res.json({
      success: true,
      data,
      count: data.length,
      meta: {
        totalActive: minimalActive.length,
        connectedActive: connectedIds.size,
        orphanActive: orphanIds.length,
        limit,
      },
    })
  } catch (error) {
    console.error('Error fetching orphan categories:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت دسته‌بندی‌های یتیم',
      error: error.message,
    })
  }
}

// POST /api/categories/orphans/cleanup
// Admin/maintenance: delete or deactivate active orphan categories
exports.cleanupOrphanCategories = async (req, res) => {
  try {
    const dryRun = parseBooleanQueryParam(req.query.dryRun ?? req.body?.dryRun)
    const mode = String(req.query.mode ?? req.body?.mode ?? 'delete').toLowerCase()

    const minimalActive = await Category.find({ isActive: true }).select('_id parent').lean()
    const connectedIds = computeConnectedCategoryIdSet(minimalActive)

    const orphanIds = minimalActive
      .map((c) => c._id.toString())
      .filter((id) => !connectedIds.has(id))

    if (orphanIds.length === 0) {
      return res.json({
        success: true,
        message: 'هیچ دسته‌بندی یتیمی یافت نشد.',
        orphanCount: 0,
        dryRun,
        mode,
      })
    }

    if (dryRun) {
      return res.json({
        success: true,
        message: 'Dry-run: هیچ تغییری اعمال نشد.',
        orphanCount: orphanIds.length,
        orphanIds,
        dryRun: true,
        mode,
      })
    }

    if (mode !== 'delete' && mode !== 'deactivate') {
      return res.status(400).json({
        success: false,
        message: "پارامتر mode نامعتبر است. مقادیر مجاز: 'delete' یا 'deactivate'",
      })
    }

    let productsUpdated = 0
    let categoriesAffected = 0

    if (mode === 'deactivate') {
      const updateResult = await Category.updateMany(
        { isActive: true, _id: { $in: orphanIds } },
        { $set: { isActive: false } },
      )
      categoriesAffected = updateResult?.modifiedCount ?? updateResult?.nModified ?? 0
    } else {
      const productResult = await Product.updateMany(
        { category: { $in: orphanIds } },
        { $set: { category: null } },
      )
      productsUpdated = productResult?.modifiedCount ?? productResult?.nModified ?? 0

      const deleteResult = await Category.deleteMany({ _id: { $in: orphanIds } })
      categoriesAffected = deleteResult?.deletedCount ?? 0
    }

    return res.json({
      success: true,
      message:
        mode === 'delete'
          ? 'دسته‌بندی‌های یتیم حذف شدند و ارجاع محصولات پاک شد.'
          : 'دسته‌بندی‌های یتیم غیرفعال شدند.',
      mode,
      orphanCount: orphanIds.length,
      categoriesAffected,
      productsUpdated,
    })
  } catch (error) {
    console.error('Error cleaning orphan categories:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در پاکسازی دسته‌بندی‌های یتیم',
      error: error.message,
    })
  }
}

// GET /api/categories/featured
exports.getFeaturedCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, isFeatured: true })
      .sort({ order: 1, name: 1 })

    res.json({
      success: true,
      data: categories,
      count: categories.length,
    })
  } catch (error) {
    console.error('Error fetching featured categories:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت دسته‌بندی‌های ویژه',
      error: error.message,
    })
  }
}

// GET /api/categories/popular
exports.getPopularCategories = async (req, res) => {
  try {
    // Import models
    const Settings = require('../models/Settings')
    const CategoryView = require('../models/CategoryView')

    // Get settings
    const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
    const config = settings?.popularCategoriesSettings || {}

    const displayEnabled = config.displayEnabled === true
    const useFallback = config.useFallback !== false
    const displayLimit = config.displayLimit || 8
    const periodDays = config.periodDays || 30
    const minViews = config.minViews || 5
    const minTotalViewsForActivation = config.minTotalViewsForActivation || 100

    // Check if we have enough data for analytics
    let hasEnoughData = false
    let stats = null

    if (displayEnabled) {
      try {
        stats = await CategoryView.getStats(periodDays)
        hasEnoughData = stats.totalViews >= minTotalViewsForActivation
      } catch (err) {
        console.warn('Could not get category view stats:', err.message)
      }
    }

    // Use analytics if enabled and has enough data
    if (displayEnabled && hasEnoughData) {
      try {
        const popularCategories = await CategoryView.getPopularCategories({
          limit: displayLimit,
          periodDays,
          minViews
        })

        return res.json({
          success: true,
          data: popularCategories,
          source: 'analytics',
          count: popularCategories.length,
        })
      } catch (err) {
        console.warn('Could not get popular categories from analytics, falling back:', err.message)
      }
    }

    // Fallback to manual isPopular categories
    if (useFallback) {
      const categories = await Category.find({ isActive: true, isPopular: true })
        .sort({ order: 1, name: 1 })
        .limit(displayLimit)
        .select('name slug image icon description order')

      return res.json({
        success: true,
        data: categories,
        source: 'manual',
        count: categories.length,
      })
    }

    // No data available
    return res.json({
      success: true,
      data: [],
      source: 'none',
      count: 0,
    })
  } catch (error) {
    console.error('Error fetching popular categories:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت دسته‌بندی‌های محبوب',
      error: error.message,
    })
  }
}

// GET /api/categories/:id
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      'parent',
      'name',
    )

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'دسته‌بندی با این شناسه یافت نشد',
      })
    }

    res.json({
      success: true,
      data: category,
    })
  } catch (error) {
    console.error('Error fetching category by id:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات دسته‌بندی',
      error: error.message,
    })
  }
}

// GET /api/categories/slug/:slug
// Used by frontend to get category details including properties for filters
exports.getCategoryBySlug = async (req, res) => {
  try {
    const mongoose = require('mongoose')
    const { slug } = req.params

    // Try to find by slug first
    let category = await Category.findOne({ slug }).populate('parent', 'name slug')

    // If not found by slug, try as ObjectId
    if (!category && mongoose.Types.ObjectId.isValid(slug)) {
      category = await Category.findById(slug).populate('parent', 'name slug')
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'دسته‌بندی یافت نشد',
      })
    }

    // Return only the filterable properties for frontend use
    const filterableProperties = (category.properties || [])
      .filter(prop => prop.isFilterable !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    res.json({
      success: true,
      data: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parent: category.parent,
        properties: filterableProperties,
      },
    })
  } catch (error) {
    console.error('Error fetching category by slug:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات دسته‌بندی',
      error: error.message,
    })
  }
}

exports.createCategory = async (req, res) => {
  try {
    const { name, parent, description, isFeatured, isPopular, properties } = req.body

    // DEBUG: Log received files
    console.log('[CREATE_CATEGORY] Received files:', {
      hasFiles: !!req.files,
      iconFile: req.files?.icon?.[0] ? { path: req.files.icon[0].path, filename: req.files.icon[0].filename } : null,
      imageFile: req.files?.image?.[0] ? { path: req.files.image[0].path, filename: req.files.image[0].filename } : null,
    })

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً نام دسته‌بندی را وارد کنید',
      })
    }

    const categoryData = {
      name,
      parent: parent && parent !== 'null' ? parent : null,
      description,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isPopular: isPopular === 'true' || isPopular === true,
    }

    // Handle properties (category-specific attributes/specifications)
    // Properties can come as JSON string (from FormData) or as array (from JSON body)
    if (properties) {
      try {
        categoryData.properties = typeof properties === 'string' ? JSON.parse(properties) : properties
      } catch (e) {
        console.error('Error parsing properties:', e)
        categoryData.properties = []
      }
    }

    if (req.files) {
      if (req.files.icon && req.files.icon[0]) {
        categoryData.icon = extractImageInfo(req.files.icon[0])
      }
      if (req.files.image && req.files.image[0]) {
        categoryData.image = extractImageInfo(req.files.image[0])
      }
    }

    const category = await Category.create(categoryData)

    res.status(201).json({
      success: true,
      data: category,
      message: 'دسته‌بندی با موفقیت ایجاد شد',
    })
  } catch (error) {
    console.error('Error creating category:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد دسته‌بندی',
      error: error.message,
    })
  }
}

// PUT /api/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    // DEBUG: Log received files for update
    console.log('[UPDATE_CATEGORY] Received files:', {
      categoryId: req.params.id,
      hasFiles: !!req.files,
      iconFile: req.files?.icon?.[0] ? { path: req.files.icon[0].path, filename: req.files.icon[0].filename } : null,
      imageFile: req.files?.image?.[0] ? { path: req.files.image[0].path, filename: req.files.image[0].filename } : null,
      bodyKeys: Object.keys(req.body),
    })

    const category = await Category.findById(req.params.id)

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'دسته‌بندی با این شناسه یافت نشد',
      })
    }

    const hasNewIcon = req.files && req.files.icon && req.files.icon[0]
    const hasNewImage = req.files && req.files.image && req.files.image[0]

    const {
      name,
      parent,
      description,
      isFeatured,
      isPopular,
      order,
      isActive,
      removeIcon,
      removeImage,
      properties,
    } = req.body

    // Icon update / delete logic
    if (hasNewIcon) {
      if (category.icon && category.icon.public_id) {
        try {
          await cloudinary.uploader.destroy(category.icon.public_id)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            'Error deleting old icon from Cloudinary:',
            err.message,
          )
        }
      }
      category.icon = extractImageInfo(req.files.icon[0])
    } else if (removeIcon === 'true' || removeIcon === true) {
      if (category.icon && category.icon.public_id) {
        try {
          await cloudinary.uploader.destroy(category.icon.public_id)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Error deleting icon from Cloudinary:', err.message)
        }
      }
      category.icon = null
    }

    // Image update / delete logic
    if (hasNewImage) {
      if (category.image && category.image.public_id) {
        try {
          await cloudinary.uploader.destroy(category.image.public_id)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            'Error deleting old image from Cloudinary:',
            err.message,
          )
        }
      }
      category.image = extractImageInfo(req.files.image[0])
    } else if (removeImage === 'true' || removeImage === true) {
      if (category.image && category.image.public_id) {
        try {
          await cloudinary.uploader.destroy(category.image.public_id)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Error deleting image from Cloudinary:', err.message)
        }
      }
      category.image = null
    }

    // Scalar fields
    if (name !== undefined) category.name = name
    if (parent !== undefined) {
      category.parent = parent && parent !== 'null' ? parent : null
    }
    if (description !== undefined) category.description = description
    if (isFeatured !== undefined) {
      category.isFeatured = isFeatured === 'true' || isFeatured === true
    }
    if (isPopular !== undefined) {
      category.isPopular = isPopular === 'true' || isPopular === true
    }
    if (order !== undefined) {
      category.order = Number(order)
    }
    if (isActive !== undefined) {
      category.isActive = isActive === 'true' || isActive === true
    }

    // Handle properties (category-specific attributes/specifications)
    if (properties !== undefined) {
      try {
        category.properties = typeof properties === 'string' ? JSON.parse(properties) : properties
      } catch (e) {
        console.error('Error parsing properties:', e)
      }
    }

    const updatedCategory = await category.save()

    res.json({
      success: true,
      data: updatedCategory,
      message: 'دسته‌بندی با موفقیت به‌روزرسانی شد',
    })
  } catch (error) {
    console.error('Error updating category:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی دسته‌بندی',
      error: error.message,
    })
  }
}

// DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'دسته‌بندی با این شناسه یافت نشد',
      })
    }

    if (category.icon && category.icon.public_id) {
      try {
        await cloudinary.uploader.destroy(category.icon.public_id)
      } catch (err) {
        console.error('Error deleting icon from Cloudinary:', err.message)
      }
    }

    if (category.image && category.image.public_id) {
      try {
        await cloudinary.uploader.destroy(category.image.public_id)
      } catch (err) {
        console.error('Error deleting image from Cloudinary:', err.message)
      }
    }

    // Fundamentally fix the issue: instead of detaching children and leaving them orphaned
    // (which causes them to show in filters since isActive=true still), we will recursively
    // find all descendant categories and delete them so no trace is left behind.
    const getDescendantIds = async (parentId) => {
      const children = await Category.find({ parent: parentId }).select('_id isActive').lean()
      let ids = children.map(c => c._id)
      for (const childId of ids) {
        const subIds = await getDescendantIds(childId)
        ids = ids.concat(subIds)
      }
      return ids
    }

    const descendantIds = await getDescendantIds(category._id)
    const allIdsToDelete = [category._id, ...descendantIds]

    // Remove product references so deleted categories won't linger in products
    await Product.updateMany({ category: { $in: allIdsToDelete } }, { $set: { category: null } })

    // Delete the category and all its descendants completely
    await Category.deleteMany({ _id: { $in: allIdsToDelete } })

    res.json({
      success: true,
      message: 'دسته‌بندی و تمام زیرشاخه‌های آن با موفقیت حذف شدند',
      deletedCount: allIdsToDelete.length
    })
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف دسته‌بندی',
      error: error.message,
    })
  }
}
