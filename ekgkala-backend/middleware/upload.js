const multer = require('multer')
const crypto = require('crypto')
const path = require('path')
const { uploadToParsPack, deleteFromParsPack, getPublicUrl } = require('../lib/parspackS3')

// ============================================
// تنظیمات حجم فایل
// ============================================
const DEFAULT_MAX_UPLOAD_FILE_SIZE_MB = 10
const parsedMaxUploadFileSizeMb = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB)
const MAX_UPLOAD_FILE_SIZE_MB =
  Number.isFinite(parsedMaxUploadFileSizeMb) && parsedMaxUploadFileSizeMb > 0
    ? parsedMaxUploadFileSizeMb
    : DEFAULT_MAX_UPLOAD_FILE_SIZE_MB
const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024

// ============================================
// مسیر ذخیره‌سازی
// ============================================
const UPLOAD_BASE_PATH = process.env.UPLOAD_BASE_PATH || '/var/www/ekgkala/uploads';

// ============================================
// لیست MIME و extension های مجاز
// ============================================
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

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

const BLOCKED_EXTENSIONS = [
  '.svg', '.html', '.htm', '.xml', '.js',
  '.php', '.asp', '.aspx', '.exe', '.sh', '.bat',
]

// ============================================
// تولید نام امن
// ============================================
const generateSafeFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase()
  const uuid = crypto.randomUUID()
  return `${uuid}${ext}`
}

// ============================================
// Memory Storage (buffer available for ParsPack upload)
// ============================================
const storage = multer.memoryStorage()

// ============================================
// File Filter
// ============================================
const secureFileFilter = (req, file, cb) => {
  const mime = file.mimetype?.toLowerCase()
  const ext = path.extname(file.originalname).toLowerCase()
  const originalName = file.originalname?.toLowerCase() || ''

  // block dangerous mime
  if (BLOCKED_MIME_TYPES.includes(mime)) {
    return cb(new Error(`نوع فایل ${mime} مجاز نیست`))
  }

  // allow only image mime
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    return cb(new Error('فقط فایل‌های تصویری مجاز هستند'))
  }

  // check extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`پسوند ${ext} مجاز نیست`))
  }

  // block dangerous extensions
  if (BLOCKED_EXTENSIONS.some((blocked) => originalName.includes(blocked))) {
    return cb(new Error('فایل مشکوک شناسایی شد'))
  }

  // block suspicious patterns
  const suspiciousPatterns = [/\.php/i, /\.asp/i, /\.exe/i, /\.sh/i, /\.bat/i, /\.js$/i, /\.svg/i, /\.htm/i, /\0/, /\.\./]
  if (suspiciousPatterns.some((p) => p.test(originalName))) {
    return cb(new Error('نام فایل مشکوک است'))
  }

  cb(null, true)
}

// ============================================
// Multer instance
// ============================================
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    files: 10,
  },
  fileFilter: secureFileFilter,
})

// ============================================
// normalizeFileUrl middleware
// URL محلی را به req.file.url اضافه می‌کند
// ============================================
const normalizeFileUrl = (req, res, next) => {
  if (req.file) {
    if (!req.file.filename) {
      req.file.filename = generateSafeFilename(req.file.originalname)
    }
  }

  if (req.files && Array.isArray(req.files)) {
    req.files.forEach((file) => {
      if (!file.filename) {
        file.filename = generateSafeFilename(file.originalname)
      }
    })
  }

  next()
}

// ============================================
// validateMagicNumbers middleware (log only)
// ============================================
const validateMagicNumbers = (req, res, next) => {
  if (!req.file && (!req.files || req.files.length === 0)) {
    return next()
  }

  const files = req.file ? [req.file] : req.files || []
  for (const file of files) {
    console.log(`[UPLOAD] File saved: ${file.originalname} -> ${file.filename}`)
  }

  next()
}

module.exports = {
  upload,
  normalizeFileUrl,
  validateMagicNumbers,
  uploadToParsPack,
  deleteFromParsPack,
  getPublicUrl,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
  MAX_UPLOAD_FILE_SIZE_MB,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  UPLOAD_BASE_PATH,
}
