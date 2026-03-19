const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const { upload, normalizeFileUrl, MAX_UPLOAD_FILE_SIZE_MB, UPLOAD_BASE_PATH } = require('../middleware/upload')
const { protect, checkPermission, checkAnyPermission, PERMISSIONS } = require('../middleware/auth')

// ============================================
// Helper: خواندن ابعاد تصویر بدون پکیج خارجی
// ============================================
const getImageDimensions = (filePath) => {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(24)
    fs.readSync(fd, buf, 0, 24, 0)
    fs.closeSync(fd)

    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }

    // JPEG
    const fullBuf = fs.readFileSync(filePath)
    let offset = 2
    while (offset < fullBuf.length) {
      if (fullBuf[offset] !== 0xff) break
      const marker = fullBuf[offset + 1]
      const segLen = fullBuf.readUInt16BE(offset + 2)
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { height: fullBuf.readUInt16BE(offset + 5), width: fullBuf.readUInt16BE(offset + 7) }
      }
      offset += 2 + segLen
    }

    return { width: null, height: null }
  } catch (e) {
    return { width: null, height: null }
  }
}

// ============================================
// Helper: تبدیل فایل به { url, public_id, width, height }
// ============================================
const extractImageInfo = (file) => {
  if (!file) return null
  const dims = file.path ? getImageDimensions(file.path) : { width: null, height: null }
  return {
    url: file.url || `/uploads/${file.filename}`,
    public_id: file.filename,
    width: dims.width,
    height: dims.height,
  }
}

// ============================================
// Middleware: آپلود تک تصویر با مدیریت خطا
// ============================================
const handleSingleImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `حجم فایل نباید بیشتر از ${MAX_UPLOAD_FILE_SIZE_MB} مگابایت باشد`,
        })
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'خطا در آپلود فایل',
      })
    }
    normalizeFileUrl(req, res, next)
  })
}

// ============================================
// Middleware: آپلود چند تصویر با مدیریت خطا
// ============================================
const handleMultipleImagesUpload = (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `حجم فایل نباید بیشتر از ${MAX_UPLOAD_FILE_SIZE_MB} مگابایت باشد`,
        })
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'خطا در آپلود فایل‌ها',
      })
    }
    normalizeFileUrl(req, res, next)
  })
}

// ============================================
// POST /api/uploads/image — تک تصویر محصول
// ============================================
router.post(
  '/image',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  handleSingleImageUpload,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'هیچ فایلی آپلود نشده است',
        })
      }

      console.log('[UPLOAD] File received:', {
        path: req.file.path,
        url: req.file.url,
        filename: req.file.filename,
        originalname: req.file.originalname,
      })

      const imageInfo = extractImageInfo(req.file)
      console.log('[UPLOAD] Returning:', imageInfo)

      res.json({
        success: true,
        message: 'تصویر با موفقیت آپلود شد',
        data: imageInfo,
      })
    } catch (error) {
      console.error('Error uploading image:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در آپلود تصویر',
        error: error.message,
      })
    }
  }
)

// ============================================
// POST /api/uploads/images — چند تصویر محصول
// ============================================
router.post(
  '/images',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  handleMultipleImagesUpload,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'هیچ فایلی آپلود نشده است',
        })
      }

      const uploadedImages = req.files.map((file) => extractImageInfo(file))

      res.json({
        success: true,
        message: `${uploadedImages.length} تصویر با موفقیت آپلود شد`,
        data: uploadedImages,
      })
    } catch (error) {
      console.error('Error uploading images:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در آپلود تصاویر',
        error: error.message,
      })
    }
  }
)

// ============================================
// POST /api/uploads/banner — آپلود بنر
// ============================================
router.post(
  '/banner',
  protect,
  checkAnyPermission(PERMISSIONS.BANNER_CREATE, PERMISSIONS.BANNER_UPDATE),
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `حجم فایل نباید بیشتر از ${MAX_UPLOAD_FILE_SIZE_MB} مگابایت باشد`,
          })
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'خطا در آپلود بنر',
        })
      }
      normalizeFileUrl(req, res, next)
    })
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'هیچ فایلی آپلود نشده است',
        })
      }

      const imageInfo = extractImageInfo(req.file)

      res.json({
        success: true,
        message: 'بنر با موفقیت آپلود شد',
        data: imageInfo,
      })
    } catch (error) {
      console.error('Error uploading banner:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در آپلود بنر',
        error: error.message,
      })
    }
  }
)

// ============================================
// DELETE /api/uploads/image/:filename — حذف تصویر
// ============================================
router.delete(
  '/image/:filename',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  async (req, res) => {
    try {
      const { filename } = req.params

      if (!filename) {
        return res.status(400).json({
          success: false,
          message: 'نام فایل مشخص نشده است',
        })
      }

      const filePath = path.join(UPLOAD_BASE_PATH, filename)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'فایل یافت نشد',
        })
      }

      fs.unlinkSync(filePath)

      res.json({
        success: true,
        message: 'تصویر با موفقیت حذف شد',
      })
    } catch (error) {
      console.error('Error deleting image:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در حذف تصویر',
        error: error.message,
      })
    }
  }
)

module.exports = router
