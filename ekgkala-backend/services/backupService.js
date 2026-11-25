const fs = require('fs')
const path = require('path')
const os = require('os')
const zlib = require('zlib')
const crypto = require('crypto')
const readline = require('readline')
const { Transform } = require('stream')
const { once } = require('events')
const mongoose = require('mongoose')

let cachedEjson = null
function getEjson() {
  if (cachedEjson) return cachedEjson
  if (mongoose.mongo?.BSON?.EJSON) {
    cachedEjson = mongoose.mongo.BSON.EJSON
    return cachedEjson
  }
  if (mongoose.mongo?.EJSON) {
    cachedEjson = mongoose.mongo.EJSON
    return cachedEjson
  }
  try {
    const direct = require('bson')
    if (direct?.EJSON) {
      cachedEjson = direct.EJSON
      return cachedEjson
    }
  } catch {
    // ignore and resolve relative to mongoose/mongodb
  }
  try {
    const mongooseDir = path.dirname(require.resolve('mongoose'))
    const mongodbDir = path.dirname(require.resolve('mongodb', { paths: [mongooseDir] }))
    const bsonPath = require.resolve('bson', { paths: [__dirname, mongooseDir, mongodbDir] })
    const mod = require(bsonPath)
    if (mod?.EJSON) {
      cachedEjson = mod.EJSON
      return cachedEjson
    }
  } catch {
    // handled below
  }
  throw createCodedError('ماژول BSON EJSON برای پردازش بکاپ در دسترس نیست', 'BSON_EJSON_UNAVAILABLE', 500)
}

const BACKUP_FORMAT = 'ekgkala-full-backup'
const BACKUP_VERSION = 2

const ENCRYPTED_MAGIC = Buffer.from('EKGBENC1', 'ascii') // 8 bytes
const KDF_SCRYPT_ID = 1
const SALT_SIZE = 32
const IV_SIZE = 12
const HEADER_SIZE = ENCRYPTED_MAGIC.length + 1 + SALT_SIZE + IV_SIZE // 53 bytes
const AUTH_TAG_SIZE = 16

const EXCLUDED_COLLECTIONS = new Set(['otps', 'captchas'])
const STAGING_PREFIX = '__rs_'
const OLD_PREFIX = '__ro_'

const BACKUP_STORAGE_DIR = path.resolve(
  process.env.BACKUP_STORAGE_DIR || path.join(__dirname, '..', 'backups'),
)
const RESTORE_UPLOAD_TMP_DIR = path.join(os.tmpdir(), 'ekgkala-backup-uploads')
const MAX_UNCOMPRESSED_BYTES = Number(
  process.env.BACKUP_MAX_UNCOMPRESSED_BYTES || 2 * 1024 * 1024 * 1024,
) // 2 GB zip-bomb guard
const RESTORE_BATCH_SIZE = 500
const STAGED_TOKEN_TTL_MS = 15 * 60 * 1000
const DOC_LINE_PREFIX = '{"$ekgRecord":"doc","d":'

const COLLECTION_LABELS_FA = {
  products: 'محصولات و متغیرها',
  categories: 'دسته‌بندی‌ها',
  brands: 'برندها',
  orders: 'سفارش‌ها',
  users: 'کاربران و ادمین‌ها',
  settings: 'تنظیمات فروشگاه و درگاه‌ها',
  banners: 'بنرها و اسلایدر',
  posts: 'مقالات وبلاگ',
  blogcategories: 'دسته‌بندی‌های وبلاگ',
  pages: 'صفحات و سئو',
  coupons: 'کدهای تخفیف',
  sales: 'تخفیف‌های زمان‌دار و کمپین‌ها',
  salesevents: 'رویدادهای فروش',
  reviews: 'دیدگاه‌ها و امتیازها',
  tickets: 'تیکت‌های پشتیبانی',
  rmas: 'درخواست‌های مرجوعی (RMA)',
  carts: 'سبدهای خرید',
  addresses: 'آدرس‌های مشتریان',
  shippingmethods: 'روش‌های ارسال',
  announcements: 'اعلانیه‌ها',
  newsletters: 'خبرنامه',
  notifications: 'اعلان‌های کاربران',
  aiproviders: 'ارائه‌دهندگان هوش مصنوعی',
  chathistories: 'تاریخچه چت هوشمند',
  attributedefs: 'تعاریف ویژگی‌های فنی',
  attributevalues: 'مقادیر ویژگی‌های فنی',
  spectemplates: 'قالب‌های مشخصات فنی',
  specreviews: 'بازبینی مشخصات فنی',
  facetplans: 'طرح‌های فیلتر دسته‌بندی',
  facetstats: 'آمار فیلترها',
  productscores: 'امتیاز پرفروش‌ترین‌ها',
  productviews: 'آمار بازدید محصولات',
  search_history: 'تاریخچه جستجوها',
  auditlogs: 'گزارش عملکرد سیستم (Audit Logs)',
  blockedips: 'آی‌پی‌های مسدودشده',
}

const FORBIDDEN_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const SAFE_INDEX_OPTION_KEYS = [
  'name',
  'unique',
  'sparse',
  'expireAfterSeconds',
  'partialFilterExpression',
  'weights',
  'default_language',
  'language_override',
  'textIndexVersion',
  'collation',
  'wildcardProjection',
  'hidden',
  'bits',
  'min',
  'max',
  '2dsphereIndexVersion',
  'bucketSize',
]

const SAFE_COLLECTION_OPTION_KEYS = [
  'collation',
  'capped',
  'size',
  'max',
  'validator',
  'validationLevel',
  'validationAction',
]

// Exclusive lock for restore (and checked by backup creation)
let activeOperation = null
// Staged upload / inspection tokens (15 min TTL)
const stagedRestoreMap = new Map()

function createCodedError(message, code, statusCode = 400) {
  const err = new Error(message)
  err.code = code
  err.statusCode = statusCode
  return err
}

function getOperationStatus() {
  return activeOperation ? { ...activeOperation } : null
}

function isValidCollectionName(name) {
  if (typeof name !== 'string') return false
  if (name.length < 1 || name.length > 100) return false
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,99}$/.test(name)) return false
  if (name.includes('..') || name.includes('$') || name.includes('\0')) return false
  if (
    name.startsWith('system.') ||
    name.startsWith(STAGING_PREFIX) ||
    name.startsWith(OLD_PREFIX)
  ) {
    return false
  }
  return true
}

function shouldIncludeCollection(name) {
  return isValidCollectionName(name) && !EXCLUDED_COLLECTIONS.has(name)
}

function getCollectionLabelFa(name) {
  return COLLECTION_LABELS_FA[name] || name
}

