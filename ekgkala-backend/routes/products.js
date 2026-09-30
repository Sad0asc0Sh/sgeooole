const express = require('express')
const router = express.Router()
const ExcelJS = require('exceljs')
const csv = require('csv-parser')
const fs = require('fs')
const multer = require('multer')
const path = require('path')

const Product = require('../models/Product')
const Sale = require('../models/Sale')
const Category = require('../models/Category')
const Brand = require('../models/Brand')
const { listProducts, ListingQueryError } = require('../services/productListingService')
const { findActiveSalesForProduct, getSaleMemberProductIds } = require('../services/campaignConflictService')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { upload, uploadToParsPack, deleteFromParsPack } = require('../middleware/upload')
const { cacheMiddleware, clearCacheByKey, clearCacheByPrefix, CACHE_TTL } = require('../middleware/cache')

// ============================================
// Persian/Arabic Character Normalization for Search
// Converts search text to regex that matches both Arabic and Persian character variants
// ============================================
function buildPersianSearchRegex(text) {
  if (!text) return text

  // Define character equivalence groups
  const equivalences = [
    ['ی', 'ي', 'ئ'],           // ی فارسی ↔ ي عربی ↔ ئ
    ['ک', 'ك'],                // ک فارسی ↔ ك عربی
    ['ه', 'ة'],                // ه ↔ ة
    ['آ', 'أ', 'إ', 'ا'],         // آ ↔ أ ↔ إ ↔ ا
    ['و', 'ؤ'],                // و ↔ ؤ
    ['۰', '٠', '0'],           // ۰ ↔ ٠ ↔ 0
    ['۱', '١', '1'],           // ۱ ↔ ١ ↔ 1
    ['۲', '٢', '2'],           // ۲ ↔ ٢ ↔ 2
    ['۳', '٣', '3'],           // ۳ ↔ ٣ ↔ 3
    ['۴', '٤', '4'],           // ۴ ↔ ٤ ↔ 4
    ['۵', '٥', '5'],           // ۵ ↔ ٥ ↔ 5
    ['۶', '٦', '6'],           // ۶ ↔ ٦ ↔ 6
    ['۷', '٧', '7'],           // ۷ ↔ ٧ ↔ 7
    ['۸', '٨', '8'],           // ۸ ↔ ٨ ↔ 8
    ['۹', '٩', '9'],           // ۹ ↔ ٩ ↔ 9
  ]

  // Build char-to-group map
  const charMap = new Map()
  for (const group of equivalences) {
    const charClass = `[${group.join('')}]`
    for (const ch of group) {
      charMap.set(ch, charClass)
    }
  }

  // Special regex characters that need escaping
  const regexSpecial = /[.*+?^${}()|[\]\\]/g

  let pattern = ''
  for (const ch of text) {
    if (charMap.has(ch)) {
      pattern += charMap.get(ch)
    } else if (regexSpecial.test(ch)) {
      pattern += '\\' + ch
    } else {
      pattern += ch
    }
  }

  return pattern
}

// Joi Validation
const validate = require('../middleware/validate')
const {
  productCreateSchema,
  productUpdateSchema,
} = require('../validators/joiSchemas/productSchemas')

// Multer configuration for CSV upload (local storage)
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/csv')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname))
  },
})

const csvUpload = multer({
  storage: csvStorage,
  limits: {
    // 25MB default - override with env for larger catalogs
    fileSize: Number(process.env.CSV_IMPORT_MAX_FILE_SIZE || 25 * 1024 * 1024),
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ])

    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedMimeTypes.has(file.mimetype) || ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('فقط فایل‌های CSV و Excel (.xlsx) مجاز هستند'))
    }
  },
})

const CSV_IMPORT_TIMEOUT_MS = Number(process.env.CSV_IMPORT_TIMEOUT_MS || 15 * 60 * 1000)
const CSV_IMPORT_BATCH_SIZE = Number(process.env.CSV_IMPORT_BATCH_SIZE || 500)

const safeUnlink = (targetPath) => {
  if (!targetPath) return
  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath)
    }
  } catch (unlinkError) {
    console.error(`Failed to clean temp file: ${targetPath}`, unlinkError.message)
  }
}

const normalizeDigits = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
}

const normalizePersianText = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/[​‌‍﻿]/g, ' ')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[آأإ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const parseCsvNumber = (value, fallback = 0, currency = 'toman') => {
  if (value === undefined || value === null || value === '') return fallback
  let str = normalizeDigits(value).trim()

  // Remove currency words and symbols
  str = str.replace(/(تومان|ریال|ت|ر|IRR|TOMAN|IR[RT])/gi, '').trim()

  // Remove spaces and invisible characters
  str = str.replace(/[\s ​‌﻿]/g, '')

  // Replace Persian/Arabic momayyez (٫) with dot
  str = str.replace(/٫/g, '.')
  // Remove Arabic thousands separator (٬)
  str = str.replace(/٬/g, '')

  // Check if both comma and dot exist
  const hasComma = str.includes(',')
  const hasDot = str.includes('.')

  if (hasComma && hasDot) {
    const firstComma = str.indexOf(',')
    const firstDot = str.indexOf('.')
    if (firstComma < firstDot) {
      // 1,234,567.89 -> comma is thousands separator, dot is decimal
      str = str.replace(/,/g, '')
    } else {
      // 1.234.567,89 -> dot is thousands separator, comma is decimal
      str = str.replace(/\./g, '').replace(/,/g, '.')
    }
  } else if (hasDot) {
    // If multiple dots (e.g. 1.100.000 or 11.000.000) -> all are thousands separators
    const dotCount = (str.match(/\./g) || []).length
    if (dotCount > 1) {
      str = str.replace(/\./g, '')
    } else {
      // Single dot: e.g. 100.000 (with 3 digits after) or 10.5 (decimal)
      const parts = str.split('.')
      if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
        str = parts[0] + parts[1]
      }
    }
  } else if (hasComma) {
    // Commas only: e.g. 1,100,000 or 1,5
    const commaCount = (str.match(/,/g) || []).length
    if (commaCount > 1) {
      str = str.replace(/,/g, '')
    } else {
      const parts = str.split(',')
      if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
        str = parts[0] + parts[1]
      } else if (parts[1] && parts[1].length <= 2) {
        str = parts[0] + '.' + parts[1]
      } else {
        str = str.replace(/,/g, '')
      }
    }
  }

  const cleaned = str.replace(/[^\d.-]/g, '')
  if (!cleaned) return fallback
  let parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return fallback

  // Convert Rial to Toman if currency is Rial (e.g. 11,000,000 Rials -> 1,100,000 Tomans)
  if (currency === 'rial' || currency === 'irr') {
    parsed = Math.round(parsed / 10)
  }

  return parsed
}

const parseCsvBoolean = (value) => {
  const normalized = normalizeDigits(value)
    .trim()
    .toLowerCase()

  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'on' ||
    normalized === 'بله'
  )
}

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim())

const normalizeCsvImageUrl = (rawUrl, req) => {
  const trimmed = String(rawUrl || '').trim()
  if (!trimmed) return null

  if (isAbsoluteHttpUrl(trimmed)) return trimmed

  if (trimmed.startsWith('//')) {
    return `${req?.protocol || 'https'}:${trimmed}`
  }

  if (trimmed.startsWith('/')) {
    const host = req?.get?.('host')
    if (!host) return null
    return `${req.protocol || 'https'}://${host}${trimmed}`
  }

  return null
}

const extractPublicIdFromImageUrl = (imageUrl) => {
  try {
    const parsed = new URL(imageUrl)
    const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '').trim()
    return filename || undefined
  } catch (_) {
    return undefined
  }
}

const parseCsvImageUrls = (row = {}, req) => {
  const source =
    row.imageUrls ??
    row.image_urls ??
    row.images ??
    row.imageURLs ??
    row.ImageUrls ??
    ''

  if (!source) return []

  const tokens = String(source)
    .split(/[\n\r,;|]+/g)
    .map((part) => part.trim())
    .filter(Boolean)

  const unique = new Set()
  const images = []

  for (const token of tokens) {
    const normalizedUrl = normalizeCsvImageUrl(token, req)
    if (!normalizedUrl || unique.has(normalizedUrl)) continue
    unique.add(normalizedUrl)
    images.push({
      url: normalizedUrl,
      public_id: extractPublicIdFromImageUrl(normalizedUrl),
    })
  }

  return images
}

const getCsvImageSourceValue = (row = {}) =>
  row.imageUrls ??
  row.image_urls ??
  row.images ??
  row.imageURLs ??
  row.ImageUrls

const detectCsvDelimiter = (filePath) => {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buffer = Buffer.alloc(4096)
    const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0)
    fs.closeSync(fd)
    const sample = buffer.toString('utf8', 0, bytesRead)

    const firstLine = sample.split(/[\r\n]+/)[0] || ''
    let commaCount = 0
    let semiCount = 0
    let tabCount = 0
    let inQuote = false

    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i]
      if (char === '"') inQuote = !inQuote
      if (!inQuote) {
        if (char === ',') commaCount++
        else if (char === ';') semiCount++
        else if (char === '\t') tabCount++
      }
    }

    if (semiCount > commaCount && semiCount >= tabCount) return ';'
    if (tabCount > commaCount && tabCount > semiCount) return '\t'
    return ','
  } catch (_) {
    return ','
  }
}

const parseCsvFile = (filePath) => new Promise((resolve, reject) => {
  const rows = []
  const delimiter = detectCsvDelimiter(filePath)

  fs.createReadStream(filePath)
    .pipe(csv({
      separator: delimiter,
      mapHeaders: ({ header }) => (header || '').replace(/\uFEFF/g, '').trim(),
      mapValues: ({ value }) => (typeof value === 'string' ? value.trim() : value),
    }))
    .on('data', (row) => rows.push(row))
    .on('end', () => resolve(rows))
    .on('error', reject)
})

