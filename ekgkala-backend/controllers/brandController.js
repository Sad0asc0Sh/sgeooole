const Brand = require('../models/Brand')
const { uploadToArvan, deleteFromArvan } = require('../lib/arvanS3')

// آپلود فایل multer (memoryStorage) به ArvanCloud و برگرداندن { url, public_id }
const extractImageInfo = async (file) => {
  if (!file) return null
  const result = await uploadToArvan(file.buffer, file.originalname)
  return {
    url: result.url,
    public_id: result.filename,
  }
}

// GET /api/brands - دریافت همه برندها
exports.getAllBrands = async (req, res) => {
  try {
    const { limit, fields } = req.query
    let query = Brand.find().sort({ name: 1 })

    if (limit) {
      query = query.limit(parseInt(limit, 10))
    }

    if (fields) {
      query = query.select(fields.split(',').join(' '))
    }

    const brands = await query

    res.json({
      success: true,
      data: brands,
      count: brands.length,
    })
  } catch (error) {
    console.error('Error in getAllBrands:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت برندها',
      error: error.message,
    })
  }
}

// GET /api/brands/homepage - دریافت برندهای صفحه اصلی
exports.getHomepageBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ showOnHomepage: true }).sort({ displayOrder: 1, name: 1 })
      .select('name slug logo textColor hoverColor displayOrder')

    res.json({
      success: true,
      data: brands,
      count: brands.length,
    })
  } catch (error) {
    console.error('Error in getHomepageBrands:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت برندهای صفحه اصلی',
      error: error.message,
    })
  }
}

// GET /api/brands/:id - دریافت برند با ID
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id)

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'برند مورد نظر یافت نشد',
      })
    }

    res.json({
      success: true,
      data: brand,
    })
  } catch (error) {
    console.error('Error in getBrandById:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت برند',
      error: error.message,
    })
  }
}

// GET /api/brands/slug/:slug - دریافت برند با slug
exports.getBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params
    let brand = await Brand.findOne({ slug: slug })

    if (!brand) {
      const mongoose = require('mongoose')
      if (mongoose.Types.ObjectId.isValid(slug)) {
        brand = await Brand.findById(slug)
      }
    }

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'برند مورد نظر یافت نشد',
      })
    }

    res.json({
      success: true,
      data: brand,
    })
  } catch (error) {
    console.error('Error in getBrandBySlug:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت برند',
      error: error.message,
    })
  }
}

// POST /api/brands - ایجاد برند جدید
exports.createBrand = async (req, res) => {
  try {
    const { name, description, showOnHomepage, displayOrder, textColor, hoverColor } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'نام برند الزامی است',
      })
    }

    const brandData = {
      name,
      description,
      showOnHomepage: showOnHomepage === 'true' || showOnHomepage === true,
      displayOrder: parseInt(displayOrder, 10) || 0,
      textColor: textColor || '#6b7280',
      hoverColor: hoverColor || '#374151',
    }

    // اگر لوگو آپلود شده باشد، اطلاعات آن را ذخیره کن
    if (req.file) {
      brandData.logo = await extractImageInfo(req.file)
    }

    const brand = await Brand.create(brandData)

    res.status(201).json({
      success: true,
      data: brand,
      message: 'برند با موفقیت ایجاد شد',
    })
  } catch (error) {
    console.error('Error in createBrand:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد برند',
      error: error.message,
    })
  }
}

// PUT /api/brands/:id - ویرایش برند
exports.updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id)

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'برند مورد نظر یافت نشد',
      })
    }

    const { name, description, removeLogo, showOnHomepage, displayOrder, textColor, hoverColor } = req.body
    const hasNewLogo = Boolean(req.file)

    // مدیریت لوگو
    if (hasNewLogo) {
      if (brand.logo && brand.logo.public_id) {
        try { await deleteFromArvan(brand.logo.public_id) } catch (e) {
          console.error('Error deleting old brand logo from ArvanCloud:', e.message)
        }
      }
      brand.logo = await extractImageInfo(req.file)
    } else if (removeLogo === 'true' || removeLogo === true) {
      if (brand.logo && brand.logo.public_id) {
        try { await deleteFromArvan(brand.logo.public_id) } catch (e) {
          console.error('Error deleting brand logo from ArvanCloud:', e.message)
        }
      }
      brand.logo = { url: null, public_id: null }
    }

    // به‌روزرسانی فیلدهای اصلی
    if (name !== undefined) brand.name = name
    if (description !== undefined) brand.description = description
    if (showOnHomepage !== undefined) {
      brand.showOnHomepage = showOnHomepage === 'true' || showOnHomepage === true
    }
    if (displayOrder !== undefined) {
      brand.displayOrder = parseInt(displayOrder, 10) || 0
    }
    if (textColor !== undefined) brand.textColor = textColor
    if (hoverColor !== undefined) brand.hoverColor = hoverColor

    const updatedBrand = await brand.save()

    res.json({
      success: true,
      data: updatedBrand,
      message: 'برند با موفقیت به‌روزرسانی شد',
    })
  } catch (error) {
    console.error('Error in updateBrand:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی برند',
      error: error.message,
    })
  }
}

// DELETE /api/brands/:id - حذف برند
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id)

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'برند مورد نظر یافت نشد',
      })
    }

    if (brand.logo && brand.logo.public_id) {
      try { await deleteFromArvan(brand.logo.public_id) } catch (e) {
        console.error('Error deleting brand logo from ArvanCloud:', e.message)
      }
    }

    await brand.deleteOne()

    res.json({
      success: true,
      message: 'برند با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error in deleteBrand:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف برند',
      error: error.message,
    })
  }
}