function sanitizeCollectionOptions(rawOptions) {
  if (!rawOptions || typeof rawOptions !== 'object') return {}
  const out = {}
  for (const key of SAFE_COLLECTION_OPTION_KEYS) {
    if (rawOptions[key] !== undefined) {
      out[key] = rawOptions[key]
    }
  }
  return out
}

function normalizeIndexSpecForCreate(rawIndex) {
  if (!rawIndex || typeof rawIndex !== 'object') return null
  const sourceOpts =
    rawIndex.options && typeof rawIndex.options === 'object' ? rawIndex.options : rawIndex
  if (sourceOpts.name === '_id_' || !rawIndex.key || typeof rawIndex.key !== 'object') {
    return null
  }

  let keySpec = {}
  if (rawIndex.key._fts === 'text') {
    for (const [k, v] of Object.entries(rawIndex.key)) {
      if (k === '_fts' || k === '_ftsx') continue
      keySpec[k] = v
    }
    const weights = sourceOpts.weights || rawIndex.weights
    if (weights && typeof weights === 'object') {
      for (const field of Object.keys(weights)) {
        keySpec[field] = 'text'
      }
    }
    if (Object.keys(keySpec).length === 0) {
      return null
    }
  } else {
    keySpec = { ...rawIndex.key }
  }

  const options = {}
  for (const optKey of SAFE_INDEX_OPTION_KEYS) {
    if (sourceOpts[optKey] !== undefined) {
      options[optKey] = sourceOpts[optKey]
    }
  }

  return { key: keySpec, options }
}

function collectMediaUrlsFromDoc(doc, urlSet, parspackSet, depth = 0) {
  if (!doc || depth > 12) return
  if (urlSet.size >= 200000) return

  if (typeof doc === 'string') {
    const trimmed = doc.trim()
    if (!trimmed || trimmed.length > 2048) return
    const isMediaUrl =
      /^https?:\/\/.+\.(webp|jpe?g|png|gif|avif|svg)(\?.*)?$/i.test(trimmed) ||
      trimmed.includes('parspack.net') ||
      trimmed.startsWith('/uploads/')
    if (isMediaUrl) {
      urlSet.add(trimmed)
      if (trimmed.includes('parspack.net') || trimmed.includes('/uploads/')) {
        parspackSet.add(trimmed)
      }
    }
    return
  }

  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      collectMediaUrlsFromDoc(doc[i], urlSet, parspackSet, depth + 1)
    }
    return
  }

  if (typeof doc === 'object') {
    if (doc._bsontype || doc instanceof Date || Buffer.isBuffer(doc)) return
    for (const val of Object.values(doc)) {
      collectMediaUrlsFromDoc(val, urlSet, parspackSet, depth + 1)
    }
  }
}

function hasForbiddenProtoKeys(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return false
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenProtoKeys(item, depth + 1))
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_PROTO_KEYS.has(key)) return true
    if (hasForbiddenProtoKeys(value[key], depth + 1)) return true
  }
  return false
}

function deriveKeyScrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      String(password),
      salt,
      32,
      { N: 16384, r: 8, p: 1 },
      (err, derivedKey) => {
        if (err) reject(err)
        else resolve(derivedKey)
      },
    )
  })
}

async function detectFileFormat(filePath) {
  const fh = await fs.promises.open(filePath, 'r')
  try {
    const buf = Buffer.alloc(8)
    const { bytesRead } = await fh.read(buf, 0, 8, 0)
    if (bytesRead >= 8 && buf.subarray(0, 8).equals(ENCRYPTED_MAGIC)) {
      return 'encrypted'
    }
    if (bytesRead >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      return 'gzip'
    }
    return 'unknown'
  } finally {
    await fh.close()
  }
}

function safeBackupFilename(filename, baseDir = BACKUP_STORAGE_DIR) {
  if (typeof filename !== 'string') {
    throw createCodedError('نام فایل بکاپ نامعتبر است', 'INVALID_BACKUP_FILENAME', 400)
  }
  const trimmed = filename.trim()
  if (!/^[a-zA-Z0-9_-]+\.ekg\.(gz|enc)$/.test(trimmed)) {
    throw createCodedError('نام فایل بکاپ نامعتبر است', 'INVALID_BACKUP_FILENAME', 400)
  }
  const resolvedBase = path.resolve(baseDir)
  const resolvedTarget = path.resolve(resolvedBase, trimmed)
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw createCodedError('مسیر فایل بکاپ نامعتبر است', 'INVALID_BACKUP_PATH', 400)
  }
  return resolvedTarget
}

function buildBackupFilename({ trigger = 'manual', encrypted = false, date = new Date() } = {}) {
  const safeTrigger = String(trigger || 'manual')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'manual'

  const pad = (n) => String(n).padStart(2, '0')
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  const hh = pad(date.getUTCHours())
  const mm = pad(date.getUTCMinutes())
  const ss = pad(date.getUTCSeconds())
  const rand = crypto.randomBytes(2).toString('hex')
  const ext = encrypted ? 'ekg.enc' : 'ekg.gz'

  return `ekgkala-${safeTrigger}-${y}${m}${d}-${hh}${mm}${ss}-${rand}.${ext}`
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

let warnedFallbackDir = false
async function resolveWritableStorageDir(preferredDir = BACKUP_STORAGE_DIR) {
  const target = path.resolve(preferredDir || BACKUP_STORAGE_DIR)
  try {
    await ensureDir(target)
    await fs.promises.access(target, fs.constants.W_OK)
    return target
  } catch (err) {
    const isPermErr = err && (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EROFS')
    if (isPermErr && target === BACKUP_STORAGE_DIR) {
      const fallbackDir = path.join(os.tmpdir(), 'ekgkala-backups')
      if (!warnedFallbackDir) {
        warnedFallbackDir = true
        console.warn(`[BackupService] Storage dir ${target} not writable (${err.code}); falling back to ${fallbackDir}`)
      }
      await ensureDir(fallbackDir)
      return fallbackDir
    }
    throw err
  }
}

function metaSidecarPath(archivePath) {
  return `${archivePath}.meta.json`
}

async function safeUnlinkFile(targetPath) {
  if (!targetPath) return
  try {
    await fs.promises.unlink(targetPath)
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('[BackupService] Failed to unlink file:', targetPath, err.message)
    }
  }
}

async function cleanupExpiredStagedUploads() {
  const now = Date.now()
  for (const [token, entry] of stagedRestoreMap.entries()) {
    if (!entry || entry.expiresAt <= now) {
      stagedRestoreMap.delete(token)
      if (entry?.source === 'upload' && entry.filePath) {
        await safeUnlinkFile(entry.filePath)
      }
    }
  }
}

async function registerStagedBackup(entry) {
  await cleanupExpiredStagedUploads()
  const token = crypto.randomBytes(24).toString('hex')
  stagedRestoreMap.set(token, {
    ...entry,
    expiresAt: Date.now() + STAGED_TOKEN_TTL_MS,
  })
  return token
}

async function getStagedBackup(token, userId) {
  await cleanupExpiredStagedUploads()
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) {
    return null
  }
  const entry = stagedRestoreMap.get(token)
  if (!entry) return null
  if (userId && entry.createdBy && String(entry.createdBy) !== String(userId)) {
    return null
  }
  return entry
}