const parseExcelFile = async (filePath) => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const rows = []
  let headers = []

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    if (rowNumber === 1) {
      headers = values.map((val) => {
        if (val == null) return ''
        if (typeof val === 'object' && val.richText) {
          return val.richText.map((t) => t.text).join('').trim()
        }
        if (typeof val === 'object' && val.text) return String(val.text).trim()
        return String(val).replace(/\uFEFF/g, '').trim()
      })
    } else {
      const rowObject = {}
      let hasAnyValue = false
      headers.forEach((header, idx) => {
        if (!header) return
        let val = values[idx]
        if (val != null) {
          if (typeof val === 'object' && val.result !== undefined) {
            val = val.result
          } else if (typeof val === 'object' && val.richText) {
            val = val.richText.map((t) => t.text).join('')
          } else if (typeof val === 'object' && val.text) {
            val = val.text
          }
          const strVal = String(val).trim()
          if (strVal !== '') {
            hasAnyValue = true
            rowObject[header] = strVal
          }
        }
      })
      if (hasAnyValue) {
        rows.push(rowObject)
      }
    }
  })

  return rows
}

const parseImportFile = async (filePath, originalName) => {
  const ext = path.extname(originalName || filePath).toLowerCase()
  if (ext === '.xlsx' || ext === '.xls') {
    return await parseExcelFile(filePath)
  }
  return await parseCsvFile(filePath)
}

const HEADER_ALIASES = {
  name: ['name', 'title', '\u0646\u0627\u0645 \u0645\u062D\u0635\u0648\u0644', '\u0646\u0627\u0645 \u06A9\u0627\u0644\u0627', '\u0646\u0627\u0645', '\u0639\u0646\u0648\u0627\u0646', '\u0639\u0646\u0648\u0627\u0646 \u06A9\u0627\u0644\u0627'],
  sku: ['sku', '\u06A9\u062F \u06A9\u0627\u0644\u0627', '\u06A9\u062F \u0627\u0646\u0628\u0627\u0631', '\u0628\u0627\u0631\u06A9\u062F', '\u0634\u0646\u0627\u0633\u0647', '\u0634\u0646\u0627\u0633\u0647 \u06A9\u0627\u0644\u0627', '\u0634\u0646\u0627\u0633\u0647 \u0627\u0646\u0628\u0627\u0631'],
  productCode: ['productcode', 'product_code', '\u06A9\u062F \u0645\u062D\u0635\u0648\u0644', '\u0634\u0646\u0627\u0633\u0647 \u0645\u062D\u0635\u0648\u0644'],
  productType: ['producttype', 'product_type', 'type', '\u0646\u0648\u0639 \u0645\u062D\u0635\u0648\u0644', '\u0646\u0648\u0639'],
  price: ['price', '\u0642\u06CC\u0645\u062A', '\u0642\u06CC\u0645\u062A \u0641\u0631\u0648\u0634', '\u0645\u0628\u0644\u063A', '\u0645\u0628\u0644\u063A \u0641\u0631\u0648\u0634', '\u0646\u0631\u062E', '\u0646\u0631\u062E \u0641\u0631\u0648\u0634', '\u0642\u06CC\u0645\u062A (\u062A\u0648\u0645\u0627\u0646)', '\u0642\u06CC\u0645\u062A_\u062A\u0648\u0645\u0627\u0646', '\u0642\u06CC\u0645\u062A \u0628\u0647 \u062A\u0648\u0645\u0627\u0646', '\u0642\u06CC\u0645\u062A \u062A\u0648\u0645\u0627\u0646'],
  priceRial: ['price_rial', 'price_irr', '\u0642\u06CC\u0645\u062A (\u0631\u06CC\u0627\u0644)', '\u0642\u06CC\u0645\u062A_\u0631\u06CC\u0627\u0644', '\u0642\u06CC\u0645\u062A \u0628\u0647 \u0631\u06CC\u0627\u0644', '\u0642\u06CC\u0645\u062A \u0631\u06CC\u0627\u0644', '\u0645\u0628\u0644\u063A (\u0631\u06CC\u0627\u0644)', '\u0645\u0628\u0644\u063A_\u0631\u06CC\u0627\u0644', '\u0646\u0631\u062E \u0631\u06CC\u0627\u0644', '\u0642\u06CC\u0645\u062A \u0631\u06CC\u0627\u0644\u06CC'],
  compareAtPrice: ['compareatprice', 'compare_at_price', 'regular_price', 'oldprice', '\u0642\u06CC\u0645\u062A \u0645\u0642\u0627\u06CC\u0633\u0647', '\u0642\u06CC\u0645\u062A \u0642\u0628\u0644 \u0627\u0632 \u062A\u062E\u0641\u06CC\u0641', '\u0642\u06CC\u0645\u062A \u062E\u0637 \u062E\u0648\u0631\u062F\u0647', '\u0642\u06CC\u0645\u062A \u0627\u0635\u0644\u06CC', '\u0642\u06CC\u0645\u062A \u0645\u0635\u0631\u0641 \u06A9\u0646\u0646\u062F\u0647', '\u0642\u06CC\u0645\u062A \u0642\u0628\u0644 \u062A\u062E\u0641\u06CC\u0641'],
  compareAtPriceRial: ['compareatprice_rial', 'compare_at_price_rial', '\u0642\u06CC\u0645\u062A \u0645\u0642\u0627\u06CC\u0633\u0647 (\u0631\u06CC\u0627\u0644)', '\u0642\u06CC\u0645\u062A \u0642\u0628\u0644 \u0627\u0632 \u062A\u062E\u0641\u06CC\u0641 (\u0631\u06CC\u0627\u0644)'],
  stock: ['stock', 'quantity', 'qty', 'count', '\u0645\u0648\u062C\u0648\u062F\u06CC', '\u062A\u0639\u062F\u0627\u062F', '\u0645\u0648\u062C\u0648\u062F\u06CC \u0627\u0646\u0628\u0627\u0631', '\u062A\u0639\u062F\u0627\u062F \u0645\u0648\u062C\u0648\u062F', '\u0645\u0648\u062C\u0648\u062F\u06CC \u06A9\u0627\u0644\u0627'],
  category: ['category', '\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC', '\u062F\u0633\u062A\u0647 \u0628\u0646\u062F\u06CC', '\u062F\u0633\u062A\u0647', '\u06AF\u0631\u0648\u0647 \u06A9\u0627\u0644\u0627', '\u06AF\u0631\u0648\u0647'],
  brand: ['brand', '\u0628\u0631\u0646\u062F', '\u0633\u0627\u0632\u0646\u062F\u0647', '\u0634\u0631\u06A9\u062A \u0633\u0627\u0632\u0646\u062F\u0647', '\u0645\u0627\u0631\u06A9'],
  description: ['description', 'desc', '\u062A\u0648\u0636\u06CC\u062D\u0627\u062A', '\u062A\u0648\u0636\u06CC\u062D\u0627\u062A \u0645\u062D\u0635\u0648\u0644', '\u0634\u0631\u062D', '\u0634\u0631\u062D \u06A9\u0627\u0644\u0627', '\u062A\u0648\u0636\u06CC\u062D'],
  isActive: ['isactive', 'is_active', 'active', 'status', '\u0648\u0636\u0639\u06CC\u062A', '\u0641\u0639\u0627\u0644', '\u0648\u0636\u0639\u06CC\u062A \u0641\u0639\u0627\u0644'],
  isFeatured: ['isfeatured', 'is_featured', 'featured', '\u0648\u06CC\u0698\u0647', '\u0645\u062D\u0635\u0648\u0644 \u0648\u06CC\u0698\u0647', '\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0648\u06CC\u0698\u0647'],
  imageUrls: ['imageurls', 'image_urls', 'images', 'imageurl', 'image_url', '\u062A\u0635\u0627\u0648\u06CC\u0631', '\u062A\u0635\u0648\u06CC\u0631', '\u0639\u06A9\u0633', '\u0644\u06CC\u0646\u06A9 \u062A\u0635\u0648\u06CC\u0631', '\u0644\u06CC\u0646\u06A9 \u0639\u06A9\u0633'],
}

const normalizeImportRow = (rawRow = {}, globalCurrency = 'toman') => {
  const normalized = {}
  const rawKeys = Object.keys(rawRow)

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const key of rawKeys) {
      const cleanKey = String(key || '').trim().toLowerCase().replace(/[\s_\-]+/g, '')
      const matched = aliases.some((alias) => {
        const cleanAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '')
        return cleanKey === cleanAlias || key.trim() === alias
      })
      if (matched && rawRow[key] !== undefined && rawRow[key] !== '') {
        normalized[field] = rawRow[key]
        break
      }
    }
  }

  let rawPriceVal = normalized.price
  let rowCurrency = globalCurrency

  if (normalized.priceRial !== undefined && normalized.priceRial !== '') {
    rawPriceVal = normalized.priceRial
    rowCurrency = 'rial'
  }

  let rawCompareVal = normalized.compareAtPrice
  let compareCurrency = globalCurrency
  if (normalized.compareAtPriceRial !== undefined && normalized.compareAtPriceRial !== '') {
    rawCompareVal = normalized.compareAtPriceRial
    compareCurrency = 'rial'
  }

  return {
    rawRow,
    name: normalized.name,
    sku: normalized.sku,
    productCode: normalized.productCode,
    productType: normalized.productType,
    rawPrice: rawPriceVal,
    priceCurrency: rowCurrency,
    rawCompareAtPrice: rawCompareVal,
    compareCurrency: compareCurrency,
    stock: normalized.stock,
    category: normalized.category,
    brand: normalized.brand,
    description: normalized.description,
    isActive: normalized.isActive,
    isFeatured: normalized.isFeatured,
    imageUrls: normalized.imageUrls,
  }
}

