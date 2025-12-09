const Brand = require('../models/Brand')
const { cloudinary } = require('../middleware/upload')

// تبدیل فایل آپلود شده Cloudinary به { url, public_id }
const extractImageInfo = (file) => {
  if (!file) return null
  return {
    url: file.path,
    public_id: file.filename,
  }
}

// GET /api/brands
exports.getAllBrands = async (req, res) => {
  try {
    const { limit = 1000, fields } = req.query

    let brandsQuery = Brand.find().limit(parseInt(limit, 10)).sort({ name: 1 })

    if (fields) {
      brandsQuery = brandsQuery.select(fields.split(',').join(' '))
    }

    const brands = await brandsQuery

    res.json({
      success: true,
      data: brands,
      count: brands.length,
    })
  } catch (error) {
    console.error('Error fetching brands:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست برندها',
      error: error.message,
    })
  }
}

// GET /api/brands/homepage - برندهای صفحه اصلی
exports.getHomepageBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ showOnHomepage: true })
      .sort({ displayOrder: 1, name: 1 })
      .select('name slug logo textColor hoverColor displayOrder')
      .lean()

    res.json({
      success: true,
      data: brands,
      count: brands.length,
    })
  } catch (error) {
    console.error('Error fetching homepage brands:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت برندهای صفحه اصلی',
      error: error.message,
    })
  }
}

// GET /api/brands/:id
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
    console.error('Error fetching brand by id:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات برند',
      error: error.message,
    })
  }
}

// GET /api/brands/slug/:slug - دریافت برند با slug
exports.getBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params

    // First try to find by slug
    let brand = await Brand.findOne({ slug: slug })

    // If not found by slug, try by ObjectId (for backward compatibility)
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
    console.error('Error fetching brand by slug:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات برند',
      error: error.message,
    })
  }
}

// POST /api/brands
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
      brandData.logo = extractImageInfo(req.file)
    }

    const brand = await Brand.create(brandData)

    res.status(201).json({
      success: true,
      data: brand,
      message: 'برند با موفقیت ایجاد شد',
    })
  } catch (error) {
    console.error('Error creating brand:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد برند',
      error: error.message,
    })
  }
}

// PUT /api/brands/:id
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

    // مدیریت لوگو: اگر لوگو جدید آپلود شده، لوگو قدیمی را از Cloudinary حذف کن
    if (hasNewLogo) {
      if (brand.logo && brand.logo.public_id) {
        try {
          await cloudinary.uploader.destroy(brand.logo.public_id)
        } catch (err) {
          console.error('Error deleting old logo from Cloudinary:', err.message)
        }
      }
      brand.logo = extractImageInfo(req.file)
    } else if (removeLogo === 'true' || removeLogo === true) {
      // اگر درخواست حذف لوگو داده شده
      if (brand.logo && brand.logo.public_id) {
        try {
          await cloudinary.uploader.destroy(brand.logo.public_id)
        } catch (err) {
          console.error('Error deleting logo from Cloudinary:', err.message)
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
    console.error('Error updating brand:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی برند',
      error: error.message,
    })
  }
}

// DELETE /api/brands/:id
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id)

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'برند مورد نظر یافت نشد',
      })
    }

    // حذف لوگو از Cloudinary (در صورت وجود)
    if (brand.logo && brand.logo.public_id) {
      try {
        await cloudinary.uploader.destroy(brand.logo.public_id)
      } catch (err) {
        console.error('Error deleting logo from Cloudinary:', err.message)
      }
    }

    await brand.deleteOne()

    res.json({
      success: true,
      message: 'برند با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting brand:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف برند',
      error: error.message,
    })
  }
}