async function consumeStagedBackup(token, unlinkUpload = true) {
  const entry = stagedRestoreMap.get(token)
  stagedRestoreMap.delete(token)
  if (unlinkUpload && entry?.source === 'upload' && entry.filePath) {
    await safeUnlinkFile(entry.filePath)
  }
  return entry
}

async function getDatabaseOverview(db) {
  if (!db) {
    throw createCodedError('اتصال به پایگاه داده برقرار نیست', 'DB_NOT_CONNECTED', 503)
  }

  const rawCollections = await db.listCollections({ type: 'collection' }).toArray()
  const included = []
  const excluded = []

  for (const colInfo of rawCollections) {
    const name = colInfo.name
    if (shouldIncludeCollection(name)) {
      included.push(colInfo)
    } else if (
      name &&
      !name.startsWith(STAGING_PREFIX) &&
      !name.startsWith(OLD_PREFIX)
    ) {
      excluded.push(name)
    }
  }

  included.sort((a, b) => a.name.localeCompare(b.name))
  excluded.sort()

  const collections = []
  let totalDocuments = 0
  let totalIndexes = 0
  let totalDataSizeBytes = 0

  for (const colInfo of included) {
    const name = colInfo.name
    const col = db.collection(name)
    const [count, indexes] = await Promise.all([
      col.countDocuments({}),
      col.indexes().catch(() => []),
    ])

    let dataSizeBytes = 0
    if (typeof db.command === 'function') {
      try {
        const stats = await db.command({ collStats: name })
        dataSizeBytes = Number(stats?.size || 0)
      } catch {
        dataSizeBytes = 0
      }
    }

    const customIndexCount = Array.isArray(indexes)
      ? indexes.filter((idx) => idx && idx.name !== '_id_').length
      : 0

    totalDocuments += count
    totalIndexes += customIndexCount
    totalDataSizeBytes += dataSizeBytes

    collections.push({
      name,
      label: getCollectionLabelFa(name),
      documentCount: count,
      indexCount: customIndexCount,
      dataSizeBytes,
    })
  }

  const byName = Object.fromEntries(collections.map((c) => [c.name, c.documentCount]))

  return {
    database: db.databaseName || 'ekgkala',
    collections,
    excludedCollections: excluded,
    summary: {
      totalCollections: collections.length,
      totalDocuments,
      totalIndexes,
      totalDataSizeBytes,
      productsCount: byName.products || 0,
      ordersCount: byName.orders || 0,
      usersCount: byName.users || 0,
      categoriesCount: byName.categories || 0,
      brandsCount: byName.brands || 0,
    },
    activeOperation: getOperationStatus(),
  }
}

