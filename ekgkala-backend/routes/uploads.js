const express = require('express')
const router = express.Router()
const { upload, cloudinary } = require('../middleware/upload')
const { protect, checkPermission, checkAnyPermission, PERMISSIONS } = require('../middleware/auth')

const buildTransformedCloudinaryUrl = (url, transform) => {
    if (!url || typeof url !== 'string') return url
    if (!url.includes('/upload/')) return url
    return url.replace('/upload/', `/upload/${transform}/`)
}

const extractImageInfo = (file) => {
    const originalUrl = file.path || file.secure_url || file.url
    return {
        url: originalUrl,
        public_id: file.filename || file.public_id,
    }
}

const extractBannerImageInfo = (file) => {
    const base = extractImageInfo(file)
    const originalUrl = base.url
    return {
        ...base,
        original_url: originalUrl,
        // Optimized delivery URLs from Cloudinary CDN
        url: buildTransformedCloudinaryUrl(originalUrl, 'f_auto,q_auto,w_1920,c_limit'),
        variants: {
            desktop: buildTransformedCloudinaryUrl(originalUrl, 'f_auto,q_auto,w_1920,c_limit'),
            mobile: buildTransformedCloudinaryUrl(originalUrl, 'f_auto,q_auto,w_900,c_limit'),
        },
    }
}

// ============================================
// POST /api/uploads/image
// Immediate image upload to Cloudinary
// Returns the uploaded image URL and public_id
// ============================================
router.post(
    '/image',
    protect,
    checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'هیچ فایلی آپلود نشده است',
                })
            }

            // Extract image info from Cloudinary response
            console.log('[UPLOAD] File received:', {
                path: req.file.path,
                secure_url: req.file.secure_url,
                url: req.file.url,
                filename: req.file.filename,
                public_id: req.file.public_id,
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
// POST /api/uploads/banner
// Immediate banner upload to Cloudinary with optimized delivery URLs
// ============================================
router.post(
    '/banner',
    protect,
    checkAnyPermission(
        PERMISSIONS.BANNER_CREATE,
        PERMISSIONS.BANNER_UPDATE,
        PERMISSIONS.PRODUCT_MANAGE_IMAGES
    ),
    upload.single('image'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'هیچ فایل بنری آپلود نشده است',
                })
            }

            const imageInfo = extractBannerImageInfo(req.file)

            res.json({
                success: true,
                message: 'تصویر بنر با موفقیت آپلود شد',
                data: imageInfo,
            })
        } catch (error) {
            console.error('Error uploading banner image:', error)
            res.status(500).json({
                success: false,
                message: 'خطا در آپلود تصویر بنر',
                error: error.message,
            })
        }
    }
)

// ============================================
// POST /api/uploads/images (multiple)
// Immediate multiple images upload to Cloudinary
// ============================================
router.post(
    '/images',
    protect,
    checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
    upload.array('images', 10),
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'هیچ فایلی آپلود نشده است',
                })
            }

            // Extract image info from each uploaded file
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
// DELETE /api/uploads/image/:publicId(*)
// Delete an uploaded image from Cloudinary
// Note: publicId can contain slashes (e.g., ekgkala/products/uuid)
// ============================================
router.delete(
    '/image/*',
    protect,
    checkAnyPermission(
        PERMISSIONS.PRODUCT_MANAGE_IMAGES,
        PERMISSIONS.BANNER_CREATE,
        PERMISSIONS.BANNER_UPDATE,
        PERMISSIONS.BANNER_DELETE
    ),
    async (req, res) => {
        try {
            // Get publicId from the wildcard param (everything after /image/)
            const publicId = req.params[0]

            if (!publicId) {
                return res.status(400).json({
                    success: false,
                    message: 'شناسه تصویر ارائه نشده است',
                })
            }

            console.log('[DELETE IMAGE] Deleting from Cloudinary:', publicId)
            const result = await cloudinary.uploader.destroy(publicId)
            console.log('[DELETE IMAGE] Cloudinary result:', result)

            if (result.result === 'ok' || result.result === 'not found') {
                res.json({
                    success: true,
                    message: 'تصویر با موفقیت حذف شد',
                })
            } else {
                res.status(400).json({
                    success: false,
                    message: 'خطا در حذف تصویر',
                    result,
                })
            }
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