const handleCsvUpload = (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (!err) return next()

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'حجم فایل بالاتر از حد مجاز است',
        })
      }

      return res.status(400).json({
        success: false,
        message: `خطا در آپلود فایل: ${err.message}`,
      })
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'خطا در آپلود فایل CSV',
    })
  })
}

// ============================================
// Helpers
// ============================================

// Normalize upload result from ParsPack to { url, public_id }
const extractImageInfo = (uploadResult) => {
  if (!uploadResult) return null
  return {
    url: uploadResult.url,
    public_id: uploadResult.filename || uploadResult.public_id,
  }
}

// Recursively collect all descendant category IDs using $graphLookup (Optimized)
const getAllDescendantCategoryIds = async (parentId) => {
  try {
    const mongoose = require('mongoose')
    const result = await Category.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(parentId) } },
      {
        $graphLookup: {
          from: 'categories', // Collection name (mongoose default: lowercase plural)
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          as: 'descendants',
          maxDepth: 10,
        },
      },
      {
        $project: {
          descendantIds: '$descendants._id',
        },
      },
    ])

    if (!result || result.length === 0) return []
    return result[0].descendantIds || []
  } catch (error) {
    console.error('Error fetching descendant categories:', error)
    return []
  }
}

// Keep offer timers aligned with the current active master product
const syncOfferTimers = async (data, currentProduct = {}) => {
  const now = new Date()

  const effectiveSpecialOffer =
    data.isSpecialOffer !== undefined ? data.isSpecialOffer : currentProduct.isSpecialOffer
  if (effectiveSpecialOffer === true) {
    const activeMaster = await Product.findOne({
      isSpecialOffer: true,
      specialOfferEndTime: { $gt: now },
    }).select('specialOfferEndTime').lean()

    if (activeMaster && activeMaster.specialOfferEndTime) {
      console.log(`[SYNC SPECIAL] Enforcing master timer: ${activeMaster.specialOfferEndTime}`)
      data.specialOfferEndTime = activeMaster.specialOfferEndTime
    }
  } else if (data.isSpecialOffer !== undefined) {
    data.specialOfferEndTime = null
  }

  const effectiveFlashDeal =
    data.isFlashDeal !== undefined ? data.isFlashDeal : currentProduct.isFlashDeal
  if (effectiveFlashDeal === true) {
    const activeMaster = await Product.findOne({
      isFlashDeal: true,
      flashDealEndTime: { $gt: now },
    }).select('flashDealEndTime').lean()

    if (activeMaster && activeMaster.flashDealEndTime) {
      console.log(`[SYNC FLASH] Enforcing master timer: ${activeMaster.flashDealEndTime}`)
      data.flashDealEndTime = activeMaster.flashDealEndTime
    }
  } else if (data.isFlashDeal !== undefined) {
    data.flashDealEndTime = null
  }
}

// Validate that a product cannot be in both Flash Deal and Special Offer campaigns simultaneously
const validateCampaignExclusivity = (data, currentProduct = {}) => {
  const effectiveFlashDeal =
    data.isFlashDeal !== undefined ? data.isFlashDeal : currentProduct.isFlashDeal
  const effectiveSpecialOffer =
    data.isSpecialOffer !== undefined ? data.isSpecialOffer : currentProduct.isSpecialOffer

  if (effectiveFlashDeal === true && effectiveSpecialOffer === true) {
    return {
      valid: false,
      message: 'یک محصول نمی‌تواند همزمان در کمپین پیشنهاد لحظه‌ای و شگفت‌انگیز باشد. لطفاً فقط یکی را انتخاب کنید.',
    }
  }

  return { valid: true }
}

// یک محصول که در «تخفیف زمان‌دار» (بخش مالی) فعال/آینده است نباید همزمان
// لحظه‌ای یا شگفت‌انگیز شود. فقط وقتی فلگ *تازه روشن* می‌شود بررسی می‌کنیم تا ویرایش
// سایر فیلدهای محصولاتِ قدیمی مسدود نشود.
const validateNoActiveSaleConflict = async (data, currentProduct = null) => {
  const turningOnFlash = data.isFlashDeal === true && !(currentProduct && currentProduct.isFlashDeal)
  const turningOnSpecial = data.isSpecialOffer === true && !(currentProduct && currentProduct.isSpecialOffer)
  if (!turningOnFlash && !turningOnSpecial) return { valid: true }
  if (!currentProduct || !currentProduct._id) return { valid: true } // محصول جدید هنوز عضو هیچ تخفیفی نیست

  const categoryId = data.category !== undefined ? data.category : currentProduct.category
  const sales = await findActiveSalesForProduct(currentProduct._id, categoryId)
  if (sales.length === 0) return { valid: true }

  return {
    valid: false,
    sales: sales.map((s) => ({ name: s.name, startDate: s.startDate, endDate: s.endDate })),
    message: `این محصول در تخفیف زمان‌دار «${sales[0].name}» قرار دارد و نمی‌توان آن را همزمان در پیشنهاد لحظه‌ای یا شگفت‌انگیز فعال کرد. ابتدا آن را از تخفیف زمان‌دار (بخش مالی) خارج کنید.`,
  }
}

// ============================================
// GET /api/products
// Public products list with filters & pagination
// Query params:
// - skipDiscount=true: Returns raw product data without discount calculation (for admin panel)
// ============================================
router.get('/', cacheMiddleware(300), async (req, res) => {
  try {
    res.json(await listProducts(req.query, { Product, Category, Brand, Sale }))
  } catch (error) {
    if (error instanceof ListingQueryError) {
      return res.status(400).json({ success: false, message: error.message })
    }
    console.error('Error fetching products:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message })
  }
})

// ============================================
// PUT /api/products/special-offers/timer
// Update timer for all active special offer products
// ============================================
router.put(
  '/special-offers/timer',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { endTime, disable } = req.body

      if (disable) {
        // تایمر گروهی نباید کمپین مالی را لمس کند: محصولاتی که عضو یک تخفیف
        // زمان‌دار فعال/آینده هستند از این عملیات مستثنی‌اند (گزارش در skippedCount).
        const excludedIds = await getSaleMemberProductIds()
        const timerFilter = { isSpecialOffer: true }
        if (excludedIds.length) timerFilter._id = { $nin: excludedIds }
        // Clear timer for all special offer products
        const result = await Product.updateMany(
          timerFilter,
          { $unset: { specialOfferEndTime: "" } }
        )
        const skippedCount = excludedIds.length
          ? await Product.countDocuments({ isSpecialOffer: true, _id: { $in: excludedIds } })
          : 0

        clearCacheByPrefix('/api/products')
        clearCacheByPrefix('/api/v1/admin/products')

        return res.json({
          success: true,
          message: `Timer disabled for ${result.modifiedCount} products`,
          data: { modifiedCount: result.modifiedCount, skippedCount }
        })
      }

      if (!endTime) {
        return res.status(400).json({
          success: false,
          message: 'End time is required',
        })
      }

      const parsedEndTime = new Date(endTime)
      if (Number.isNaN(parsedEndTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end time value',
        })
      }

      console.log('[ADMIN] Updating special offer timer to:', parsedEndTime.toISOString())

      // Update all products that have isSpecialOffer: true
      // (به‌جز اعضای تخفیف‌های زمان‌دار فعال/آینده — مستثنی در skippedCount)
      const excludedIds = await getSaleMemberProductIds()
      const timerFilter = { isSpecialOffer: true }
      if (excludedIds.length) timerFilter._id = { $nin: excludedIds }
      const result = await Product.updateMany(
        timerFilter,
        { $set: { specialOfferEndTime: parsedEndTime } }
      )
      const skippedCount = excludedIds.length
        ? await Product.countDocuments({ isSpecialOffer: true, _id: { $in: excludedIds } })
        : 0

      console.log('[ADMIN] Update result:', result)

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: `Updated timer for ${result.modifiedCount} products`,
        data: { modifiedCount: result.modifiedCount, skippedCount }
      })
    } catch (error) {
      console.error('Error updating special offer timer:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update timer',
        error: error.message,
      })
    }
  }
)

// ============================================
// PUT /api/products/flash-deals/timer
// Update timer for all active flash deal products
// ============================================
router.put(
  '/flash-deals/timer',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { endTime, disable } = req.body

      if (disable) {
        // مثل تایمر شگفت‌انگیز: اعضای تخفیف‌های زمان‌دار فعال/آینده مستثنی‌اند.
        const excludedIds = await getSaleMemberProductIds()
        const timerFilter = { isFlashDeal: true }
        if (excludedIds.length) timerFilter._id = { $nin: excludedIds }
        const result = await Product.updateMany(
          timerFilter,
          { $unset: { flashDealEndTime: "" } }
        )
        const skippedCount = excludedIds.length
          ? await Product.countDocuments({ isFlashDeal: true, _id: { $in: excludedIds } })
          : 0

        clearCacheByPrefix('/api/products')
        clearCacheByPrefix('/api/v1/admin/products')

        return res.json({
          success: true,
          message: `Timer disabled for ${result.modifiedCount} products`,
          data: { modifiedCount: result.modifiedCount, skippedCount }
        })
      }

      if (!endTime) {
        return res.status(400).json({
          success: false,
          message: 'End time is required',
        })
      }

      const parsedEndTime = new Date(endTime)
      if (Number.isNaN(parsedEndTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end time value',
        })
      }

      console.log('[ADMIN] Updating flash deal timer to:', parsedEndTime.toISOString())

      // اعضای تخفیف‌های زمان‌دار فعال/آینده مستثنی‌اند (گزارش در skippedCount)
      const excludedIds = await getSaleMemberProductIds()
      const timerFilter = { isFlashDeal: true }
      if (excludedIds.length) timerFilter._id = { $nin: excludedIds }
      const result = await Product.updateMany(
        timerFilter,
        { $set: { flashDealEndTime: parsedEndTime } }
      )
      const skippedCount = excludedIds.length
        ? await Product.countDocuments({ isFlashDeal: true, _id: { $in: excludedIds } })
        : 0

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: `Updated timer for ${result.modifiedCount} products`,
        data: { modifiedCount: result.modifiedCount, skippedCount }
      })
    } catch (error) {
      console.error('Error updating flash deal timer:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update timer',
        error: error.message,
      })
    }
  }
)