async function createBackupFile({
  db,
  outputPath,
  password = '',
  trigger = 'manual',
  note = '',
  createdBy = null,
  writeMetaSidecar = false,
}) {
  if (!db) {
    throw createCodedError('اتصال به پایگاه داده برقرار نیست', 'DB_NOT_CONNECTED', 503)
  }
  if (activeOperation) {
    throw createCodedError(
      'در حال حاضر عملیات بازیابی در حال انجام است. لطفاً پس از پایان دوباره تلاش کنید.',
      'BACKUP_OPERATION_IN_PROGRESS',
      409,
    )
  }

  const cleanPassword = typeof password === 'string' ? password : ''
  const encrypted = cleanPassword.length > 0
  if (encrypted && (cleanPassword.length < 6 || cleanPassword.length > 128)) {
    throw createCodedError(
      'رمز عبور بکاپ باید بین ۶ تا ۱۲۸ کاراکتر باشد',
      'INVALID_BACKUP_PASSWORD',
      400,
    )
  }

  await ensureDir(path.dirname(outputPath))
  const partPath = `${outputPath}.part-${crypto.randomBytes(4).toString('hex')}`

  const rawCollections = await db.listCollections({ type: 'collection' }).toArray()
  const targetCollections = rawCollections
    .filter((c) => shouldIncludeCollection(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  let storeName = ''
  try {
    if (targetCollections.some((c) => c.name === 'settings')) {
      const sDoc = await db.collection('settings').findOne(
        { singletonKey: 'main_settings' },
        { projection: { storeName: 1 } },
      )
      storeName = sDoc?.storeName || ''
    }
  } catch {
    storeName = ''
  }

  const createdAt = new Date().toISOString()
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 200) : ''

  const outFile = fs.createWriteStream(partPath)
  const gzip = zlib.createGzip({ level: 6 })
  let cipher = null

  const outDone = new Promise((resolve, reject) => {
    const onErr = (err) => reject(err)
    outFile.on('error', onErr)
    gzip.on('error', onErr)
    if (cipher) cipher.on('error', onErr)
    outFile.on('finish', resolve)
  })

  try {
    if (encrypted) {
      const salt = crypto.randomBytes(SALT_SIZE)
      const iv = crypto.randomBytes(IV_SIZE)
      const key = await deriveKeyScrypt(cleanPassword, salt)
      cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      cipher.on('error', (err) => outFile.destroy(err))

      const headerBuf = Buffer.concat([
        ENCRYPTED_MAGIC,
        Buffer.from([KDF_SCRYPT_ID]),
        salt,
        iv,
      ])
      if (!outFile.write(headerBuf)) {
        await once(outFile, 'drain')
      }

      gzip.pipe(cipher)
      cipher.pipe(outFile, { end: false })
      cipher.on('end', () => {
        try {
          const authTag = cipher.getAuthTag()
          outFile.end(authTag)
        } catch (tagErr) {
          outFile.destroy(tagErr)
        }
      })
    } else {
      gzip.pipe(outFile)
    }

    const writeChunk = async (str) => {
      if (!gzip.write(str, 'utf8')) {
        await once(gzip, 'drain')
      }
    }

    const payloadHash = crypto.createHash('sha256')
    const collectionSummaries = []
    const mediaUrls = new Set()
    const parspackMediaUrls = new Set()
    let totalDocuments = 0
    let totalIndexes = 0

    const headerRecord = {
      $ekgRecord: 'header',
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt,
      database: db.databaseName || 'ekgkala',
      storeName,
      trigger,
      note: cleanNote,
      createdBy: createdBy ? String(createdBy) : null,
      totalCollections: targetCollections.length,
    }
    await writeChunk(`${JSON.stringify(headerRecord)}\n`)

    for (const colInfo of targetCollections) {
      const colName = colInfo.name
      const col = db.collection(colName)
      const rawIndexes = await col.indexes().catch(() => [])
      const normalizedIndexes = rawIndexes
        .map(normalizeIndexSpecForCreate)
        .filter(Boolean)
      const sanitizedOptions = sanitizeCollectionOptions(colInfo.options)

      const startRecord = {
        $ekgRecord: 'collection_start',
        name: colName,
        options: sanitizedOptions,
        indexes: normalizedIndexes,
      }
      await writeChunk(`${getEjson().stringify(startRecord, { relaxed: false })}\n`)

      const colHash = crypto.createHash('sha256')
      let colCount = 0

      const cursor = col.find({}).batchSize(RESTORE_BATCH_SIZE)
      try {
        for await (const doc of cursor) {
          const docJson = getEjson().stringify(doc, { relaxed: false })
          const docLine = `${DOC_LINE_PREFIX}${docJson}}\n`
          const hashChunk = `${docJson}\n`
          colHash.update(hashChunk)
          payloadHash.update(hashChunk)
          collectMediaUrlsFromDoc(doc, mediaUrls, parspackMediaUrls)
          colCount++
          totalDocuments++
          await writeChunk(docLine)
        }
      } finally {
        if (typeof cursor.close === 'function') {
          await cursor.close().catch(() => {})
        }
      }

      const colSha256 = colHash.digest('hex')
      const endRecord = {
        $ekgRecord: 'collection_end',
        name: colName,
        count: colCount,
        sha256: colSha256,
      }
      await writeChunk(`${JSON.stringify(endRecord)}\n`)

      totalIndexes += normalizedIndexes.length
      collectionSummaries.push({
        name: colName,
        label: getCollectionLabelFa(colName),
        count: colCount,
        indexCount: normalizedIndexes.length,
        sha256: colSha256,
      })
    }

    const payloadSha256 = payloadHash.digest('hex')
    const finishedAt = new Date().toISOString()
    const footerRecord = {
      $ekgRecord: 'footer',
      finishedAt,
      totalCollections: collectionSummaries.length,
      totalDocuments,
      totalIndexes,
      payloadSha256,
      collections: collectionSummaries,
      mediaSummary: {
        totalMediaUrls: mediaUrls.size,
        parspackUrls: parspackMediaUrls.size,
      },
    }
    await writeChunk(`${JSON.stringify(footerRecord)}\n`)

    gzip.end()
    await outDone

    await fs.promises.rename(partPath, outputPath)
    const stat = await fs.promises.stat(outputPath)

    const metadata = {
      filename: path.basename(outputPath),
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt,
      finishedAt,
      database: db.databaseName || 'ekgkala',
      storeName,
      trigger,
      note: cleanNote,
      createdBy: createdBy ? String(createdBy) : null,
      encrypted,
      sizeBytes: stat.size,
      totalCollections: collectionSummaries.length,
      totalDocuments,
      totalIndexes,
      payloadSha256,
      collections: collectionSummaries,
      mediaSummary: footerRecord.mediaSummary,
    }

    if (writeMetaSidecar) {
      const metaPart = `${metaSidecarPath(outputPath)}.part-${crypto.randomBytes(3).toString('hex')}`
      await fs.promises.writeFile(metaPart, JSON.stringify(metadata, null, 2), 'utf8')
      await fs.promises.rename(metaPart, metaSidecarPath(outputPath))
    }

    return metadata
  } catch (err) {
    gzip.destroy()
    if (cipher) cipher.destroy()
    outFile.destroy()
    await safeUnlinkFile(partPath)
    throw err
  }
}

function normalizeReadStreamError(err, encrypted) {
  if (!err) return createCodedError('خطا در خواندن فایل بکاپ', 'BACKUP_READ_ERROR', 400)
  if (err.code && String(err.code).startsWith('BACKUP_')) return err

  const msg = String(err.message || '')
  if (
    encrypted &&
    (msg.includes('Unsupported state or unable to authenticate data') ||
      msg.includes('bad decrypt') ||
      err.code === 'ERR_OSSL_BAD_DECRYPT')
  ) {
    return createCodedError(
      'رمز عبور فایل بکاپ اشتباه است یا فایل آسیب دیده است',
      'BACKUP_DECRYPT_FAILED',
      400,
    )
  }

  if (
    msg.includes('incorrect header check') ||
    msg.includes('unexpected end of file') ||
    msg.includes('invalid distance') ||
    msg.includes('unknown compression method') ||
    msg.includes('invalid block type') ||
    msg.includes('invalid stored block lengths') ||
    msg.includes('too many length or distance symbols') ||
    err.code === 'Z_DATA_ERROR' ||
    err.code === 'Z_BUF_ERROR'
  ) {
    if (encrypted) {
      return createCodedError(
        'رمز عبور فایل بکاپ اشتباه است یا فایل آسیب دیده است',
        'BACKUP_DECRYPT_FAILED',
        400,
      )
    }
    return createCodedError(
      'فایل بکاپ معتبر نیست یا در حین انتقال آسیب دیده است',
      'BACKUP_CORRUPT_ARCHIVE',
      400,
    )
  }

  return createCodedError(
    `خطا در پردازش فایل بکاپ: ${msg}`,
    'BACKUP_READ_ERROR',
    400,
  )
}

async function iterateBackupLines(filePath, password, onLine) {
  const format = await detectFileFormat(filePath)
  if (format === 'unknown') {
    throw createCodedError(
      'فرمت فایل بکاپ معتبر نیست (فقط فایل‌های .ekg.gz و .ekg.enc پشتیبانی می‌شوند)',
      'BACKUP_INVALID_FORMAT',
      400,
    )
  }

  const encrypted = format === 'encrypted'
  let readStream = null
  let decipher = null
  let gunzip = null
  let limitTransform = null

  if (encrypted) {
    if (typeof password !== 'string' || password.length === 0) {
      throw createCodedError(
        'این فایل بکاپ رمزنگاری شده است. لطفاً رمز عبور را وارد کنید.',
        'BACKUP_PASSWORD_REQUIRED',
        400,
      )
    }

    const fh = await fs.promises.open(filePath, 'r')
    let salt
    let iv
    let authTag
    let fileSize
    try {
      const stat = await fh.stat()
      fileSize = stat.size
      if (fileSize < HEADER_SIZE + AUTH_TAG_SIZE + 2) {
        throw createCodedError(
          'فایل بکاپ رمزنگاری‌شده ناقص یا آسیب‌دیده است',
          'BACKUP_CORRUPT_ARCHIVE',
          400,
        )
      }
      const headerBuf = Buffer.alloc(HEADER_SIZE)
      await fh.read(headerBuf, 0, HEADER_SIZE, 0)
      if (!headerBuf.subarray(0, ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC)) {
        throw createCodedError('امضای فایل رمزنگاری‌شده نامعتبر است', 'BACKUP_INVALID_FORMAT', 400)
      }
      const kdfId = headerBuf[ENCRYPTED_MAGIC.length]
      if (kdfId !== KDF_SCRYPT_ID) {
        throw createCodedError('نسخه رمزنگاری فایل بکاپ پشتیبانی نمی‌شود', 'BACKUP_INVALID_FORMAT', 400)
      }
      salt = headerBuf.subarray(ENCRYPTED_MAGIC.length + 1, ENCRYPTED_MAGIC.length + 1 + SALT_SIZE)
      iv = headerBuf.subarray(ENCRYPTED_MAGIC.length + 1 + SALT_SIZE, HEADER_SIZE)

      authTag = Buffer.alloc(AUTH_TAG_SIZE)
      await fh.read(authTag, 0, AUTH_TAG_SIZE, fileSize - AUTH_TAG_SIZE)
    } finally {
      await fh.close()
    }

    const key = await deriveKeyScrypt(password, salt)
    readStream = fs.createReadStream(filePath, {
      start: HEADER_SIZE,
      end: fileSize - AUTH_TAG_SIZE - 1,
    })
    decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
  } else {
    readStream = fs.createReadStream(filePath)
  }

  gunzip = zlib.createGunzip()
  let totalBytes = 0
  limitTransform = new Transform({
    transform(chunk, _encoding, callback) {
      totalBytes += chunk.length
      if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
        callback(
          createCodedError(
            'حجم بازشده فایل بکاپ بیش از حد مجاز است',
            'BACKUP_SIZE_LIMIT_EXCEEDED',
            400,
          ),
        )
        return
      }
      callback(null, chunk)
    },
  })

  const rl = readline.createInterface({
    input: limitTransform,
    crlfDelay: Infinity,
  })

  const stages = [readStream, decipher, gunzip, limitTransform].filter(Boolean)
  let streamErr = null
  const onStageError = (err) => {
    if (!streamErr) {
      streamErr = normalizeReadStreamError(err, encrypted)
    }
    rl.close()
    for (const s of stages) {
      if (s && !s.destroyed) {
        s.destroy()
      }
    }
  }

  for (const s of stages) {
    s.on('error', onStageError)
  }
  rl.on('error', onStageError)

  if (decipher) {
    readStream.pipe(decipher).pipe(gunzip).pipe(limitTransform)
  } else {
    readStream.pipe(gunzip).pipe(limitTransform)
  }

  let lineNumber = 0
  try {
    for await (const line of rl) {
      if (streamErr) throw streamErr
      if (!line) continue
      lineNumber++
      await onLine(line, lineNumber)
    }
    if (streamErr) throw streamErr
  } catch (err) {
    throw streamErr || normalizeReadStreamError(err, encrypted)
  } finally {
    rl.close()
    for (const s of stages) {
      if (s && !s.destroyed) {
        s.destroy()
      }
    }
  }

  return { encrypted, uncompressedBytes: totalBytes }
}

