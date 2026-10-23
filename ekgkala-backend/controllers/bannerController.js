const Banner = require('../models/Banner')
const { uploadToParsPack, deleteFromParsPack } = require('../lib/parspackS3')

// ============================================
// Helpers
// ============================================

const ALLOWED_POSITIONS = new Set(['main-slider', 'middle-banner', 'campaign-banner'])
const ALLOWED_FITS = new Set(['cover', 'contain'])

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false
  }
  return Boolean(value)
}

const parseNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parsePositiveInteger = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.round(parsed)
}

const parseImageMeta = (body, prefix) => {
  const width = parsePositiveInteger(body?.[`${prefix}Width`])
  const height = parsePositiveInteger(body?.[`${prefix}Height`])
  return { width, height }
}

const attachImageMeta = (image, meta) => {
  if (!image) return null
  if (meta?.width) image.width = meta.width
  if (meta?.height) image.height = meta.height
  return image
}

/**
 * ورودی تصویر می‌تواند یکی از این‌ها باشد:
 * - رشتهٔ URL
 * - رشتهٔ JSON (وقتی از FormData می‌آید)
 * - آبجکت { url, public_id, filename, width, height }
 *
 * فیلدهای ناشناخته دور ریخته می‌شوند تا چیز اضافه‌ای در دیتابیس ذخیره نشود.
 */
const normalizeImageInput = (imageInput) => {
  if (imageInput === undefined) return undefined
  if (imageInput === null || imageInput === '') return null

  let input = imageInput

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('{')) {
      try {
        input = JSON.parse(trimmed)
      } catch (_) {
        return { url: trimmed }
      }
    } else {
      return { url: trimmed }
    }
  }

  if (typeof input === 'object' && input && typeof input.url === 'string') {
    const url = input.url.trim()
    if (!url) return null

    const image = { url }
    if (input.public_id) image.public_id = String(input.public_id)
    if (input.filename) image.filename = String(input.filename)

    const width = parsePositiveInteger(input.width)
    const height = parsePositiveInteger(input.height)
    if (width) image.width = width
    if (height) image.height = height

    return image
  }

  return null
}

const normalizeLink = (value) => {
  const link = String(value || '').trim().slice(0, 2048)
  // جلوگیری از ذخیرهٔ URLهای اجرایی؛ فرانت هم این‌ها را بلاک می‌کند.
  if (/^(javascript|data|vbscript):/i.test(link)) return ''
  return link
}

const normalizeImageAlt = (value, fallback = '') => {
  const alt = String(value ?? fallback ?? '').trim().slice(0, 200)
  return alt
}

// آپلود فایل multer (memoryStorage) به ParsPack و برگرداندن ساختار image بنر
const mapUploadedFileToBannerImage = async (file) => {
  if (!file) return null
  const result = await uploadToParsPack(file.buffer, file.originalname)
  return {
    url: result.url,
    public_id: result.filename,
    filename: result.filename,
  }
}

const getImageFilename = (image) => {
  if (!image || typeof image !== 'object') return null
  return image.filename || image.public_id || null
}

// دو تصویر را یکسان می‌داند اگر filename یکی باشد یا (در نبود filename) URL یکی باشد.
// این کار از حذف اشتباهی فایل وقتی کلاینت فقط URL را دوباره می‌فرستد جلوگیری می‌کند.
const imagesShareSource = (left, right) => {
  if (!left || !right) return false
  const leftFilename = getImageFilename(left)
  const rightFilename = getImageFilename(right)
  if (leftFilename && rightFilename) return leftFilename === rightFilename
  return String(left.url || '') === String(right.url || '')
}

// حذف تصویر از ParsPack (بدون پرتاب خطا تا ذخیرهٔ بنر را خراب نکند)
const deleteImageSafe = async (image) => {
  const filename = getImageFilename(image)
  if (!filename) return
  try {
    await deleteFromParsPack(filename)
    console.log('[BANNER] Deleted from ParsPack:', filename)
  } catch (error) {
    console.error('[BANNER] Failed to delete from ParsPack:', filename, error.message)
  }
}

const deleteImagesSafe = async (images = []) => {
  const seen = new Set()
  for (const image of images) {
    const filename = getImageFilename(image)
    if (!filename || seen.has(filename)) continue
    seen.add(filename)
    await deleteImageSafe(image)
  }
}

const collectRequestImages = (req) => {
  const filesByField =
    req.files && !Array.isArray(req.files) ? req.files : {}

  return {
    desktopFile: filesByField.image?.[0] || req.file || null,
    mobileFile: filesByField.mobileImage?.[0] || null,
  }
}

const resolvePosition = (value, fallback = 'main-slider') => {
  const position = String(value || '').trim()
  return ALLOWED_POSITIONS.has(position) ? position : fallback
}

