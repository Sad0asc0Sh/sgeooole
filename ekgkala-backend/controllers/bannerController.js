const Banner = require('../models/Banner')
const { cloudinary } = require('../middleware/upload')

const buildTransformedCloudinaryUrl = (url, transform) => {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('/upload/')) return url
  return url.replace('/upload/', `/upload/${transform}/`)
}

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

    const normalized = {
      url: trimmedUrl,
    }

    if (imageInput.public_id) normalized.public_id = imageInput.public_id
    if (imageInput.original_url) normalized.original_url = imageInput.original_url
    if (imageInput.variants && typeof imageInput.variants === 'object') {
      normalized.variants = imageInput.variants
    }

    return normalized
  }

  return null
}

const mapUploadedFileToBannerImage = (file) => {
  if (!file) return null

  const originalUrl = file.path || file.secure_url || file.url
  const image = {
    url: buildTransformedCloudinaryUrl(originalUrl, 'f_auto,q_auto,w_1920,c_limit'),
    original_url: originalUrl,
    public_id: file.filename || file.public_id,
    variants: {
      desktop: buildTransformedCloudinaryUrl(originalUrl, 'f_auto,q_auto,w_1920,c_limit'),
      mobile: buildTransformedCloudinaryUrl(originalUrl, 'f_auto,q_auto,w_900,c_limit'),
    },
  }

  return normalizeImageInput(image)
}

const extractPublicId = (image) => {
  if (image && typeof image === 'object' && typeof image.public_id === 'string') {
    return image.public_id
  }
  return null
}

const deleteCloudinaryImageSafe = async (publicId) => {
  if (!publicId) return

  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('[BANNER] Failed to delete Cloudinary image:', publicId, error.message)
  }
}

// لیست بنرها (با فیلتر و صفحه‌بندی)
exports.getBanners = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.position) {
      filter.position = req.query.position
    }

    if (req.query.isActive === 'true') {
      filter.isActive = true
    } else if (req.query.isActive === 'false') {
      filter.isActive = false
    }

    const sort = req.query.sort || 'sortOrder -createdAt'
    const query = Banner.find(filter).sort(sort).skip(skip).limit(limit)
    const [items, total] = await Promise.all([query.lean(), Banner.countDocuments(filter)])

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
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت بنرها',
      error: error.message,
    })
  }
}

// ایجاد بنر
exports.createBanner = async (req, res) => {
  let uploadedPublicId = null

  try {
    const { title, link, position, isActive, image, sortOrder } = req.body || {}

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'عنوان بنر الزامی است',
      })
    }

    let bannerImage = null

    if (req.file) {
      uploadedPublicId = req.file.filename || req.file.public_id || null
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

    res.status(201).json({
      success: true,
      message: 'بنر با موفقیت ایجاد شد',
      data: banner,
    })
  } catch (error) {
    if (uploadedPublicId) {
      await deleteCloudinaryImageSafe(uploadedPublicId)
    }

    console.error('Error creating banner:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد بنر',
      error: error.message,
    })
  }
}

// ویرایش بنر
exports.updateBanner = async (req, res) => {
  let uploadedPublicId = null

  try {
    const updates = req.body || {}
    const banner = await Banner.findById(req.params.id)

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'بنر یافت نشد',
      })
    }

    const oldPublicId = extractPublicId(banner.image)
    let nextImage = undefined

    if (updates.title !== undefined) banner.title = updates.title
    if (updates.link !== undefined) banner.link = updates.link
    if (updates.position !== undefined) banner.position = updates.position
    if (updates.isActive !== undefined) banner.isActive = parseBoolean(updates.isActive, banner.isActive)
    if (updates.sortOrder !== undefined) banner.sortOrder = parseNumber(updates.sortOrder, banner.sortOrder)

    if (req.file) {
      uploadedPublicId = req.file.filename || req.file.public_id || null
      nextImage = mapUploadedFileToBannerImage(req.file)
    } else if (updates.image !== undefined) {
      nextImage = normalizeImageInput(updates.image)
    }

    if (nextImage !== undefined) {
      banner.image = nextImage
    }

    const saved = await banner.save()
    const newPublicId = extractPublicId(saved.image)

    if (oldPublicId && oldPublicId !== newPublicId) {
      await deleteCloudinaryImageSafe(oldPublicId)
    }

    res.json({
      success: true,
      message: 'بنر با موفقیت ویرایش شد',
      data: saved,
    })
  } catch (error) {
    if (uploadedPublicId) {
      await deleteCloudinaryImageSafe(uploadedPublicId)
    }

    console.error('Error updating banner:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ویرایش بنر',
      error: error.message,
    })
  }
}

// حذف بنر
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'بنر یافت نشد',
      })
    }

    const publicId = extractPublicId(banner.image)
    await banner.deleteOne()
    await deleteCloudinaryImageSafe(publicId)

    res.json({
      success: true,
      message: 'بنر با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting banner:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف بنر',
      error: error.message,
    })
  }
}