function parseControlRecord(line, lineNumber) {
  let obj
  try {
    obj = JSON.parse(line)
  } catch {
    throw createCodedError(
      `ساختار فایل بکاپ در خط ${lineNumber} خراب است`,
      'BACKUP_CORRUPT_ARCHIVE',
      400,
    )
  }
  if (!obj || typeof obj !== 'object' || hasForbiddenProtoKeys(obj)) {
    throw createCodedError(
      `رکورد نامعتبر در خط ${lineNumber} فایل بکاپ`,
      'BACKUP_CORRUPT_ARCHIVE',
      400,
    )
  }
  return obj
}

function parseDocLine(line, lineNumber) {
  if (!line.startsWith(DOC_LINE_PREFIX) || !line.endsWith('}')) {
    throw createCodedError(
      `رکورد سند نامعتبر در خط ${lineNumber}`,
      'BACKUP_CORRUPT_ARCHIVE',
      400,
    )
  }
  const rawDocJson = line.slice(DOC_LINE_PREFIX.length, -1)
  let doc
  try {
    doc = getEjson().parse(rawDocJson, { relaxed: false })
  } catch {
    throw createCodedError(
      `خطا در خواندن داده BSON در خط ${lineNumber}`,
      'BACKUP_CORRUPT_ARCHIVE',
      400,
    )
  }
  if (!doc || typeof doc !== 'object') {
    throw createCodedError(
      `سند غیرمعتبر در خط ${lineNumber}`,
      'BACKUP_CORRUPT_ARCHIVE',
      400,
    )
  }
  return { rawDocJson, doc }
}