// ============================================
// Helper: Build full category path from leaf to root
// Returns array of categories ordered from root to leaf
// ============================================
const buildCategoryPath = async (categoryId) => {
  if (!categoryId) return [];

  const path = [];
  let currentId = categoryId;
  const maxDepth = 10; // Prevent infinite loops
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const cat = await Category.findById(currentId).select('_id name slug parent').lean();
    if (!cat) break;

    path.unshift({
      _id: cat._id,
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug || cat._id.toString(),
    });

    currentId = cat.parent;
    depth++;
  }

  return path;
};

// ============================================
// GET /api/products/all-ids - Get all product IDs (for bulk select)
// Supports same filters as product list (search, category, status)
// MUST be defined BEFORE /:id route to avoid being caught by it
// ============================================
router.get(
  '/all-ids',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const filter = {}

      // Search filter (with Persian/Arabic normalization)
      if (req.query.search) {
        const normalizedPattern = buildPersianSearchRegex(req.query.search.trim())
        const regex = new RegExp(normalizedPattern, 'i')
        filter.$or = [{ name: regex }, { sku: regex }]
      }

      // Category filter
      if (req.query.category) {
        const mongoose = require('mongoose')
        if (mongoose.Types.ObjectId.isValid(req.query.category)) {
          if (req.query.includeChildren === 'true') {
            const descendantIds = await getAllDescendantCategoryIds(req.query.category)
            filter.category = { $in: descendantIds }
          } else {
            filter.category = req.query.category
          }
        }
      }

      // Status filter
      const isActiveEqRaw =
        (req.query.isActive && typeof req.query.isActive === 'object' ? req.query.isActive.eq : undefined) ??
        req.query['isActive[eq]']

      if (isActiveEqRaw !== undefined) {
        const isTrue = isActiveEqRaw === true || isActiveEqRaw === 'true' || isActiveEqRaw === 1 || isActiveEqRaw === '1'
        const isFalse = isActiveEqRaw === false || isActiveEqRaw === 'false' || isActiveEqRaw === 0 || isActiveEqRaw === '0'
        if (isTrue) {
          filter.isActive = true
        } else if (isFalse) {
          filter.isActive = false
        }
      }

      // Product type filter
      if (req.query.productType) {
        filter.productType = req.query.productType
      }

      const products = await Product.find(filter).select('_id').lean()
      const ids = products.map(p => p._id)

      res.json({
        success: true,
        ids,
        total: ids.length,
      })
    } catch (error) {
      console.error('Error fetching all product IDs:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در دریافت شناسه محصولات',
        error: error.message,
      })
    }
  },
)

// ============================================
// GET /api/products/:id
// Query params:
// - skipDiscount=true: Returns raw product data without discount calculation (for admin editing)
// ============================================
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    let product;
    const mongoose = require('mongoose');
    const { id } = req.params;
    const skipDiscount = req.query.skipDiscount === 'true';

    // 1. Try finding by ID if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id)
        .populate('brand', 'name logo slug')
        .populate({
          path: 'category',
          select: 'name slug parent',
        });
    }

    // 2. If not found by ID, try finding by slug
    if (!product) {
      product = await Product.findOne({ slug: id })
        .populate('brand', 'name logo slug')
        .populate({
          path: 'category',
          select: 'name slug parent',
        });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    const productObj = product.toObject()

    // Build full category path from root to leaf
    if (product.category && product.category._id) {
      productObj.categoryPath = await buildCategoryPath(product.category._id);
    }

    // If skipDiscount is true, return raw product data without discount calculation
    // This is used for admin editing to preserve original prices
    if (skipDiscount) {
      return res.json({
        success: true,
        data: productObj,
      })
    }

    const now = new Date()

    // Check for direct product campaign
    let activeSale = await Sale.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      products: product._id,
    })
      .select('name discountPercentage badgeTheme endDate')
      .lean()

    // If no direct campaign, check category-based campaign
    if (!activeSale && product.category) {
      const categoryId = typeof product.category === 'object' ? product.category._id : product.category

      // Support includeSubcategories sales by checking the full category path (ancestors)
      const categoryPathIds = Array.isArray(productObj.categoryPath) && productObj.categoryPath.length > 0
        ? productObj.categoryPath.map((c) => c._id).filter(Boolean)
        : [categoryId].filter(Boolean)

      const categorySales = await Sale.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        categories: { $in: categoryPathIds },
      })
        .select('name discountPercentage badgeTheme endDate includeSubcategories categories')
        .lean()

      const leafCategoryId = categoryId ? categoryId.toString() : null
      const ancestorIds = categoryPathIds.map((c) => c.toString())

      const matchedSale = categorySales.find((sale) => {
        const includeSubs = sale.includeSubcategories !== false
        const saleCategoryIds = Array.isArray(sale.categories) ? sale.categories.map((c) => c.toString()) : []

        // Always apply when the product is directly in the sale category
        if (leafCategoryId && saleCategoryIds.includes(leafCategoryId)) return true

        // Apply to descendants when includeSubcategories is enabled (sale category is an ancestor)
        return includeSubs && saleCategoryIds.some((cid) => ancestorIds.includes(cid))
      })

      if (matchedSale) {
        activeSale = matchedSale
      }
    }

    const applyDiscountToProductObj = (target, discountPct) => {
      if (discountPct > 0) {
        if (target.price !== undefined && target.price > 0) {
          const orig = target.compareAtPrice && target.compareAtPrice > target.price ? target.compareAtPrice : target.price
          const dAmount = (orig * discountPct) / 100
          target.price = Math.round(orig - dAmount)
          target.compareAtPrice = orig
        }
        if (Array.isArray(target.variants) && target.variants.length > 0) {
          target.variants = target.variants.map((v) => {
            const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v }
            if (vObj.price > 0) {
              const origV = vObj.compareAtPrice && vObj.compareAtPrice > vObj.price ? vObj.compareAtPrice : vObj.price
              const vDiscount = (origV * discountPct) / 100
              vObj.price = Math.round(origV - vDiscount)
              vObj.compareAtPrice = origV
            }
            return vObj
          })
        }
      }
    }

    if (activeSale) {
      productObj.campaignLabel = activeSale.name
      productObj.campaignTheme = activeSale.badgeTheme || 'green-orange'
      if (activeSale.discountPercentage > 0) {
        productObj.discount = activeSale.discountPercentage
        productObj.isSpecialOffer = true
        productObj.isFromActiveSale = true
        productObj.specialOfferEndTime = activeSale.endDate
        applyDiscountToProductObj(productObj, activeSale.discountPercentage)
      }
    } else if (productObj.discount > 0) {
      // Apply direct product discount
      applyDiscountToProductObj(productObj, productObj.discount)

      if (productObj.isFlashDeal) {
        productObj.campaignLabel = 'پیشنهاد لحظه‌ای'
        productObj.campaignTheme = 'gold-red'
      }
    }

    res.json({
      success: true,
      data: productObj,
    })
  } catch (error) {
    console.error('Error fetching product by id:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message,
    })
  }
})

// ============================================
// POST /api/products  (JSON create)
// Supports both simple and variable products
// ============================================
router.post(
  '/',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_CREATE),
  async (req, res) => {
    try {
      const {
        name,
        price,
        stock,
        category,
        brand,
        description,
        sku,
        productType,
        attributes,
        variants,
        isSpecialOffer,
        specialOfferEndTime,
        isFlashDeal,
        flashDealEndTime,
        discount,
        images,
        isFeatured,
        isActive,
        properties,
        specifications,
      } = req.body

      const productData = {
        name,
        description: description || '',
        sku: sku || undefined,
        productType: productType || 'simple',
        isSpecialOffer: isSpecialOffer || false,
        specialOfferEndTime,
        isFlashDeal: isFlashDeal || false,
        flashDealEndTime,
        discount: discount || 0,
        images: images || [],
        isFeatured: isFeatured || false,
        isActive: isActive !== undefined ? isActive : true,
        properties: properties || [],
        specifications: specifications || {},
      }

      // Validate and assign Category
      const mongoose = require('mongoose')
      if (category && mongoose.Types.ObjectId.isValid(category)) {
        productData.category = category
      } else {
        productData.category = null
      }

      // Validate and assign Brand
      if (brand && mongoose.Types.ObjectId.isValid(brand)) {
        productData.brand = brand
      } else {
        productData.brand = null
      }

      // فیلدهای قیمت و موجودی برای محصول ساده
      if (productType === 'simple' || !productType) {
        if (price !== undefined) productData.price = price
        if (stock !== undefined) productData.stock = stock
      }

      // ویژگی‌ها و متغیرها برای محصول متغیر
      if (productType === 'variable') {
        productData.attributes = attributes || []
        productData.variants = variants || []
      }

      // Validate campaign exclusivity (cannot be both Flash Deal and Special Offer)
      const exclusivityCheck = validateCampaignExclusivity(productData)
      if (!exclusivityCheck.valid) {
        return res.status(400).json({
          success: false,
          message: exclusivityCheck.message,
        })
      }

      // Apply Timer Synchronization
      await syncOfferTimers(productData)

      const product = await Product.create(productData)

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      })
    } catch (error) {
      console.error('Error creating product:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message,
      })
    }
  },
)

