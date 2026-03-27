const Banner = require('../models/Banner')
const { uploadToParsPack, deleteFromParsPack } = require('../lib/parspackS3')

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

// آپلود فایل multer (memoryStorage) به ParsPack و برگرداندن ساختار image بنر
const mapUploadedFileToBannerImage = async (file) => {
  if (!file) return null
  const result = await uploadToParsPack(file.buffer, file.originalname)
  return {
    url: result.url,
    filename: result.filename,
  }
}

// حذف تصویر از ParsPack
const deleteImageSafe = async (image) => {
  if (!image || !image.filename) return
  try {
    await deleteFromParsPack(image.filename)
    console.log('[BANNER] Deleted from ParsPack:', image.filename)
  } catch (error) {
    console.error('[BANNER] Failed to delete from ParsPack:', image.filename, error.message)
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
      bannerImage = await mapUploadedFileToBannerImage(req.file)
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
    if (uploadedFile && bannerImage) await deleteImageSafe(bannerImage)

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
      nextImage = await mapUploadedFileToBannerImage(req.file)
    } else if (updates.image !== undefined) {
      nextImage = normalizeImageInput(updates.image)
    }

    if (nextImage !== undefined) {
      banner.image = nextImage
    }

    const saved = await banner.save()

    // اگر تصویر عوض شد، تصویر قدیمی رو از دیسک حذف می‌کنیم
    if (nextImage !== undefined && oldImage) {
      await deleteImageSafe(oldImage)
    }

    res.json({ success: true, message: 'بنر با موفقیت ویرایش شد', data: saved })
  } catch (error) {
    if (uploadedFile && nextImage) await deleteImageSafe(nextImage)

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
    await deleteImageSafe(imageToDelete)

    res.json({ success: true, message: 'بنر با موفقیت حذف شد' })
  } catch (error) {
    console.error('Error deleting banner:', error)
    res.status(500).json({ success: false, message: 'خطا در حذف بنر', error: error.message })
  }
}