async function inspectBackupFile({
  filePath,
  password = '',
  db = null,
  currentUserId = null,
}) {
  let header = null
  let footer = null
  let currentCollection = null
  const seenCollections = new Set()
  const payloadHash = crypto.createHash('sha256')
  const inspectedCollections = []
  let totalDocuments = 0
  let totalIndexes = 0
  const restoredSuperadmins = []
  let currentAdminInBackup = false

  const { encrypted, uncompressedBytes } = await iterateBackupLines(
    filePath,
    password,
    async (line, lineNumber) => {
      if (footer) {
        throw createCodedError(
          'داده‌های غیرمجاز پس از انتهای فایل بکاپ وجود دارد',
          'BACKUP_CORRUPT_ARCHIVE',
          400,
        )
      }

      if (line.startsWith(DOC_LINE_PREFIX)) {
        if (!currentCollection) {
          throw createCodedError(
            `سند بدون مجموعه در خط ${lineNumber}`,
            'BACKUP_CORRUPT_ARCHIVE',
            400,
          )
        }
        const { rawDocJson, doc } = parseDocLine(line, lineNumber)
        const hashChunk = `${rawDocJson}\n`
        currentCollection.hash.update(hashChunk)
        payloadHash.update(hashChunk)
        currentCollection.count++
        totalDocuments++

        if (currentCollection.name === 'users') {
          if (doc.role === 'superadmin' && doc.isActive !== false) {
            if (restoredSuperadmins.length < 20 && doc.email) {
              restoredSuperadmins.push(String(doc.email))
            }
          }
          if (currentUserId && doc._id && String(doc._id) === String(currentUserId)) {
            currentAdminInBackup = doc.isActive !== false && doc.role === 'superadmin'
          }
        }
        return
      }

      const rec = parseControlRecord(line, lineNumber)
      const kind = rec.$ekgRecord

      if (lineNumber === 1) {
        if (kind !== 'header' || rec.format !== BACKUP_FORMAT || rec.version !== BACKUP_VERSION) {
          throw createCodedError(
            'نسخه یا ساختار فایل بکاپ معتبر نیست',
            'BACKUP_INVALID_FORMAT',
            400,
          )
        }
        header = rec
        return
      }

      if (!header) {
        throw createCodedError('هدر فایل بکاپ یافت نشد', 'BACKUP_CORRUPT_ARCHIVE', 400)
      }

      if (kind === 'collection_start') {
        if (currentCollection) {
          throw createCodedError(
            `مجموعه ${currentCollection.name} به درستی بسته نشده است`,
            'BACKUP_CORRUPT_ARCHIVE',
            400,
          )
        }
        let parsedStart
        try {
          parsedStart = getEjson().parse(line, { relaxed: true })
        } catch {
          throw createCodedError(
            `ساختار تعریف مجموعه در خط ${lineNumber} خراب است`,
            'BACKUP_CORRUPT_ARCHIVE',
            400,
          )
        }
        if (!shouldIncludeCollection(parsedStart.name) || seenCollections.has(parsedStart.name)) {
          throw createCodedError(
            `نام مجموعه نامعتبر یا تکراری در بکاپ: ${parsedStart.name}`,
            'BACKUP_INVALID_COLLECTION',
            400,
          )
        }
        seenCollections.add(parsedStart.name)

        const rawIndexes = Array.isArray(parsedStart.indexes) ? parsedStart.indexes : []
        const normalizedIndexes = rawIndexes
          .map(normalizeIndexSpecForCreate)
          .filter(Boolean)

        currentCollection = {
          name: parsedStart.name,
          options: sanitizeCollectionOptions(parsedStart.options),
          indexes: normalizedIndexes,
          count: 0,
          hash: crypto.createHash('sha256'),
        }
        return
      }

      if (kind === 'collection_end') {
        if (!currentCollection || rec.name !== currentCollection.name) {
          throw createCodedError(
            `پایان مجموعه نامعتبر در خط ${lineNumber}`,
            'BACKUP_CORRUPT_ARCHIVE',
            400,
          )
        }
        const computedSha = currentCollection.hash.digest('hex')
        if (Number(rec.count) !== currentCollection.count) {
          throw createCodedError(
            `تعداد رکوردهای مجموعه ${currentCollection.name} با خلاصه بکاپ هم‌خوانی ندارد`,
            'BACKUP_CHECKSUM_MISMATCH',
            400,
          )
        }
        if (rec.sha256 !== computedSha) {
          throw createCodedError(
            `امضای یکپارچگی (SHA-256) مجموعه ${currentCollection.name} معتبر نیست`,
            'BACKUP_CHECKSUM_MISMATCH',
            400,
          )
        }
        totalIndexes += currentCollection.indexes.length
        inspectedCollections.push({
          name: currentCollection.name,
          label: getCollectionLabelFa(currentCollection.name),
          count: currentCollection.count,
          indexCount: currentCollection.indexes.length,
          sha256: computedSha,
        })
        currentCollection = null
        return
      }

      if (kind === 'footer') {
        if (currentCollection) {
          throw createCodedError(
            'پایان فایل بکاپ پیش از بسته شدن مجموعه آخر رسیده است',
            'BACKUP_CORRUPT_ARCHIVE',
            400,
          )
        }
        const computedPayloadSha = payloadHash.digest('hex')
        if (rec.payloadSha256 !== computedPayloadSha) {
          throw createCodedError(
            'کنترل یکپارچگی کل فایل بکاپ (SHA-256) ناموفق بود — فایل دستکاری شده یا ناقص است',
            'BACKUP_CHECKSUM_MISMATCH',
            400,
          )
        }
        if (
          Number(rec.totalCollections) !== inspectedCollections.length ||
          Number(rec.totalDocuments) !== totalDocuments
        ) {
          throw createCodedError(
            'آمار کل رکوردها با محتوای فایل هم‌خوانی ندارد',
            'BACKUP_CHECKSUM_MISMATCH',
            400,
          )
        }
        footer = rec
        return
      }

      throw createCodedError(
        `نوع رکورد ناشناخته در خط ${lineNumber}`,
        'BACKUP_CORRUPT_ARCHIVE',
        400,
      )
    },
  )

  if (!header || !footer || currentCollection) {
    throw createCodedError(
      'فایل بکاپ ناقص است و به انتها نرسیده است',
      'BACKUP_CORRUPT_ARCHIVE',
      400,
    )
  }

  let comparison = []
  let extraLiveCollections = []

  if (db) {
    const liveCols = await db.listCollections({ type: 'collection' }).toArray()
    const liveMap = new Map()
    for (const c of liveCols) {
      if (shouldIncludeCollection(c.name)) {
        const cnt = await db.collection(c.name).countDocuments({})
        liveMap.set(c.name, cnt)
      }
    }

    comparison = inspectedCollections.map((c) => {
      const currentCount = liveMap.has(c.name) ? liveMap.get(c.name) : 0
      return {
        name: c.name,
        label: c.label,
        backupCount: c.count,
        currentCount,
        delta: c.count - currentCount,
        indexCount: c.indexCount,
      }
    })

    for (const [liveName, currentCount] of liveMap.entries()) {
      if (!seenCollections.has(liveName)) {
        extraLiveCollections.push({
          name: liveName,
          label: getCollectionLabelFa(liveName),
          currentCount,
        })
      }
    }
  } else {
    comparison = inspectedCollections.map((c) => ({
      name: c.name,
      label: c.label,
      backupCount: c.count,
      currentCount: null,
      delta: null,
      indexCount: c.indexCount,
    }))
  }

  return {
    valid: true,
    encrypted,
    uncompressedBytes,
    header: {
      format: header.format,
      version: header.version,
      createdAt: header.createdAt,
      database: header.database,
      storeName: header.storeName || '',
      trigger: header.trigger || 'manual',
      note: header.note || '',
    },
    footer: {
      finishedAt: footer.finishedAt,
      totalCollections: inspectedCollections.length,
      totalDocuments,
      totalIndexes,
      payloadSha256: footer.payloadSha256,
      mediaSummary: footer.mediaSummary || { totalMediaUrls: 0, parspackUrls: 0 },
    },
    collections: inspectedCollections,
    comparison,
    extraLiveCollections,
    adminCheck: {
      superadminCount: restoredSuperadmins.length,
      restoredSuperadmins,
      currentAdminInBackup,
      willRequireRelogin: Boolean(currentUserId && !currentAdminInBackup),
    },
  }
}

