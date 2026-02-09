const BlogCategory = require('../models/BlogCategory')

// ایجاد دسته‌بندی وبلاگ
exports.createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body || {}

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً نام دسته‌بندی وبلاگ را وارد کنید',
      })
    }

    let finalSlug = slug
    if (!finalSlug) {
      const base = name.toString().trim().toLowerCase()
      finalSlug = base
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-]+/gu, '')
        .replace(/\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
    }

    const exists = await BlogCategory.findOne({ slug: finalSlug })
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'دسته‌بندی وبلاگ دیگری با این اسلاگ قبلاً ثبت شده است',
      })
    }

    const category = await BlogCategory.create({ name, slug: finalSlug })

    res.status(201).json({
      success: true,
      message: 'دسته‌بندی وبلاگ با موفقیت ایجاد شد',
      data: category,
    })
  } catch (error) {
    console.error('Error creating blog category:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد دسته‌بندی وبلاگ',
      error: error.message,
    })
  }
}

// دریافت همه دسته‌بندی‌های وبلاگ
exports.getCategories = async (req, res) => {
  try {
    const categories = await BlogCategory.find().sort({ name: 1 }).lean()
    res.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error('Error fetching blog categories:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت دسته‌بندی‌های وبلاگ',
      error: error.message,
    })
  }
}

// به‌روزرسانی دسته‌بندی وبلاگ
exports.updateCategory = async (req, res) => {
  try {
    const { name, slug } = req.body || {}

    const category = await BlogCategory.findById(req.params.id)
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'دسته‌بندی وبلاگ با این شناسه یافت نشد',
      })
    }

    if (name) {
      category.name = name
    }

    if (slug) {
      category.slug = slug
    } else if (name && !category.slug) {
      const base = name.toString().trim().toLowerCase()
      category.slug = base
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-]+/gu, '')
        .replace(/\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
    }

    const saved = await category.save()

    res.json({
      success: true,
      message: 'دسته‌بندی وبلاگ با موفقیت به‌روزرسانی شد',
      data: saved,
    })
  } catch (error) {
    console.error('Error updating blog category:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی دسته‌بندی وبلاگ',
      error: error.message,
    })
  }
}

// حذف دسته‌بندی وبلاگ
exports.deleteCategory = async (req, res) => {
  try {
    const category = await BlogCategory.findById(req.params.id)
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'دسته‌بندی وبلاگ با این شناسه یافت نشد',
      })
    }

    await category.deleteOne()

    res.json({
      success: true,
      message: 'دسته‌بندی وبلاگ با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting blog category:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف دسته‌بندی وبلاگ',
      error: error.message,
    })
  }
}