const resolveFit = (value, fallback = 'cover') => {
  const fit = String(value || '').trim()
  return ALLOWED_FITS.has(fit) ? fit : fallback
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
  const uploadedImages = []

  try {
    const body = req.body || {}
    const { title, link, position, isActive, image, mobileImage, sortOrder } = body

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'عنوان بنر الزامی است' })
    }

    const { desktopFile, mobileFile } = collectRequestImages(req)

    let desktopImage = null
    let mobileImageValue = null

    if (desktopFile) {
      desktopImage = await mapUploadedFileToBannerImage(desktopFile)
      uploadedImages.push(desktopImage)
    } else {
      desktopImage = normalizeImageInput(image) ?? null
    }

    if (mobileFile) {
      mobileImageValue = await mapUploadedFileToBannerImage(mobileFile)
      uploadedImages.push(mobileImageValue)
    } else {
      mobileImageValue = normalizeImageInput(mobileImage) ?? null
    }

    if (desktopImage) {
      attachImageMeta(desktopImage, parseImageMeta(body, 'image'))
    }
    if (mobileImageValue) {
      attachImageMeta(mobileImageValue, parseImageMeta(body, 'mobileImage'))
    }

    const resolvedPosition = resolvePosition(position, 'main-slider')
    const resolvedAlt = normalizeImageAlt(body.alt, title)
    const resolvedMobileAlt = normalizeImageAlt(body.mobileAlt, resolvedAlt)

    const banner = await Banner.create({
      title: String(title).trim(),
      link: normalizeLink(link),
      position: resolvedPosition,
      isActive: parseBoolean(isActive, true),
      image: desktopImage,
      mobileImage: mobileImageValue,
      alt: resolvedAlt,
      mobileAlt: resolvedMobileAlt,
      fit: resolveFit(body.fit, 'cover'),
      openInNewTab: parseBoolean(body.openInNewTab, false),
      sortOrder: parseNumber(sortOrder, 0),
    })

    res.status(201).json({ success: true, message: 'بنر با موفقیت ایجاد شد', data: banner })
  } catch (error) {
    // اگر بنر ذخیره نشد، فایل‌های آپلودشده را پاک می‌کنیم
    await deleteImagesSafe(uploadedImages)

    console.error('Error creating banner:', error)
    res.status(500).json({ success: false, message: 'خطا در ایجاد بنر', error: error.message })
  }
}

// PUT /api/banners/:id
exports.updateBanner = async (req, res) => {
  const newlyUploadedImages = []

  try {
    const body = req.body || {}
    const banner = await Banner.findById(req.params.id)

    if (!banner) {
      return res.status(404).json({ success: false, message: 'بنر یافت نشد' })
    }

    const oldImage = banner.image
    const oldMobileImage = banner.mobileImage

    if (body.title !== undefined && !String(body.title || '').trim()) {
      return res.status(400).json({ success: false, message: 'عنوان بنر الزامی است' })
    }

    const { desktopFile, mobileFile } = collectRequestImages(req)

    let nextImage = undefined
    let nextMobileImage = undefined

    if (desktopFile) {
      nextImage = await mapUploadedFileToBannerImage(desktopFile)
      if (nextImage) newlyUploadedImages.push(nextImage)
    } else if (Object.prototype.hasOwnProperty.call(body, 'image')) {
      nextImage = normalizeImageInput(body.image) ?? null
    }

    if (mobileFile) {
      nextMobileImage = await mapUploadedFileToBannerImage(mobileFile)
      if (nextMobileImage) newlyUploadedImages.push(nextMobileImage)
    } else if (Object.prototype.hasOwnProperty.call(body, 'mobileImage')) {
      nextMobileImage = normalizeImageInput(body.mobileImage) ?? null
    }

    if (nextImage) {
      attachImageMeta(nextImage, parseImageMeta(body, 'image'))
    }
    if (nextMobileImage) {
      attachImageMeta(nextMobileImage, parseImageMeta(body, 'mobileImage'))
    }

    if (body.title !== undefined) {
      const nextTitle = String(body.title || '').trim()
      if (!nextTitle) {
        return res.status(400).json({ success: false, message: 'عنوان بنر الزامی است' })
      }
      banner.title = nextTitle
    }
    if (body.link !== undefined) banner.link = normalizeLink(body.link)
    if (body.position !== undefined) banner.position = resolvePosition(body.position, banner.position)
    if (body.isActive !== undefined) banner.isActive = parseBoolean(body.isActive, banner.isActive)
    if (body.sortOrder !== undefined) banner.sortOrder = parseNumber(body.sortOrder, banner.sortOrder)
    if (body.fit !== undefined) banner.fit = resolveFit(body.fit, banner.fit)
    if (body.openInNewTab !== undefined) {
      banner.openInNewTab = parseBoolean(body.openInNewTab, banner.openInNewTab)
    }
    if (body.alt !== undefined) banner.alt = normalizeImageAlt(body.alt, banner.title)
    if (body.mobileAlt !== undefined) banner.mobileAlt = normalizeImageAlt(body.mobileAlt, banner.alt || banner.title)

    if (nextImage !== undefined) banner.image = nextImage
    if (nextMobileImage !== undefined) banner.mobileImage = nextMobileImage

    const saved = await banner.save()

    // تنها تصاویری را حذف می‌کنیم که واقعاً جایگزین یا پاک شده‌اند.
    if (nextImage !== undefined && !imagesShareSource(oldImage, nextImage)) {
      await deleteImageSafe(oldImage)
    }
    if (nextMobileImage !== undefined && !imagesShareSource(oldMobileImage, nextMobileImage)) {
      await deleteImageSafe(oldMobileImage)
    }

    res.json({ success: true, message: 'بنر با موفقیت ویرایش شد', data: saved })
  } catch (error) {
    await deleteImagesSafe(newlyUploadedImages)

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

    const imagesToDelete = [banner.image, banner.mobileImage]
    await banner.deleteOne()
    await deleteImagesSafe(imagesToDelete)

    res.json({ success: true, message: 'بنر با موفقیت حذف شد' })
  } catch (error) {
    console.error('Error deleting banner:', error)
    res.status(500).json({ success: false, message: 'خطا در حذف بنر', error: error.message })
  }
}