// ============================================
// PUT /api/products/:id  (update basic fields)
// Supports optional removeAllImages flag
// Supports both simple and variable products
// ============================================
router.put(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const body = req.body || {}
      const { removeAllImages, imagesToRemove, ...updates } = body

      // Allow clients to send arrays either as JSON arrays or JSON strings (FormData)
      const normalizeImageList = (value) => {
        if (value === undefined || value === null || value === '') return undefined
        if (Array.isArray(value)) return value
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (!trimmed) return undefined
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return parsed
          } catch (_) {
            // ignore JSON parse errors, fall back to single string
          }
          return [trimmed]
        }
        if (typeof value === 'object') return [value]
        return undefined
      }

      const getImageUrl = (img) => {
        if (!img) return undefined
        if (typeof img === 'string') return img
        if (typeof img === 'object' && typeof img.url === 'string') return img.url
        return undefined
      }

      const getImagePublicId = (img) => {
        if (!img || typeof img !== 'object') return undefined
        return typeof img.public_id === 'string' ? img.public_id : undefined
      }

      const imagesMatch = (a, b) => {
        const aId = getImagePublicId(a)
        const bId = getImagePublicId(b)
        if (aId && bId) return aId === bId

        const aUrl = getImageUrl(a)
        const bUrl = getImageUrl(b)
        if (aUrl && bUrl) return aUrl === bUrl

        return false
      }

      // Normalize `images` in updates (or drop it if it's an invalid type)
      const incomingImages = normalizeImageList(updates.images)
      if (incomingImages !== undefined) {
        updates.images = incomingImages
      } else if (updates.images !== undefined) {
        delete updates.images
      }

      const product = await Product.findById(req.params.id)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        })
      }

      // Remove all images (and from ParsPack S3) if requested
      if (removeAllImages) {
        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            if (img && typeof img === 'object' && img.public_id) {
              try {
                await deleteFromParsPack(img.public_id)
              } catch (err) {
                console.error(
                  'Error deleting product image from ParsPack during update:',
                  err.message,
                )
              }
            }
          }
        }
        // If client also sent a new images list, treat it as replacement after deletion
        updates.images = Array.isArray(updates.images) ? updates.images : []
      } else {
        const toRemove = normalizeImageList(imagesToRemove) || []
        if (Array.isArray(toRemove) && toRemove.length > 0) {
          console.log('[DEBUG] imagesToRemove:', JSON.stringify(toRemove, null, 2))
          console.log('[DEBUG] product.images (before):', JSON.stringify(product.images, null, 2))

          const remainingImages = []

          if (Array.isArray(product.images)) {
            for (const img of product.images) {
              const existingUrl = getImageUrl(img)
              const existingPublicId = getImagePublicId(img)

              const shouldRemove = toRemove.some((r) => imagesMatch(img, r))

              console.log(`[DEBUG] Comparing:
                Existing - ID: ${existingPublicId}, URL: ${existingUrl}
                Remove candidates: ${toRemove.length}
                Should remove: ${shouldRemove}`)

              if (shouldRemove) {
                if (existingPublicId) {
                  try {
                    console.log('[DEBUG] Deleting from ParsPack:', existingPublicId)
                    await deleteFromParsPack(existingPublicId)
                  } catch (err) {
                    console.error(
                      'Error deleting product image from ParsPack during partial update:',
                      err.message,
                    )
                  }
                }
              } else {
                remainingImages.push(img)
              }
            }
          }

          console.log('[DEBUG] remainingImages:', JSON.stringify(remainingImages, null, 2))

          // If the client sent a final images list (e.g., existing + newly uploaded),
          // don't drop new images just because imagesToRemove is present.
          if (Array.isArray(updates.images)) {
            updates.images = updates.images.filter((img) => !toRemove.some((r) => imagesMatch(img, r)))
          } else {
            updates.images = remainingImages
          }
        }
      }

      // Clean up invalid ObjectId references before updating
      // If brand or category is not a valid ObjectId, remove it from updates
      if (updates.brand !== undefined) {
        const mongoose = require('mongoose')
        if (updates.brand === null || updates.brand === '') {
          updates.brand = null
        } else if (typeof updates.brand === 'string' && !mongoose.Types.ObjectId.isValid(updates.brand)) {
          delete updates.brand
        }
      }

      if (updates.category !== undefined) {
        const mongoose = require('mongoose')
        if (updates.category === null || updates.category === '') {
          updates.category = null
        } else if (typeof updates.category === 'string' && !mongoose.Types.ObjectId.isValid(updates.category)) {
          delete updates.category
        }
      }

      // Validate campaign exclusivity (cannot be both Flash Deal and Special Offer)
      const exclusivityCheck = validateCampaignExclusivity(updates, product)
      if (!exclusivityCheck.valid) {
        return res.status(400).json({
          success: false,
          message: exclusivityCheck.message,
        })
      }

      // محصول عضو تخفیف زمان‌دار فعال، نمی‌تواند لحظه‌ای/شگفت‌انگیز شود
      const saleConflictCheck = await validateNoActiveSaleConflict(updates, product)
      if (!saleConflictCheck.valid) {
        return res.status(409).json({
          success: false,
          code: 'CAMPAIGN_CONFLICT',
          message: saleConflictCheck.message,
          data: { sales: saleConflictCheck.sales },
        })
      }

      // Apply Timer Synchronization
      await syncOfferTimers(updates, product);

      // Use findByIdAndUpdate for simple updates to avoid full validation
      console.log(`[UPDATE PRODUCT] ID: ${req.params.id}`)
      console.log(`[UPDATE PRODUCT] SKU in updates:`, updates.sku)
      console.log(`[UPDATE PRODUCT] Category in updates:`, updates.category)
      console.log(`[UPDATE PRODUCT] Brand in updates:`, updates.brand)

      const updateMongoQuery = { $set: updates }

      // If compareAtPrice is explicitly null, empty or 0, unset it from database so it doesn't inflate pricing
      if (updates.compareAtPrice === null || updates.compareAtPrice === '' || updates.compareAtPrice === 0) {
        delete updates.compareAtPrice
        updateMongoQuery.$unset = { compareAtPrice: "" }
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        updateMongoQuery,
        { new: true, runValidators: false }
      )

      console.log(`[UPDATE PRODUCT] Result category:`, updatedProduct.category)
      console.log(`[UPDATE PRODUCT] Result brand:`, updatedProduct.brand)

      // Invalidate ALL product-related caches
      // This clears: /api/products, /api/products?..., /api/products/:id, /api/products/:slug
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct,
      })
    } catch (error) {
      console.error('Error updating product:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/:id/images  (upload images)
// ============================================
router.post(
  '/:id/images',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  upload.array('images', 10),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        })
      }

      const newImages = []
      for (const file of (req.files || [])) {
        const result = await uploadToParsPack(file.buffer, file.originalname)
        const info = extractImageInfo(result)
        if (info) newImages.push(info)
      }

      product.images = [...(product.images || []), ...newImages]
      await product.save()

      clearCacheByKey(`/api/products/${req.params.id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'Images uploaded successfully',
        data: product,
      })
    } catch (error) {
      console.error('Error uploading product images:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to upload images',
        error: error.message,
      })
    }
  },
)

// ============================================
// DELETE /api/products/:id/images/:publicId
// حذف یک عکس خاص از محصول
// ============================================
router.delete(
  '/:id/images/:publicId',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  async (req, res) => {
    try {
      const { id } = req.params
      // Decode publicId چون از فرانت‌اند URL encoded می‌آید
      const publicId = decodeURIComponent(req.params.publicId)

      console.log(`[DELETE IMAGE] Product ID: ${id}, Public ID: ${publicId}`)

      // پیدا کردن محصول
      const product = await Product.findById(id)
      if (!product) {
        console.error(`[DELETE IMAGE] Product not found: ${id}`)
        return res.status(404).json({
          success: false,
          message: 'محصول یافت نشد',
        })
      }

      // پیدا کردن عکس با public_id
      const imageToDelete = product.images?.find(
        (img) => img.public_id === publicId
      )

      if (!imageToDelete) {
        console.error(`[DELETE IMAGE] Image not found in product. Public ID: ${publicId}`)
        console.error(`[DELETE IMAGE] Available images:`, product.images?.map(img => img.public_id))
        return res.status(404).json({
          success: false,
          message: 'تصویر در محصول یافت نشد',
        })
      }

      console.log(`[DELETE IMAGE] Found image:`, imageToDelete)

      // حذف از ParsPack
      try {
        await deleteFromParsPack(publicId)
        console.log(`[DELETE IMAGE] Deleted from ParsPack:`, publicId)
      } catch (parspackError) {
        console.error(`[DELETE IMAGE] ParsPack error:`, parspackError)
      }

      // حذف از آرایه images محصول
      product.images = product.images.filter(
        (img) => img.public_id !== publicId
      )

      // ذخیره محصول
      await product.save()

      console.log(`[DELETE IMAGE] Image deleted successfully. Remaining images: ${product.images.length}`)

      // پاک کردن کش
      clearCacheByKey(`/api/products/${id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'تصویر با موفقیت حذف شد',
        data: {
          product,
          deletedImage: imageToDelete,
        },
      })
    } catch (error) {
      console.error('[DELETE IMAGE] Error:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در حذف تصویر',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/bulk-status - Bulk activate/deactivate products
// Accepts { ids: ['id1', 'id2', ...], isActive: true/false } in request body
// ============================================
router.post(
  '/bulk-status',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { ids, isActive } = req.body

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لیست شناسه محصولات ارسال نشده است',
        })
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'وضعیت فعال/غیرفعال مشخص نشده است',
        })
      }

      const result = await Product.updateMany(
        { _id: { $in: ids } },
        { $set: { isActive } },
      )

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      const statusText = isActive ? 'فعال' : 'غیرفعال'
      res.json({
        success: true,
        message: `${result.modifiedCount} محصول با موفقیت ${statusText} شد`,
        modifiedCount: result.modifiedCount,
      })
    } catch (error) {
      console.error('Error bulk updating status:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در تغییر وضعیت محصولات',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/bulk-delete - Bulk delete products
// Accepts { ids: ['id1', 'id2', ...] } in request body
// ============================================
router.post(
  '/bulk-delete',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const { ids } = req.body

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لیست شناسه محصولات ارسال نشده است',
        })
      }

      // Find all products to delete (for ParsPack cleanup)
      const products = await Product.find({ _id: { $in: ids } }).select('images')

      // Delete ParsPack images for all products
      const deleteErrors = []
      for (const product of products) {
        if (Array.isArray(product.images)) {
          for (const img of product.images) {
            if (img && typeof img === 'object' && img.public_id) {
              try {
                await deleteFromParsPack(img.public_id)
              } catch (err) {
                deleteErrors.push(err.message)
                console.error('Error deleting product image from ParsPack:', err.message)
              }
            }
          }
        }
      }

      // Bulk delete from database
      const result = await Product.deleteMany({ _id: { $in: ids } })

      // Clear caches
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: `تعداد ${result.deletedCount} محصول با موفقیت حذف شد`,
        deletedCount: result.deletedCount,
        requestedCount: ids.length,
      })
    } catch (error) {
      console.error('Error bulk deleting products:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در حذف گروهی محصولات',
        error: error.message,
      })
    }
  },
)

