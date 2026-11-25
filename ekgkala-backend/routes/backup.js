const express = require('express')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const router = express.Router()

const { protect, authorize, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { getClientIp } = require('../utils/clientIp')
const { RESTORE_UPLOAD_TMP_DIR } = require('../services/backupService')
const {
  getOverview,
  listBackups,
  createServerBackup,
  exportBackup,
  downloadServerBackup,
  deleteServerBackupHandler,
  inspectUploadedBackup,
  inspectStagedBackup,
  executeRestore,
  updateBackupSettings,
} = require('../controllers/backupController')

const BACKUP_TIMEOUT_MS = Number(process.env.BACKUP_TIMEOUT_MS || 15 * 60 * 1000)
const MAX_BACKUP_UPLOAD_BYTES = Number(process.env.BACKUP_MAX_FILE_SIZE || 500 * 1024 * 1024)

const extendBackupTimeout = (req, res, next) => {
  req.setTimeout(BACKUP_TIMEOUT_MS)
  res.setTimeout(BACKUP_TIMEOUT_MS)
  next()
}

const backupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => req.method === 'GET' && (req.path === '/overview' || req.path === '/server'),
  message: {
    success: false,
    message: 'تعداد درخواست‌های بکاپ و بازیابی بیش از حد مجاز است. لطفاً دقایقی صبر کنید.',
  },
})

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      if (!fs.existsSync(RESTORE_UPLOAD_TMP_DIR)) {
        fs.mkdirSync(RESTORE_UPLOAD_TMP_DIR, { recursive: true })
      }
      cb(null, RESTORE_UPLOAD_TMP_DIR)
    } catch (err) {
      cb(err)
    }
  },
  filename: (_req, file, cb) => {
    const lower = String(file.originalname || '').toLowerCase()
    const ext = lower.endsWith('.ekg.enc') ? '.ekg.enc' : '.ekg.gz'
    cb(null, `upload-${crypto.randomUUID()}${ext}`)
  },
})

const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_BACKUP_UPLOAD_BYTES,
    files: 1,
    fieldArrayIndexLimit: 20,
  },
  fileFilter: (_req, file, cb) => {
    const lower = String(file.originalname || '').toLowerCase().trim()
    if (lower.endsWith('.ekg.gz') || lower.endsWith('.ekg.enc')) {
      cb(null, true)
    } else {
      cb(new Error('فقط فایل‌های بکاپ با پسوند .ekg.gz یا .ekg.enc مجاز هستند'))
    }
  },
})

const handleBackupUpload = (req, res, next) => {
  uploadMiddleware.single('backup')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `حجم فایل بکاپ نباید بیشتر از ${Math.round(MAX_BACKUP_UPLOAD_BYTES / (1024 * 1024))} مگابایت باشد`,
        })
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'خطا در دریافت فایل بکاپ',
      })
    }
    return next()
  })
}

// All backup & restore endpoints are strictly restricted to superadmin
router.use(backupLimiter, protect, authorize('superadmin'))

router.get('/overview', checkPermission(PERMISSIONS.BACKUP_READ), getOverview)
router.get('/server', checkPermission(PERMISSIONS.BACKUP_READ), listBackups)
router.get(
  '/server/:filename/download',
  extendBackupTimeout,
  checkPermission(PERMISSIONS.BACKUP_READ),
  downloadServerBackup,
)
router.delete(
  '/server/:filename',
  checkPermission(PERMISSIONS.BACKUP_RESTORE),
  deleteServerBackupHandler,
)

router.post(
  '/create',
  extendBackupTimeout,
  checkPermission(PERMISSIONS.BACKUP_CREATE),
  createServerBackup,
)
router.post(
  '/export',
  extendBackupTimeout,
  checkPermission(PERMISSIONS.BACKUP_CREATE),
  exportBackup,
)

router.post(
  '/inspect',
  extendBackupTimeout,
  checkPermission(PERMISSIONS.BACKUP_RESTORE),
  handleBackupUpload,
  inspectUploadedBackup,
)
router.post(
  '/inspect-staged',
  extendBackupTimeout,
  checkPermission(PERMISSIONS.BACKUP_RESTORE),
  inspectStagedBackup,
)
router.post(
  '/restore',
  extendBackupTimeout,
  checkPermission(PERMISSIONS.BACKUP_RESTORE),
  executeRestore,
)

router.put(
  '/settings',
  checkPermission(PERMISSIONS.SETTINGS_UPDATE),
  updateBackupSettings,
)

module.exports = router