async function invalidateAllRuntimeCaches() {
  const cleared = { memory: 0, notificationConfig: false, redisPatterns: 0 }

  try {
    const { clearAllCache } = require('../middleware/cache')
    cleared.memory = clearAllCache() || 0
  } catch (err) {
    console.warn('[BackupService] Memory cache clear warning:', err.message)
  }

  try {
    const { invalidateConfigCache } = require('../utils/notificationService')
    invalidateConfigCache()
    cleared.notificationConfig = true
  } catch (err) {
    console.warn('[BackupService] Notification config cache clear warning:', err.message)
  }

  try {
    const redis = require('../utils/redis')
    if (redis && typeof redis.deleteCachePattern === 'function') {
      const patterns = [
        'bestsellers:*',
        'torob:*',
        'search:*',
        'cache:*',
        'products:*',
        'categories:*',
        'settings:*',
      ]
      for (const p of patterns) {
        const deleted = await redis.deleteCachePattern(p)
        cleared.redisPatterns += Number(deleted || 0)
      }
    }
  } catch (err) {
    console.warn('[BackupService] Redis cache clear warning:', err.message)
  }

  return cleared
}

async function dropCollectionIgnoreMissing(db, name) {
  try {
    await db.collection(name).drop()
  } catch (err) {
    if (err && (err.code === 26 || err.codeName === 'NamespaceNotFound' || /ns not found/i.test(err.message))) {
      return
    }
    throw err
  }
}

async function restoreBackupFile({
  filePath,
  password = '',
  db,
  dropUnlistedCollections = true,
  createSafetyBackup = true,
  actor = null,
  storageDir = BACKUP_STORAGE_DIR,
}) {
  if (!db) {
    throw createCodedError('اتصال به پایگاه داده برقرار نیست', 'DB_NOT_CONNECTED', 503)
  }
  if (activeOperation) {
    throw createCodedError(
      'عملیات دیگری هم‌اکنون در حال اجراست. لطفاً صبر کنید.',
      'BACKUP_OPERATION_IN_PROGRESS',
      409,
    )
  }

  const startedAtMs = Date.now()
  activeOperation = {
    type: 'restore',
    startedAt: new Date().toISOString(),
    actor: actor?.email || actor?.id || 'system',
  }

  const runId = crypto.randomBytes(3).toString('hex')
  const createdStaging = []

  try {
    // Phase 1: Full dry-run verification before touching anything
    const inspection = await inspectBackupFile({
      filePath,
      password,
      db,
      currentUserId: actor?.id || null,
    })

    // Phase 2: Pre-restore safety snapshot (temporarily release/bypass check by calling internal logic? No — do it safely!)
    let safetyBackupFile = null
    if (createSafetyBackup) {
      const overview = await getDatabaseOverview(db)
      if (overview.summary.totalDocuments > 0 || overview.summary.totalCollections > 0) {
        const safetyName = buildBackupFilename({ trigger: 'prerestore', encrypted: false })
        const safetyPath = path.join(storageDir, safetyName)
        // Temporarily clear activeOperation only if needed? No, call internal creation by temporarily clearing guard?
        // Better: createBackupFile checks activeOperation; so we guard with helper or temporarily suspend? Wait: we keep activeOperation set and pass internal flag via separate helper? Let's call _createBackupFileInternal.
        const safetyMeta = await _createBackupFileInternal({
          db,
          outputPath: safetyPath,
          password: '',
          trigger: 'pre-restore',
          note: 'بکاپ ایمنی خودکار پیش از بازیابی',
          createdBy: actor?.id || null,
          writeMetaSidecar: true,
        })
        safetyBackupFile = safetyMeta.filename
      }
    }

    // Phase 3: Stream documents & indexes into staging collections
    let activeStage = null
    let batch = []
    let restoredIndexes = 0

    const flushBatch = async () => {
      if (!activeStage || batch.length === 0) return
      const docsToInsert = batch
      batch = []
      await activeStage.col.insertMany(docsToInsert, { ordered: true })
    }

    try {
      await iterateBackupLines(filePath, password, async (line, lineNumber) => {
        if (line.startsWith(DOC_LINE_PREFIX)) {
          if (!activeStage) {
            throw createCodedError(`سند خارج از مجموعه در خط ${lineNumber}`, 'BACKUP_CORRUPT_ARCHIVE', 400)
          }
          const { doc } = parseDocLine(line, lineNumber)
          batch.push(doc)
          if (batch.length >= RESTORE_BATCH_SIZE) {
            await flushBatch()
          }
          return
        }

        const rec = parseControlRecord(line, lineNumber)
        if (rec.$ekgRecord === 'collection_start') {
          const parsedStart = getEjson().parse(line, { relaxed: true })
          const targetName = parsedStart.name
          const stageName = `${STAGING_PREFIX}${runId}_${targetName}`
          const opts = sanitizeCollectionOptions(parsedStart.options)
          const col =
            Object.keys(opts).length > 0
              ? await db.createCollection(stageName, opts)
              : await db.createCollection(stageName)
          const normalizedIndexes = (Array.isArray(parsedStart.indexes) ? parsedStart.indexes : [])
            .map(normalizeIndexSpecForCreate)
            .filter(Boolean)

          activeStage = {
            targetName,
            stageName,
            col,
            indexes: normalizedIndexes,
          }
          createdStaging.push({
            targetName,
            stageName,
          })
          return
        }

        if (rec.$ekgRecord === 'collection_end') {
          await flushBatch()
          for (const idx of activeStage.indexes) {
            await activeStage.col.createIndex(idx.key, idx.options)
            restoredIndexes++
          }
          const stagedCount = await activeStage.col.countDocuments({})
          if (stagedCount !== Number(rec.count)) {
            throw createCodedError(
              `عدم تطابق تعداد رکوردهای بازیابی‌شده در ${activeStage.targetName}`,
              'RESTORE_COUNT_MISMATCH',
              500,
            )
          }
          activeStage = null
        }
      })
    } catch (stageErr) {
      for (const s of createdStaging) {
        await dropCollectionIgnoreMissing(db, s.stageName).catch(() => {})
      }
      throw stageErr
    }

    // Phase 4: Atomic-style rename swap with full reverse rollback
    const liveList = await db.listCollections({ type: 'collection' }).toArray()
    const liveSet = new Set(liveList.map((c) => c.name))
    const backedUpSet = new Set(createdStaging.map((s) => s.targetName))

    const swapped = []
    const droppedExtra = []

    try {
      for (const s of createdStaging) {
        const hadLive = liveSet.has(s.targetName)
        const oldName = `${OLD_PREFIX}${runId}_${s.targetName}`
        if (hadLive) {
          await db.collection(s.targetName).rename(oldName, { dropTarget: true })
        }
        await db.collection(s.stageName).rename(s.targetName, { dropTarget: true })
        swapped.push({ targetName: s.targetName, oldName, hadLive })
      }

      if (dropUnlistedCollections) {
        for (const liveName of liveSet) {
          if (shouldIncludeCollection(liveName) && !backedUpSet.has(liveName)) {
            const oldName = `${OLD_PREFIX}${runId}_${liveName}`
            await db.collection(liveName).rename(oldName, { dropTarget: true })
            droppedExtra.push({ targetName: liveName, oldName })
          }
        }
      }
    } catch (swapErr) {
      // Reverse rollback so live DB returns to its exact pre-restore state
      for (let i = droppedExtra.length - 1; i >= 0; i--) {
        const item = droppedExtra[i]
        await db.collection(item.oldName).rename(item.targetName, { dropTarget: true }).catch(() => {})
      }
      for (let i = swapped.length - 1; i >= 0; i--) {
        const item = swapped[i]
        await dropCollectionIgnoreMissing(db, item.targetName).catch(() => {})
        if (item.hadLive) {
          await db.collection(item.oldName).rename(item.targetName, { dropTarget: true }).catch(() => {})
        }
      }
      for (const s of createdStaging) {
        await dropCollectionIgnoreMissing(db, s.stageName).catch(() => {})
      }
      throw swapErr
    }

    // Phase 5: Drop old snapshots (__ro_*)
    for (const item of swapped) {
      if (item.hadLive) {
        await dropCollectionIgnoreMissing(db, item.oldName).catch(() => {})
      }
    }
    for (const item of droppedExtra) {
      await dropCollectionIgnoreMissing(db, item.oldName).catch(() => {})
    }

    // Phase 6: Clear all runtime & Redis caches
    const cacheCleared = await invalidateAllRuntimeCaches()

    return {
      restoredCollections: inspection.footer.totalCollections,
      restoredDocuments: inspection.footer.totalDocuments,
      restoredIndexes,
      droppedExtraCollections: droppedExtra.map((d) => d.targetName),
      safetyBackupFile,
      sessionPreserved: inspection.adminCheck.currentAdminInBackup,
      restoredSuperadmins: inspection.adminCheck.restoredSuperadmins,
      cacheCleared,
      durationMs: Date.now() - startedAtMs,
    }
  } finally {
    activeOperation = null
  }
}

