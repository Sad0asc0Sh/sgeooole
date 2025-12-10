const Category = require('../models/Category')
const { cloudinary } = require('../middleware/upload')

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
    const buildTree = (categories, parentId = null) =>
      categories
        .filter((cat) => {
          const catParent = cat.parent ? cat.parent.toString() : null
          const compareParent = parentId ? parentId.toString() : null
          return catParent === compareParent
        })
        .sort((a, b) => a.order - b.order)
        .map((cat) => ({
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
          children: buildTree(categories, cat._id),
        }))

    const allCategories = await Category.find({ isActive: true })
    const tree = buildTree(allCategories, null)

    res.json({
      success: true,
      data: tree,
      count: allCategories.length,
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

    const categories = await categoriesQuery

    res.json({
      success: true,
      data: categories,
      count: categories.length,
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
    const categories = await Category.find({ isActive: true, isPopular: true })
      .sort({ order: 1, name: 1 })

    res.json({
      success: true,
      data: categories,
      count: categories.length,
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

    await category.deleteOne()

    res.json({
      success: true,
      message: 'دسته‌بندی با موفقیت حذف شد',
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
