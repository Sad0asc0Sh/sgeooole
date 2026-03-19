const path = require('path')
const fs = require('fs')
const Banner = require('../models/Banner')

const { UPLOAD_BASE_PATH } = require('../middleware/upload')

// ============================================
// Helpers
// ============================================

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return Boolean(value)
}

const parseNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeImageInput = (imageInput) => {
  if (!imageInput) return null

  if (typeof imageInput === 'string') {
    const trimmed = imageInput.trim()
    return trimmed ? { url: trimmed } : null
  }

  if (typeof imageInput === 'object' && imageInput.url) {
    const trimmedUrl = String(imageInput.url).trim()
    if (!trimmedUrl) return null
    return { url: trimmedUrl }
  }

  return null
}

// فایل آپلود شده توسط multer را به ساختار image بنر تبدیل می‌کند
const mapUploadedFileToBannerImage = (file) => {
  if (!file) return null

  // url توسط normalizeFileUrl ست می‌شه، اگر نبود fallback می‌زنیم
  const BASE_URL = process.env.BASE_URL || ''
  const url = file.url || `${BASE_URL}/uploads/${file.filename}`

  return {
    url,
    filename: file.filename,
  }
}

// مسیر فیزیکی فایل روی دیسک
const resolveLocalFilePath = (image) => {
  if (!image) return null

  // اگر filename مستقیم داریم
  if (image.filename) {
    return path.join(UPLOAD_BASE_PATH, image.filename)
  }

  // از url استخراج می‌کنیم
  if (image.url && typeof image.url === 'string') {
    const match = image.url.match(/\/uploads\/([^/?#]+)$/)
    if (match) return path.join(UPLOAD_BASE_PATH, match[1])
  }

  return null
}

// حذف فیزیکی تصویر از دیسک
const deleteLocalImageSafe = (image) => {
  const filePath = resolveLocalFilePath(image)
  if (!filePath) return

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log('[BANNER] Deleted local image:', filePath)
    }
  } catch (error) {
    console.error('[BANNER] Failed to delete local image:', filePath, error.message)
  }
}

// ============================================
// Controllers
// ============================================

// GET /api/banners
exports.getBanners = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}
    if (req.query.position) filter.position = req.query.position
    if (req.query.isActive === 'true') filter.isActive = true
    else if (req.query.isActive === 'false') filter.isActive = false

    const sort = req.query.sort || 'sortOrder -createdAt'
    const [items, total] = await Promise.all([
      Banner.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Banner.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: items,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    })
  } catch (error) {
    console.error('Error fetching banners:', error)
    res.status(500).json({ success: false, message: 'خطا در دریافت بنرها', error: error.message })
  }
}

// POST /api/banners
exports.createBanner = async (req, res) => {
  let uploadedFile = null

  try {
    const { title, link, position, isActive, image, sortOrder } = req.body || {}

    if (!title) {
      return res.status(400).json({ success: false, message: 'عنوان بنر الزامی است' })
    }

    let bannerImage = null

    if (req.file) {
      uploadedFile = req.file
      bannerImage = mapUploadedFileToBannerImage(req.file)
    } else if (image) {
      bannerImage = normalizeImageInput(image)
    }

    const banner = await Banner.create({
      title,
      link: link || '',
      position: position || 'main-slider',
      isActive: parseBoolean(isActive, true),
      image: bannerImage,
      sortOrder: parseNumber(sortOrder, 0),
    })

    res.status(201).json({ success: true, message: 'بنر با موفقیت ایجاد شد', data: banner })
  } catch (error) {
    // اگر بنر ذخیره نشد، فایل آپلود شده رو پاک می‌کنیم
    if (uploadedFile) deleteLocalImageSafe({ filename: uploadedFile.filename })

    console.error('Error creating banner:', error)
    res.status(500).json({ success: false, message: 'خطا در ایجاد بنر', error: error.message })
  }
}

// PUT /api/banners/:id
exports.updateBanner = async (req, res) => {
  let uploadedFile = null

  try {
    const updates = req.body || {}
    const banner = await Banner.findById(req.params.id)

    if (!banner) {
      return res.status(404).json({ success: false, message: 'بنر یافت نشد' })
    }

    const oldImage = banner.image
    let nextImage = undefined

    if (updates.title !== undefined) banner.title = updates.title
    if (updates.link !== undefined) banner.link = updates.link
    if (updates.position !== undefined) banner.position = updates.position
    if (updates.isActive !== undefined) banner.isActive = parseBoolean(updates.isActive, banner.isActive)
    if (updates.sortOrder !== undefined) banner.sortOrder = parseNumber(updates.sortOrder, banner.sortOrder)

    if (req.file) {
      uploadedFile = req.file
      nextImage = mapUploadedFileToBannerImage(req.file)
    } else if (updates.image !== undefined) {
      nextImage = normalizeImageInput(updates.image)
    }

    if (nextImage !== undefined) {
      banner.image = nextImage
    }

    const saved = await banner.save()

    // اگر تصویر عوض شد، تصویر قدیمی رو از دیسک حذف می‌کنیم
    if (nextImage !== undefined && oldImage) {
      deleteLocalImageSafe(oldImage)
    }

    res.json({ success: true, message: 'بنر با موفقیت ویرایش شد', data: saved })
  } catch (error) {
    if (uploadedFile) deleteLocalImageSafe({ filename: uploadedFile.filename })

    console.error('Error updating banner:', error)
    res.status(500).json({ success: false, message: 'خطا در ویرایش بنر', error: error.message })
  }
}

// DELETE /api/banners/:id
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
    if (!banner) {
      return res.status(404).json({ success: false, message: 'بنر یافت نشد' })
    }

    const imageToDelete = banner.image
    await banner.deleteOne()
    deleteLocalImageSafe(imageToDelete)

    res.json({ success: true, message: 'بنر با موفقیت حذف شد' })
  } catch (error) {
    console.error('Error deleting banner:', error)
    res.status(500).json({ success: false, message: 'خطا در حذف بنر', error: error.message })
  }
}
