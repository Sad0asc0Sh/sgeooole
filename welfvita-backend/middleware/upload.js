const multer = require('multer')
const { v2: cloudinary } = require('cloudinary')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const crypto = require('crypto')
const path = require('path')

// ============================================
// Cloudinary Configuration
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ============================================
// Security: Allowed File Types (Whitelist)
// ============================================
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

// ============================================
// Security: Generate Safe Filename (UUID)
// Prevents directory traversal and shell injection
// ============================================
const generateSafeFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase()
  const uuid = crypto.randomUUID()
  return `${uuid}${ext}`
}

// ============================================
// Cloudinary Storage with Security Enhancements
// ============================================
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = 'welfvita/uploads'

    // Determine folder based on field type
    if (file.fieldname === 'icon' || file.fieldname === 'image') {
      folder = 'welfvita/categories'
    } else if (file.fieldname === 'logo') {
      folder = 'welfvita/brands'
    } else if (file.fieldname === 'avatar') {
      folder = 'welfvita/avatars'
    } else if (file.fieldname === 'images') {
      folder = 'welfvita/products'
    } else if (file.fieldname === 'banner') {
      folder = 'welfvita/banners'
    }

    // Generate safe public_id (prevents injection attacks)
    const safePublicId = crypto.randomUUID()

    return {
      folder,
      resource_type: 'image',
      public_id: safePublicId,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    }
  },
})

// ============================================
// File Filter with Strict Validation
// ============================================
const secureFileFilter = (req, file, cb) => {
  // 1. Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error('فرمت فایل نامعتبر است. فقط تصاویر (jpg, jpeg, png, webp, gif) مجاز هستند.'),
      false
    )
  }

  // 2. Check file extension
  const ext = path.extname(file.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error('پسوند فایل نامعتبر است. فقط jpg, jpeg, png, webp, gif مجاز هستند.'),
      false
    )
  }

  // 3. Check for suspicious patterns (double extensions, null bytes)
  const suspiciousPatterns = [
    /\.php/i,
    /\.asp/i,
    /\.exe/i,
    /\.sh/i,
    /\.bat/i,
    /\.js$/i,
    /\0/, // null byte
    /\.\./,  // directory traversal
  ]

  const originalName = file.originalname
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(originalName)) {
      console.warn(`[SECURITY] Blocked suspicious file upload: ${originalName}`)
      return cb(new Error('نام فایل نامعتبر است.'), false)
    }
  }

  cb(null, true)
}

// ============================================
// Multer Upload Instance
// ============================================
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max per file
    files: 10, // Max 10 files per request
  },
  fileFilter: secureFileFilter,
})

// ============================================
// Exports
// ============================================
module.exports = {
  upload,
  cloudinary,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
}
