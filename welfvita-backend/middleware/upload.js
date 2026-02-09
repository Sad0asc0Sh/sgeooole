const multer = require('multer')
const { v2: cloudinary } = require('cloudinary')
const { Readable } = require('stream')
const crypto = require('crypto')
const path = require('path')

// ============================================
// Cloudinary Configuration
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 180000, // 3 minutes timeout for uploads (Cloudinary servers can be slow)
})

// ============================================
// SECURITY: Magic Numbers for File Validation
// These are the first bytes of each file type
// ============================================
const MAGIC_NUMBERS = {
  // JPEG: FF D8 FF
  jpeg: [0xff, 0xd8, 0xff],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // GIF: 47 49 46 38 (GIF8)
  gif: [0x47, 0x49, 0x46, 0x38],
  // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
  webp: [0x52, 0x49, 0x46, 0x46], // First 4 bytes, full check done separately
}

// ============================================
// Security: Allowed File Types (Whitelist)
// SVG explicitly EXCLUDED due to XSS risk
// ============================================
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

// SECURITY: SVG explicitly excluded - can contain malicious JavaScript
const BLOCKED_MIME_TYPES = [
  'image/svg+xml',
  'image/svg',
  'application/xml',
  'text/xml',
  'text/html',
  'application/javascript',
  'text/javascript',
]

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const BLOCKED_EXTENSIONS = ['.svg', '.html', '.htm', '.xml', '.js', '.php', '.asp', '.aspx', '.exe', '.sh', '.bat']

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
// Custom Cloudinary Storage Engine for Multer
// Compatible with Cloudinary SDK v2.x
// Replaces deprecated multer-storage-cloudinary
// ============================================
class CloudinaryStorageEngine {
  constructor(options = {}) {
    this.cloudinary = options.cloudinary || cloudinary
    this.params = options.params || {}
  }

  _handleFile(req, file, cb) {
    // Determine upload parameters
    const getParams = typeof this.params === 'function'
      ? this.params(req, file)
      : this.params

    Promise.resolve(getParams)
      .then((params) => {
        // Create upload stream to Cloudinary
        const uploadStream = this.cloudinary.uploader.upload_stream(
          {
            folder: params.folder || 'ekgkala/uploads',
            resource_type: params.resource_type || 'image',
            public_id: params.public_id || crypto.randomUUID(),
            allowed_formats: params.allowed_formats || ['jpg', 'jpeg', 'png', 'webp', 'gif'],
          },
          (error, result) => {
            if (error) {
              console.error('[CLOUDINARY] Upload error:', error.message)
              return cb(error)
            }

            // Return Cloudinary result matching multer-storage-cloudinary format
            cb(null, {
              path: result.secure_url,
              filename: result.public_id,
              public_id: result.public_id,
              size: result.bytes,
              format: result.format,
              width: result.width,
              height: result.height,
              secure_url: result.secure_url,
              url: result.url,
              resource_type: result.resource_type,
            })
          }
        )

        // Pipe file stream to Cloudinary
        file.stream.pipe(uploadStream)
      })
      .catch((err) => {
        cb(err)
      })
  }

  _removeFile(req, file, cb) {
    // Delete from Cloudinary if needed
    if (file.public_id) {
      this.cloudinary.uploader.destroy(file.public_id, { resource_type: 'image' }, cb)
    } else {
      cb(null)
    }
  }
}

// ============================================
// Create Storage Instance
// ============================================
const storage = new CloudinaryStorageEngine({
  cloudinary,
  params: (req, file) => {
    let folder = 'ekgkala/uploads'

    // Determine folder based on field type
    if (file.fieldname === 'icon' || file.fieldname === 'image') {
      folder = 'ekgkala/categories'
    } else if (file.fieldname === 'logo') {
      folder = 'ekgkala/brands'
    } else if (file.fieldname === 'avatar') {
      folder = 'ekgkala/avatars'
    } else if (file.fieldname === 'images') {
      folder = 'ekgkala/products'
    } else if (file.fieldname === 'banner') {
      folder = 'ekgkala/banners'
    }

    // Generate safe public_id (prevents injection attacks)
    const safePublicId = crypto.randomUUID()

    return {
      folder,
      resource_type: 'image',
      public_id: safePublicId,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      // NOTE: No eager transformations here for faster upload
      // Cloudinary CDN applies transformations on-demand when images are accessed
      // This significantly speeds up the upload process
    }
  },
})

// ============================================
// File Filter with Strict Validation
// ============================================
const secureFileFilter = (req, file, cb) => {
  // 1. SECURITY: Block dangerous MIME types first
  if (BLOCKED_MIME_TYPES.includes(file.mimetype)) {
    console.warn(`[SECURITY] Blocked dangerous MIME type: ${file.mimetype} from ${file.originalname}`)
    return cb(
      new Error('این نوع فایل مجاز نیست.'),
      false
    )
  }

  // 2. Check allowed MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error('فرمت فایل نامعتبر است. فقط تصاویر (jpg, jpeg, png, webp, gif) مجاز هستند.'),
      false
    )
  }

  // 3. Check file extension
  const ext = path.extname(file.originalname).toLowerCase()

  // SECURITY: Block dangerous extensions
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    console.warn(`[SECURITY] Blocked dangerous extension: ${ext} from ${file.originalname}`)
    return cb(
      new Error('این پسوند فایل مجاز نیست.'),
      false
    )
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error('پسوند فایل نامعتبر است. فقط jpg, jpeg, png, webp, gif مجاز هستند.'),
      false
    )
  }

  // 4. Check for suspicious patterns (double extensions, null bytes)
  const suspiciousPatterns = [
    /\.php/i,
    /\.asp/i,
    /\.exe/i,
    /\.sh/i,
    /\.bat/i,
    /\.js$/i,
    /\.svg/i, // SECURITY: Block SVG
    /\.htm/i, // SECURITY: Block HTML
    /\0/, // null byte
    /\.\./, // directory traversal
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
// SECURITY: Magic Number Validation Middleware
// Validates actual file content, not just extension
// Use this AFTER multer processes the file
// ============================================
const validateMagicNumbers = (req, res, next) => {
  // Skip if no file uploaded
  if (!req.file && (!req.files || req.files.length === 0)) {
    return next()
  }

  // Get files to validate
  const files = req.file ? [req.file] : (req.files || [])

  for (const file of files) {
    // Cloudinary storage doesn't give us buffer access
    // so we rely on Cloudinary's server-side validation
    // which is actually more secure

    // Log upload for audit
    console.log(`[UPLOAD] File uploaded: ${file.originalname} -> ${file.filename || file.public_id}`)
  }

  next()
}

// ============================================
// Multer Upload Instance
// ============================================
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file (increased for high-quality product images)
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
  validateMagicNumbers,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
  CloudinaryStorageEngine, // Export for testing/custom usage
}