// ============================================
// DELETE /api/products/:id
// ============================================
router.delete(
  '/:id',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        })
      }

      // Delete any ParsPack images associated with this product
      if (Array.isArray(product.images)) {
        for (const img of product.images) {
          if (img && typeof img === 'object' && img.public_id) {
            try {
              await deleteFromParsPack(img.public_id)
            } catch (err) {
              console.error('Error deleting product image from ParsPack:', err.message)
            }
          }
        }
      }

      await product.deleteOne()

      clearCacheByKey(`/api/products/${req.params.id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'Product deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting product:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message,
      })
    }
  },
)

// ============================================
// PUT /api/products/:id/stock - Quick stock update
// Only for simple products
// ============================================
router.put(
  '/:id/stock',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_STOCK),
  async (req, res) => {
    try {
      const { stock } = req.body

      if (stock === undefined || stock === null || stock === '') {
        return res.status(400).json({
          success: false,
          message: 'مقدار موجودی معتبر نیست',
        })
      }

      const numericStock = Number(stock)
      if (!Number.isFinite(numericStock)) {
        return res.status(400).json({
          success: false,
          message: 'مقدار موجودی معتبر نیست',
        })
      }

      if (numericStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'موجودی نمی‌تواند منفی باشد',
        })
      }

      const product = await Product.findById(req.params.id)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'محصول یافت نشد',
        })
      }

      // Only simple products support direct stock field
      if (product.productType === 'variable') {
        return res.status(400).json({
          success: false,
          message:
            'مدیریت موجودی برای محصولات متغیر باید از طریق متغیرها انجام شود، نه فیلد stock اصلی محصول.',
        })
      }

      // Update stock only, without triggering validation on other fields
      const updated = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: { stock: numericStock } },
        { new: true, runValidators: false },
      )

      clearCacheByKey(`/api/products/${req.params.id}`)
      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')

      res.json({
        success: true,
        message: 'موجودی محصول با موفقیت به‌روزرسانی شد',
        data: updated,
      })
    } catch (error) {
      console.error('Error updating stock:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در به‌روزرسانی موجودی',
        error: error.message,
      })
    }
  },
)

// ============================================
// GET /api/products/export/excel - Export products to Excel
// ============================================
router.get(
  '/export/excel',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_EXPORT),
  async (req, res) => {
    try {
      // Fetch all products with valid category references (for Excel export)
      const products = await Product.find({
        $or: [
          { category: { $type: 'objectId' } },
          { category: { $exists: false } },
          { category: null },
        ],
      })
        .select(
          'name sku productType price compareAtPrice stock category brand rating numReviews isFeatured isActive',
        )
        .populate('category', 'name')
        .populate('brand', 'name')
        .lean()

      // Create a new workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('محصولات')

      // Define columns
      worksheet.columns = [
        { header: 'نام محصول', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'نوع محصول', key: 'productType', width: 15 },
        { header: 'قیمت', key: 'price', width: 15 },
        { header: 'قیمت مقایسه', key: 'compareAtPrice', width: 15 },
        { header: 'موجودی', key: 'stock', width: 10 },
        { header: 'دسته‌بندی', key: 'category', width: 20 },
        { header: 'برند', key: 'brand', width: 20 },
        { header: 'امتیاز', key: 'rating', width: 10 },
        { header: 'تعداد نظرات', key: 'numReviews', width: 12 },
        { header: 'ویژه', key: 'isFeatured', width: 10 },
        { header: 'فعال', key: 'isActive', width: 10 },
      ]

      // Add rows
      products.forEach((product) => {
        worksheet.addRow({
          name: product.name || '',
          sku: product.sku || '',
          productType: product.productType || 'simple',
          price: product.price || 0,
          compareAtPrice: product.compareAtPrice || '',
          stock: product.stock || 0,
          category: product.category?.name || '',
          brand: product.brand?.name || '',
          rating: product.rating || 0,
          numReviews: product.numReviews || 0,
          isFeatured: product.isFeatured ? 'بله' : 'خیر',
          isActive: product.isActive ? 'بله' : 'خیر',
        })
      })

      // Style header row
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }

      // Set response headers for file download
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx')

      // Generate buffer and send as response
      const buffer = await workbook.xlsx.writeBuffer()
      res.send(buffer)
    } catch (error) {
      console.error('Error exporting products to Excel:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در برون‌ریزی محصولات به Excel',
        error: error.message,
      })
    }
  },
)

// ============================================
// GET /api/products/export/csv - Export products to CSV
// ============================================
router.get(
  '/export/csv/prices',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_EXPORT),
  async (req, res) => {
    try {
      const products = await Product.find({ sku: { $exists: true, $ne: '' } })
        .select('sku name price')
        .lean()

      const csvEscape = (val) => {
        const str = String(val ?? '')
        if (/[",\r\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const headers = ['sku', 'title', 'price']
      const lines = [headers.join(',')]

      products.forEach((product) => {
        const row = [
          csvEscape(product.sku || ''),
          csvEscape(product.name || ''),
          Number.isFinite(Number(product.price)) ? Number(product.price) : 0,
        ]
        lines.push(row.join(','))
      })

      const csvContent = '\uFEFF' + lines.join('\n')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename=products-prices.csv')
      res.send(csvContent)
    } catch (error) {
      console.error('Error exporting product prices to CSV:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در برون‌ریزی قیمت محصولات به CSV',
        error: error.message,
      })
    }
  },
)

router.get(
  '/export/csv',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_EXPORT),
  async (req, res) => {
    try {
      const products = await Product.find({
        $or: [
          { category: { $type: 'objectId' } },
          { category: { $exists: false } },
          { category: null },
        ],
      })
        .select(
          'name sku productCode productType price compareAtPrice stock category brand description isActive isFeatured images',
        )
        .populate('category', 'name')
        .populate('brand', 'name')
        .lean()

      const csvEscape = (val) => {
        const str = String(val ?? '')
        if (/[",\r\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const headers = [
        'name', 'sku', 'productCode', 'productType', 'price', 'compareAtPrice',
        'stock', 'category', 'brand', 'description', 'isActive', 'isFeatured', 'imageUrls',
      ]
      const lines = [headers.join(',')]

      products.forEach((product) => {
        const imageUrls = Array.isArray(product.images)
          ? product.images
            .map((img) => {
              if (!img) return ''
              if (typeof img === 'string') return img
              return img.url || ''
            })
            .filter((url) => isAbsoluteHttpUrl(url))
          : []

        const row = [
          csvEscape(product.name || ''),
          csvEscape(product.sku || ''),
          csvEscape(product.productCode || ''),
          csvEscape(product.productType || 'simple'),
          product.price || 0,
          product.compareAtPrice || '',
          product.stock || 0,
          csvEscape(product.category?.name || ''),
          csvEscape(product.brand?.name || ''),
          csvEscape(product.description || ''),
          product.isActive ? 'true' : 'false',
          product.isFeatured ? 'true' : 'false',
          csvEscape(imageUrls.join(';')),
        ]
        lines.push(row.join(','))
      })

      const csvContent = '\uFEFF' + lines.join('\n')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename=products.csv')
      res.send(csvContent)
    } catch (error) {
      console.error('Error exporting products to CSV:', error)
      res.status(500).json({
        success: false,
        message: 'خطا در برون‌ریزی محصولات به CSV',
        error: error.message,
      })
    }
  },
)

// ============================================
// POST /api/products/import/csv
// POST /api/products/import/excel
// POST /api/products/import
// Universal Import: Supports CSV and Excel (.xlsx/.xls)
// Supports ?mode=update to update existing products by SKU/productCode
// Supports ?currency=toman (default) or ?currency=rial (auto-divides by 10)
// Auto-detects Rial headers, Persian headers, and semicolons
// ============================================
const handleProductImport = async (req, res) => {
  req.setTimeout(CSV_IMPORT_TIMEOUT_MS)
  res.setTimeout(CSV_IMPORT_TIMEOUT_MS)

  const filePath = req.file?.path
  const startedAt = Date.now()

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'فایلی جهت درون‌ریزی بارگذاری نشده است (CSV یا Excel)',
      })
    }

    const importMode = (req.query.mode || req.body.mode || 'create').toLowerCase()
    const globalCurrency = (req.query.currency || req.body.currency || 'toman').toLowerCase().trim()

    const rawProducts = await parseImportFile(filePath, req.file.originalname)
    const errors = []

    if (!rawProducts || !rawProducts.length) {
      safeUnlink(filePath)
      return res.status(400).json({
        success: false,
        message: 'فایل بارگذاری شده خالی است یا سطرهای معتبری ندارد',
      })
    }

    // Normalize all rows using Persian & English header aliases and currency detection
    const products = rawProducts.map((rawRow) => normalizeImportRow(rawRow, globalCurrency))

    const hasImageColumn = products.some((row) =>
      row.imageUrls !== undefined && String(row.imageUrls).trim() !== '',
    )

    const isPriceOnlyCsv = products.length > 0 && products.every((row) => {
      const hasSku = Boolean(row.sku)
      const hasPrice = row.rawPrice !== undefined && row.rawPrice !== ''
      const hasOther = Boolean(row.name || row.category || row.brand || row.description)
      return hasSku && hasPrice && !hasOther
    })

    // Fetch all categories and brands for resilient matching
    const allCategories = await Category.find({}).select('_id name').lean()
    const allBrands = await Brand.find({}).select('_id name').lean()

    const resolveCategoryId = (inputVal) => {
      if (!inputVal) return null
      const raw = String(inputVal).trim()
      const norm = normalizePersianText(raw)
      const stripped = norm.replace(/\s+/g, '')

      for (const cat of allCategories) {
        if (!cat.name) continue
        const cRaw = cat.name.trim()
        const cNorm = normalizePersianText(cRaw)
        if (cRaw === raw || cNorm === norm || cNorm.replace(/\s+/g, '') === stripped) {
          return cat._id
        }
      }
      return null
    }

    const resolveBrandId = (inputVal) => {
      if (!inputVal) return null
      const raw = String(inputVal).trim()
      const norm = normalizePersianText(raw)
      const stripped = norm.replace(/\s+/g, '')

      for (const br of allBrands) {
        if (!br.name) continue
        const bRaw = br.name.trim()
        const bNorm = normalizePersianText(bRaw)
        if (bRaw === raw || bNorm === norm || bNorm.replace(/\s+/g, '') === stripped) {
          return br._id
        }
      }
      return null
    }

    // Load existing productCodes to ensure unique collision-free productCode assignment
    const existingCodeDocs = await Product.find({ productCode: { $exists: true } }).select('productCode').lean()
    const assignedCodeSet = new Set(
      existingCodeDocs
        .map((p) => String(p.productCode || '').trim().toUpperCase())
        .filter(Boolean),
    )

    const assignProductCode = (sku, index) => {
      let baseCode = ''
      if (sku) {
        const digits = normalizeDigits(sku).replace(/\D/g, '')
        if (digits.length > 0) {
          baseCode = digits.slice(-7).padStart(7, '0')
        }
      }
      if (!baseCode) {
        const uniqueNum = ((Date.now() % 10000000) + index) % 10000000
        baseCode = uniqueNum.toString().padStart(7, '0')
      }

      let candidate = `KY-${baseCode}`
      let counter = 1
      while (assignedCodeSet.has(candidate)) {
        const nextNum = (parseInt(baseCode, 10) + counter) % 10000000
        candidate = `KY-${nextNum.toString().padStart(7, '0')}`
        counter++
      }
      assignedCodeSet.add(candidate)
      return candidate
    }

    if (importMode === 'update') {
      let totalUpdated = 0
      let totalCreated = 0

      const skuSet = new Set()
      const codeSet = new Set()
      products.forEach((row) => {
        if (row.sku) skuSet.add(String(row.sku).trim())
        if (row.productCode) codeSet.add(String(row.productCode).trim().toUpperCase())
      })

      const existingByQuery = []
      if (skuSet.size > 0) {
        const bySkus = await Product.find({ sku: { $in: Array.from(skuSet) } }).lean()
        existingByQuery.push(...bySkus)
      }
      if (codeSet.size > 0) {
        const byCodes = await Product.find({ productCode: { $in: Array.from(codeSet) } }).lean()
        existingByQuery.push(...byCodes)
      }

      const existingBySkuMap = new Map()
      const existingByCodeMap = new Map()
      existingByQuery.forEach((p) => {
        if (p.sku) existingBySkuMap.set(String(p.sku).trim(), p)
        if (p.productCode) existingByCodeMap.set(String(p.productCode).trim().toUpperCase(), p)
      })

      const productsToCreate = []

      for (let i = 0; i < products.length; i++) {
        const row = products[i]

        try {
          const rowSku = row.sku ? String(row.sku).trim() : ''
          const rowCode = row.productCode ? String(row.productCode).trim().toUpperCase() : ''

          let existingProduct = null
          if (rowCode) existingProduct = existingByCodeMap.get(rowCode)
          if (!existingProduct && rowSku) existingProduct = existingBySkuMap.get(rowSku)

          const categoryId = row.category ? resolveCategoryId(row.category) : undefined
          const brandId = row.brand ? resolveBrandId(row.brand) : undefined

          if (existingProduct) {
            const updateFields = {}
            const imageSourceValue = hasImageColumn ? row.imageUrls : undefined
            const hasExplicitImageValue = imageSourceValue !== undefined && String(imageSourceValue).trim() !== ''
            const parsedImages = hasExplicitImageValue ? parseCsvImageUrls(row.rawRow, req) : null

            if (isPriceOnlyCsv) {
              if (row.rawPrice !== undefined && row.rawPrice !== '') {
                updateFields.price = parseCsvNumber(row.rawPrice, existingProduct.price, row.priceCurrency)
              }

              if (Object.keys(updateFields).length > 0) {
                if (existingProduct.productType === 'variable' && Array.isArray(existingProduct.variants)) {
                  updateFields.variants = existingProduct.variants.map((v) => ({
                    ...v,
                    price: updateFields.price,
                  }))
                }

                await Product.updateOne(
                  { _id: existingProduct._id },
                  { $set: updateFields },
                  { runValidators: false },
                )
                totalUpdated++
              }
              continue
            }

            if (row.name !== undefined && row.name !== '') updateFields.name = row.name
            if (row.productType !== undefined && row.productType !== '') updateFields.productType = row.productType
            if (row.rawPrice !== undefined && row.rawPrice !== '') {
              updateFields.price = parseCsvNumber(row.rawPrice, existingProduct.price, row.priceCurrency)
            }
            if (row.rawCompareAtPrice !== undefined && row.rawCompareAtPrice !== '') {
              updateFields.compareAtPrice = parseCsvNumber(row.rawCompareAtPrice, existingProduct.compareAtPrice, row.compareCurrency)
            }
            if (row.stock !== undefined && row.stock !== '') {
              updateFields.stock = Math.max(0, Math.floor(parseCsvNumber(row.stock, existingProduct.stock, 'toman')))
            }
            if (categoryId !== undefined && categoryId !== null) updateFields.category = categoryId
            if (brandId !== undefined && brandId !== null) updateFields.brand = brandId
            if (row.description !== undefined && row.description !== '') updateFields.description = row.description
            if (row.isActive !== undefined && row.isActive !== '') updateFields.isActive = parseCsvBoolean(row.isActive)
            if (row.isFeatured !== undefined && row.isFeatured !== '') updateFields.isFeatured = parseCsvBoolean(row.isFeatured)
            if (row.sku !== undefined && row.sku !== '') updateFields.sku = rowSku
            if (parsedImages) updateFields.images = parsedImages

            if (Object.keys(updateFields).length > 0) {
              if (updateFields.price !== undefined && existingProduct.productType === 'variable' && Array.isArray(existingProduct.variants)) {
                updateFields.variants = existingProduct.variants.map((v) => ({
                  ...v,
                  price: updateFields.price,
                }))
              }

              await Product.updateOne(
                { _id: existingProduct._id },
                { $set: updateFields },
                { runValidators: false },
              )
              totalUpdated++
            }
          } else {
            const mongoose = require('mongoose')
            const priceVal = parseCsvNumber(row.rawPrice, 0, row.priceCurrency)
            const compareVal = row.rawCompareAtPrice !== undefined && row.rawCompareAtPrice !== ''
              ? parseCsvNumber(row.rawCompareAtPrice, undefined, row.compareCurrency)
              : undefined
            const stockVal = Math.max(0, Math.floor(parseCsvNumber(row.stock, 0, 'toman')))

            const productData = {
              name: row.name || `Product ${i + 1}`,
              sku: rowSku,
              productType: row.productType || 'simple',
              price: priceVal,
              compareAtPrice: compareVal,
              stock: stockVal,
              category: categoryId || null,
              brand: brandId || null,
              description: row.description || '',
              isActive: row.isActive !== undefined ? parseCsvBoolean(row.isActive) : true,
              isFeatured: row.isFeatured !== undefined ? parseCsvBoolean(row.isFeatured) : false,
              images: hasImageColumn ? parseCsvImageUrls(row.rawRow, req) : [],
            }

            if (productData.name) {
              const base = productData.name.toString().trim().toLowerCase()
              let slug = base
                .replace(/\s+/g, '-')
                .replace(/[^\p{L}\p{N}\-]+/gu, '')
                .replace(/\-+/g, '-')
                .replace(/^-+/, '')
                .replace(/-+$/, '')
              if (!slug) slug = new mongoose.Types.ObjectId().toString()
              const uniqueSuffix = Math.floor(Math.random() * 1000).toString()
              productData.slug = `${slug}-${uniqueSuffix}-${Date.now()}`
            }

            productData.productCode = assignProductCode(rowSku, i)

            if (productData.productType === 'variable') {
              productData.variants = [{
                sku: productData.sku,
                price: productData.price,
                stock: productData.stock,
                options: [{ name: 'پیش‌فرض', value: 'اصلی' }],
              }]
              productData.attributes = [{ name: 'پیش‌فرض', values: ['اصلی'] }]
            }

            productsToCreate.push(productData)
          }
        } catch (rowError) {
          errors.push(`سطر ${i + 1}: ${rowError.message}`)
        }
      }

      for (let i = 0; i < productsToCreate.length; i += CSV_IMPORT_BATCH_SIZE) {
        const chunk = productsToCreate.slice(i, i + CSV_IMPORT_BATCH_SIZE)
        try {
          const result = await Product.insertMany(chunk, { ordered: false })
          totalCreated += result.length
        } catch (batchError) {
          console.error(`Error importing batch ${Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1}:`, batchError.message)
          if (batchError.insertedDocs) {
            totalCreated += batchError.insertedDocs.length
          }
          errors.push(`خطا در ثبت بسته ${Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1}: ${batchError.message}`)
        }
      }

      clearCacheByPrefix('/api/products')
      clearCacheByPrefix('/api/v1/admin/products')
      safeUnlink(filePath)

      const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
      const messageParts = []
      if (totalUpdated > 0) messageParts.push(`${totalUpdated} به‌روزرسانی شد`)
      if (totalCreated > 0) messageParts.push(`${totalCreated} ایجاد شد`)
      if (messageParts.length === 0) messageParts.push('هیچ تغییری اعمال نشد')

      return res.json({
        success: true,
        message: messageParts.join('، '),
        updated: totalUpdated,
        created: totalCreated,
        imported: totalUpdated + totalCreated,
        currencyApplied: globalCurrency === 'rial' ? 'rial_to_toman' : 'toman',
        durationSeconds,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // ============================================
    // CREATE MODE (default): Insert all as new products
    // ============================================
    const productsToCreate = []

    for (let i = 0; i < products.length; i++) {
      const row = products[i]

      try {
        const categoryId = row.category ? resolveCategoryId(row.category) : null
        const brandId = row.brand ? resolveBrandId(row.brand) : null
        const rowSku = row.sku ? String(row.sku).trim() : ''

        const priceVal = parseCsvNumber(row.rawPrice, 0, row.priceCurrency)
        const compareVal = row.rawCompareAtPrice !== undefined && row.rawCompareAtPrice !== ''
          ? parseCsvNumber(row.rawCompareAtPrice, undefined, row.compareCurrency)
          : undefined
        const stockVal = Math.max(0, Math.floor(parseCsvNumber(row.stock, 0, 'toman')))

        const mongoose = require('mongoose')
        const productData = {
          name: row.name || `Product ${i + 1}`,
          sku: rowSku,
          productType: row.productType || 'simple',
          price: priceVal,
          compareAtPrice: compareVal,
          stock: stockVal,
          category: categoryId,
          brand: brandId,
          description: row.description || '',
          isActive: row.isActive !== undefined ? parseCsvBoolean(row.isActive) : true,
          isFeatured: row.isFeatured !== undefined ? parseCsvBoolean(row.isFeatured) : false,
          images: hasImageColumn ? parseCsvImageUrls(row.rawRow, req) : [],
        }

        if (productData.name) {
          const base = productData.name.toString().trim().toLowerCase()
          let slug = base
            .replace(/\s+/g, '-')
            .replace(/[^\p{L}\p{N}\-]+/gu, '')
            .replace(/\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '')
          if (!slug) slug = new mongoose.Types.ObjectId().toString()
          const uniqueSuffix = Math.floor(Math.random() * 1000).toString()
          productData.slug = `${slug}-${uniqueSuffix}-${Date.now()}`
        }

        productData.productCode = assignProductCode(rowSku, i)

        if (productData.productType === 'variable') {
          productData.variants = [{
            sku: productData.sku,
            price: productData.price,
            stock: productData.stock,
            options: [{ name: 'پیش‌فرض', value: 'اصلی' }],
          }]
          productData.attributes = [{ name: 'پیش‌فرض', values: ['اصلی'] }]
        }

        productsToCreate.push(productData)
      } catch (rowError) {
        errors.push(`سطر ${i + 1}: ${rowError.message}`)
      }
    }

    let totalImported = 0

    for (let i = 0; i < productsToCreate.length; i += CSV_IMPORT_BATCH_SIZE) {
      const chunk = productsToCreate.slice(i, i + CSV_IMPORT_BATCH_SIZE)
      try {
        const result = await Product.insertMany(chunk, { ordered: false })
        totalImported += result.length
      } catch (batchError) {
        console.error(`Error importing batch ${Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1}:`, batchError.message)
        if (batchError.insertedDocs) {
          totalImported += batchError.insertedDocs.length
        }
        errors.push(`خطا در ثبت بسته ${Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1}: ${batchError.message}`)
      }
    }

    clearCacheByPrefix('/api/products')
    clearCacheByPrefix('/api/v1/admin/products')
    safeUnlink(filePath)

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
    const resultMessage = `${totalImported} محصول با موفقیت در سیستم ثبت شد`

    return res.json({
      success: true,
      message: resultMessage,
      imported: totalImported,
      currencyApplied: globalCurrency === 'rial' ? 'rial_to_toman' : 'toman',
      durationSeconds,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error importing products:', error)
    safeUnlink(filePath)
    return res.status(500).json({
      success: false,
      message: 'خطا در درون‌ریزی محصولات',
      error: error.message,
    })
  }
}

router.post(
  '/import/csv',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_IMPORT),
  handleCsvUpload,
  handleProductImport,
)

router.post(
  '/import/excel',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_IMPORT),
  handleCsvUpload,
  handleProductImport,
)

router.post(
  '/import',
  protect,
  checkPermission(PERMISSIONS.PRODUCT_IMPORT),
  handleCsvUpload,
  handleProductImport,
)

// ============================================
// GET /api/products/code/:code
// Get product by productCode (e.g., "KY-1234567")
// Public route - used for SEO-friendly URLs
// ============================================
router.get('/code/:code', cacheMiddleware(300), async (req, res) => {
  try {
    const { code } = req.params
    const normalizedCode = code.toUpperCase()
    const skipDiscount = req.query.skipDiscount === 'true'

    const product = await Product.findOne({ productCode: normalizedCode })
      .populate('category', '_id name slug parent')
      .populate('brand', '_id name slug')
      .lean()

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'محصول یافت نشد',
      })
    }

    const productObj = { ...product }

    // Build full category path from root to leaf
    if (productObj.category && productObj.category._id) {
      productObj.categoryPath = await buildCategoryPath(productObj.category._id)
    }

    // If skipDiscount is true, return raw product data without discount calculation
    // This is used for admin editing to preserve original prices
    if (!skipDiscount) {
      const now = new Date()

      // Check for direct product campaign
      let activeSale = await Sale.findOne({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        products: productObj._id,
      })
        .select('name discountPercentage badgeTheme endDate')
        .lean()

      // If no direct campaign, check category-based campaign (supports includeSubcategories)
      if (!activeSale && productObj.categoryPath && productObj.categoryPath.length > 0) {
        const leafCategoryId = productObj.categoryPath[productObj.categoryPath.length - 1]._id
        const categoryPathIds = productObj.categoryPath.map((c) => c._id).filter(Boolean)

        const categorySales = await Sale.find({
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
          categories: { $in: categoryPathIds },
        })
          .select('name discountPercentage badgeTheme endDate includeSubcategories categories')
          .lean()

        const leafCategoryIdStr = leafCategoryId ? leafCategoryId.toString() : null
        const ancestorIds = categoryPathIds.map((c) => c.toString())

        const matchedSale = categorySales.find((sale) => {
          const includeSubs = sale.includeSubcategories !== false
          const saleCategoryIds = Array.isArray(sale.categories) ? sale.categories.map((c) => c.toString()) : []

          // Always apply when the product is directly in the sale category
          if (leafCategoryIdStr && saleCategoryIds.includes(leafCategoryIdStr)) return true

          // Apply to descendants when includeSubcategories is enabled (sale category is an ancestor)
          return includeSubs && saleCategoryIds.some((cid) => ancestorIds.includes(cid))
        })

        if (matchedSale) {
          activeSale = matchedSale
        }
      }

      const applyDiscountToProductObj = (target, discountPct) => {
        if (discountPct > 0) {
          if (target.price !== undefined && target.price > 0) {
            const orig = target.compareAtPrice && target.compareAtPrice > target.price ? target.compareAtPrice : target.price
            const dAmount = (orig * discountPct) / 100
            target.price = Math.round(orig - dAmount)
            target.compareAtPrice = orig
          }
          if (Array.isArray(target.variants) && target.variants.length > 0) {
            target.variants = target.variants.map((v) => {
              const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v }
              if (vObj.price > 0) {
                const origV = vObj.compareAtPrice && vObj.compareAtPrice > vObj.price ? vObj.compareAtPrice : vObj.price
                const vDiscount = (origV * discountPct) / 100
                vObj.price = Math.round(origV - vDiscount)
                vObj.compareAtPrice = origV
              }
              return vObj
            })
          }
        }
      }

      if (activeSale) {
        productObj.campaignLabel = activeSale.name
        productObj.campaignTheme = activeSale.badgeTheme || 'green-orange'
        if (activeSale.discountPercentage > 0) {
          productObj.discount = activeSale.discountPercentage
          productObj.isSpecialOffer = true
          productObj.isFromActiveSale = true
          productObj.specialOfferEndTime = activeSale.endDate
          applyDiscountToProductObj(productObj, activeSale.discountPercentage)
        }
      } else if (productObj.discount > 0) {
        // Apply direct product discount
        applyDiscountToProductObj(productObj, productObj.discount)

        if (productObj.isFlashDeal) {
          productObj.campaignLabel = 'پیشنهاد لحظه‌ای'
          productObj.campaignTheme = 'gold-red'
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...productObj,
      },
    })
  } catch (error) {
    console.error('Error fetching product by code:', error)
    res.status(500).json({
      success: false,
      message: 'خطای سرور',
      error: error.message,
    })
  }
})

module.exports = router