async function _createBackupFileInternal(opts) {
  const prev = activeOperation
  activeOperation = null
  try {
    return await createBackupFile(opts)
  } finally {
    activeOperation = prev
  }
}

async function listServerBackups(storageDir = BACKUP_STORAGE_DIR) {
  const resolvedDir = await resolveWritableStorageDir(storageDir)
  const entries = await fs.promises.readdir(resolvedDir, { withFileTypes: true })
  const items = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!/^[a-zA-Z0-9_-]+\.ekg\.(gz|enc)$/.test(entry.name)) continue

    const fullPath = path.join(resolvedDir, entry.name)
    const stat = await fs.promises.stat(fullPath)
    let meta = null
    try {
      const rawMeta = await fs.promises.readFile(metaSidecarPath(fullPath), 'utf8')
      meta = JSON.parse(rawMeta)
    } catch {
      meta = null
    }

    const encrypted =
      typeof meta?.encrypted === 'boolean'
        ? meta.encrypted
        : entry.name.endsWith('.ekg.enc')

    let inferredTrigger = 'manual'
    if (entry.name.startsWith('ekgkala-auto-')) inferredTrigger = 'auto'
    else if (entry.name.startsWith('ekgkala-prerestore-') || entry.name.startsWith('ekgkala-pre-restore-')) {
      inferredTrigger = 'pre-restore'
    }

    items.push({
      filename: entry.name,
      createdAt: meta?.createdAt || stat.birthtime?.toISOString() || stat.mtime.toISOString(),
      trigger: meta?.trigger || inferredTrigger,
      note: meta?.note || '',
      encrypted,
      sizeBytes: stat.size,
      totalCollections: meta?.totalCollections ?? null,
      totalDocuments: meta?.totalDocuments ?? null,
      totalIndexes: meta?.totalIndexes ?? null,
      payloadSha256: meta?.payloadSha256 || null,
      storeName: meta?.storeName || '',
    })
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return items
}

async function deleteServerBackup(filename, storageDir = BACKUP_STORAGE_DIR) {
  const targetPath = safeBackupFilename(filename, storageDir)
  try {
    await fs.promises.stat(targetPath)
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw createCodedError('فایل بکاپ مورد نظر یافت نشد', 'BACKUP_NOT_FOUND', 404)
    }
    throw err
  }
  await safeUnlinkFile(targetPath)
  await safeUnlinkFile(metaSidecarPath(targetPath))
  return { filename: path.basename(targetPath) }
}

async function pruneAutoBackups(retentionCount = 7, storageDir = BACKUP_STORAGE_DIR) {
  const keep = Math.max(1, Math.min(30, Number(retentionCount) || 7))
  const all = await listServerBackups(storageDir)
  const autoList = all.filter((item) => item.trigger === 'auto' || item.filename.startsWith('ekgkala-auto-'))
  const toRemove = autoList.slice(keep)
  for (const item of toRemove) {
    await deleteServerBackup(item.filename, storageDir).catch(() => {})
  }
  return toRemove.map((i) => i.filename)
}

module.exports = {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BACKUP_STORAGE_DIR,
  RESTORE_UPLOAD_TMP_DIR,
  EXCLUDED_COLLECTIONS,
  COLLECTION_LABELS_FA,
  MAX_UNCOMPRESSED_BYTES,
  getOperationStatus,
  isValidCollectionName,
  shouldIncludeCollection,
  getCollectionLabelFa,
  sanitizeCollectionOptions,
  normalizeIndexSpecForCreate,
  collectMediaUrlsFromDoc,
  detectFileFormat,
  safeBackupFilename,
  buildBackupFilename,
  getDatabaseOverview,
  createBackupFile,
  inspectBackupFile,
  restoreBackupFile,
  listServerBackups,
  deleteServerBackup,
  pruneAutoBackups,
  invalidateAllRuntimeCaches,
  registerStagedBackup,
  getStagedBackup,
  consumeStagedBackup,
  cleanupExpiredStagedUploads,
  safeUnlinkFile,
  getEjson,
  resolveWritableStorageDir,
}
