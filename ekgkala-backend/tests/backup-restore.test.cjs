const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const mongoose = require('mongoose')

const { ObjectId, Decimal128, Binary, Long, Int32, Double, EJSON, serialize, deserialize } = mongoose.mongo.BSON

const {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  isValidCollectionName,
  shouldIncludeCollection,
  normalizeIndexSpecForCreate,
  safeBackupFilename,
  getDatabaseOverview,
  createBackupFile,
  inspectBackupFile,
  restoreBackupFile,
  listServerBackups,
  deleteServerBackup,
  pruneAutoBackups,
  getEjson,
  resolveWritableStorageDir,
} = require('../services/backupService')
const { PERMISSIONS, ROLES } = require('../config/rbac')
const { buildCronExpression } = require('../jobs/backupSchedulerJob')

/**
 * Faithful in-memory mock of MongoDB Db supporting collections, options, indexes,
 * cursors, insertMany, rename (with dropTarget + injectable failure), and drop.
 */
function createMockDb(initial = {}) {
  const store = new Map()
  let failRenameTarget = null

  function ensureCol(name, options = {}) {
    if (!store.has(name)) {
      store.set(name, {
        name,
        options: { ...options },
        docs: [],
        indexes: [{ v: 2, key: { _id: 1 }, name: '_id_' }],
      })
    }
    return store.get(name)
  }

  for (const [name, spec] of Object.entries(initial)) {
    const col = ensureCol(name, spec.options || {})
    col.docs = (spec.docs || []).map((d) => deserialize(serialize(d)))
    if (Array.isArray(spec.indexes)) {
      col.indexes = [{ v: 2, key: { _id: 1 }, name: '_id_' }, ...spec.indexes]
    }
  }

  return {
    databaseName: 'ekgkala_test',
    _store: store,
    setFailRenameOn(targetName) {
      failRenameTarget = targetName
    },
    async command(cmd) {
      if (cmd && cmd.collStats) {
        const col = store.get(cmd.collStats)
        return { size: col ? col.docs.length * 256 : 0 }
      }
      return { ok: 1 }
    },
    listCollections() {
      return {
        toArray: async () =>
          Array.from(store.values()).map((c) => ({
            name: c.name,
            type: 'collection',
            options: c.options,
          })),
      }
    },
    async createCollection(name, options = {}) {
      if (store.has(name)) {
        const err = new Error(`Collection ${name} already exists`)
        err.code = 48
        throw err
      }
      ensureCol(name, options)
      return this.collection(name)
    },
    collection(name) {
      return {
        find() {
          return {
            batchSize() {
              const col = store.get(name)
              const snapshot = col ? [...col.docs] : []
              return {
                async *[Symbol.asyncIterator]() {
                  for (const doc of snapshot) yield doc
                },
                async close() {},
              }
            },
          }
        },
        async findOne(filter = {}) {
          const col = store.get(name)
          if (!col) return null
          return (
            col.docs.find((d) =>
              Object.entries(filter).every(([k, v]) => d[k] === v),
            ) || null
          )
        },
        async insertMany(docs) {
          const col = ensureCol(name)
          for (const d of docs) col.docs.push(deserialize(serialize(d)))
          return { insertedCount: docs.length }
        },
        async countDocuments() {
          const col = store.get(name)
          return col ? col.docs.length : 0
        },
        async indexes() {
          const col = store.get(name)
          return col ? [...col.indexes] : []
        },
        async createIndex(key, options = {}) {
          const col = ensureCol(name)
          const idxName =
            options.name ||
            Object.entries(key)
              .map(([k, v]) => `${k}_${v}`)
              .join('_')
          col.indexes.push({ v: 2, key, name: idxName, ...options })
          return idxName
        },
        async rename(newName, { dropTarget = false } = {}) {
          if (failRenameTarget && (newName === failRenameTarget || name === failRenameTarget)) {
            throw new Error(`Injected rename failure for ${name} -> ${newName}`)
          }
          const col = store.get(name)
          if (!col) {
            const err = new Error(`ns not found: ${name}`)
            err.code = 26
            err.codeName = 'NamespaceNotFound'
            throw err
          }
          if (store.has(newName)) {
            if (dropTarget) {
              store.delete(newName)
            } else {
              throw new Error(`target namespace ${newName} exists`)
            }
          }
          store.delete(name)
          col.name = newName
          store.set(newName, col)
        },
        async drop() {
          if (!store.has(name)) {
            const err = new Error(`ns not found: ${name}`)
            err.code = 26
            err.codeName = 'NamespaceNotFound'
            throw err
          }
          store.delete(name)
        },
      }
    },
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ekgkala-backup-test-'))
}

test('۱. بکاپ و بازیابی کامل با حفظ دقیق انواع BSON و فیلدهای محرمانه (select:false)', async () => {
  const tmpDir = makeTempDir()
  const adminId = new ObjectId()
  const catId = new ObjectId()
  const prodId = new ObjectId()
  const createdAt = new Date('2026-06-01T10:15:30.123Z')

  const db = createMockDb({
    products: {
      docs: [
        {
          _id: prodId,
          name: 'دوربین مداربسته داهوا ۴ مگاپیکسل',
          slug: 'dahua-4mp',
          category: catId,
          price: 4500000,
          rating: 4.75,
          costPrice: 3800000,
          hardFloorPrice: 4100000,
          supplierQuotes: [{ supplierName: 'پخش مرکزی', rawPrice: 3750000 }],
          exactMargin: Decimal128.fromString('15.50'),
          rawThumb: new Binary(Buffer.from('webp-thumb')),
          bigCounter: Long.fromString('9007199254740995'),
          variants: [
            {
              _id: new ObjectId(),
              sku: 'DH-4MP-BLK',
              price: 4550000,
              stock: 12,
              images: [{ url: 'https://c258565.parspack.net/ekgkala-uploads/uploads/cam1.webp', public_id: 'cam1.webp' }],
            },
          ],
          createdAt,
        },
      ],
      indexes: [
        { v: 2, key: { slug: 1 }, name: 'slug_1', unique: true, sparse: true },
        { v: 2, key: { _fts: 'text', _ftsx: 1 }, name: 'name_text_description_text', weights: { name: 10, description: 5 }, default_language: 'english' },
        { v: 2, key: { isActive: 1, category: 1 }, name: 'active_cat', partialFilterExpression: { isActive: true } },
      ],
    },
    users: {
      docs: [
        {
          _id: adminId,
          name: 'مدیر ارشد',
          email: 'super@ekgkala.ir',
          password: '$2b$12$hashedSecretPasswordValue',
          role: 'superadmin',
          isActive: true,
        },
      ],
    },
    settings: {
      docs: [
        {
          _id: new ObjectId(),
          singletonKey: 'main_settings',
          storeName: 'ای‌کا‌جی کالا',
          paymentConfig: { activeGateway: 'zarinpal', zarinpal: { merchantId: 'secret-merchant-uuid' } },
          notificationSettings: { smsUsername: 'secret-sms', smsPassword: 'secret-pass' },
        },
      ],
    },
    search_history: {
      docs: [{ _id: new ObjectId(), query: 'دوربین داهوا', count: 14 }],
    },
    empty_logs: {
      docs: [],
      indexes: [{ v: 2, key: { createdAt: 1 }, name: 'ttl_idx', expireAfterSeconds: 3600 }],
    },
  })

  try {
    const backupPath = path.join(tmpDir, 'test-full.ekg.gz')
    const meta = await createBackupFile({
      db,
      outputPath: backupPath,
      trigger: 'manual',
      note: 'تست یکپارچه',
      createdBy: adminId.toString(),
      writeMetaSidecar: true,
    })

    assert.equal(meta.format, BACKUP_FORMAT)
    assert.equal(meta.version, BACKUP_VERSION)
    assert.equal(meta.totalCollections, 5)
    assert.equal(meta.totalDocuments, 4)
    assert.equal(meta.totalIndexes, 4)
    assert.equal(meta.mediaSummary.parspackUrls, 1)

    const inspection = await inspectBackupFile({
      filePath: backupPath,
      db,
      currentUserId: adminId.toString(),
    })
    assert.equal(inspection.valid, true)
    assert.equal(inspection.adminCheck.currentAdminInBackup, true)
    assert.deepEqual(inspection.adminCheck.restoredSuperadmins, ['super@ekgkala.ir'])

    // Wipe entire DB completely to simulate total data loss
    for (const name of ['products', 'users', 'settings', 'search_history', 'empty_logs']) {
      await db.collection(name).drop()
    }
    assert.equal((await db.listCollections().toArray()).length, 0)

    const restoreResult = await restoreBackupFile({
      filePath: backupPath,
      db,
      createSafetyBackup: false,
      actor: { id: adminId.toString(), email: 'super@ekgkala.ir' },
      storageDir: tmpDir,
    })

    assert.equal(restoreResult.restoredCollections, 5)
    assert.equal(restoreResult.restoredDocuments, 4)
    assert.equal(restoreResult.restoredIndexes, 4)
    assert.equal(restoreResult.sessionPreserved, true)

    const restoredProd = await db.collection('products').findOne({ slug: 'dahua-4mp' })
    assert.ok(restoredProd)
    assert.ok(restoredProd._id.equals(prodId))
    assert.ok(restoredProd.category.equals(catId))
    assert.equal(restoredProd.costPrice, 3800000)
    assert.equal(restoredProd.hardFloorPrice, 4100000)
    assert.equal(restoredProd.supplierQuotes[0].supplierName, 'پخش مرکزی')
    assert.ok(restoredProd.exactMargin instanceof Decimal128)
    assert.equal(restoredProd.exactMargin.toString(), '15.50')
    assert.ok(restoredProd.rawThumb instanceof Binary)
    assert.equal(restoredProd.createdAt.getTime(), createdAt.getTime())

    const restoredAdmin = await db.collection('users').findOne({ email: 'super@ekgkala.ir' })
    assert.equal(restoredAdmin.password, '$2b$12$hashedSecretPasswordValue')

    const restoredSettings = await db.collection('settings').findOne({ singletonKey: 'main_settings' })
    assert.equal(restoredSettings.paymentConfig.zarinpal.merchantId, 'secret-merchant-uuid')

    // Verify indexes were reconstructed cleanly (including text index without _fts)
    const prodIndexes = await db.collection('products').indexes()
    const textIdx = prodIndexes.find((i) => i.name === 'name_text_description_text')
    assert.ok(textIdx)
    assert.deepEqual(textIdx.key, { name: 'text', description: 'text' })

    const ttlIndexes = await db.collection('empty_logs').indexes()
    assert.equal(ttlIndexes.find((i) => i.name === 'ttl_idx').expireAfterSeconds, 3600)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('۲. رمزنگاری AES-256-GCM با رمز عبور، خطای رمز اشتباه و بازیابی با رمز صحیح', async () => {
  const tmpDir = makeTempDir()
  const db = createMockDb({
    products: { docs: [{ _id: new ObjectId(), name: 'کالای رمزنگاری‌شده', price: 100000 }] },
  })

  try {
    const encPath = path.join(tmpDir, 'secret-backup.ekg.enc')
    await createBackupFile({
      db,
      outputPath: encPath,
      password: 'StrongPassword#2026',
    })

    await assert.rejects(
      () => inspectBackupFile({ filePath: encPath, password: '' }),
      (err) => err.code === 'BACKUP_PASSWORD_REQUIRED',
    )

    await assert.rejects(
      () => inspectBackupFile({ filePath: encPath, password: 'WrongPassword123' }),
      (err) => err.code === 'BACKUP_DECRYPT_FAILED',
    )

    const okInspect = await inspectBackupFile({
      filePath: encPath,
      password: 'StrongPassword#2026',
      db,
    })
    assert.equal(okInspect.valid, true)
    assert.equal(okInspect.encrypted, true)
    assert.equal(okInspect.footer.totalDocuments, 1)

    await db.collection('products').drop()
    await restoreBackupFile({
      filePath: encPath,
      password: 'StrongPassword#2026',
      db,
      createSafetyBackup: false,
      storageDir: tmpDir,
    })

    assert.equal(await db.collection('products').countDocuments(), 1)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('۳. کشف دستکاری و خرابی فایل (Tamper & Truncation) پیش از تغییر دیتابیس زنده', async () => {
  const tmpDir = makeTempDir()
  const db = createMockDb({
    products: { docs: [{ _id: new ObjectId(), name: 'محصول زنده دست‌نخورده', price: 500000 }] },
  })

  try {
    const gzPath = path.join(tmpDir, 'valid.ekg.gz')
    const encPath = path.join(tmpDir, 'valid.ekg.enc')
    await createBackupFile({ db, outputPath: gzPath })
    await createBackupFile({ db, outputPath: encPath, password: 'PassWord99!' })

    // Truncate gzip archive
    const truncatedGz = path.join(tmpDir, 'truncated.ekg.gz')
    const gzBytes = fs.readFileSync(gzPath)
    fs.writeFileSync(truncatedGz, gzBytes.subarray(0, Math.floor(gzBytes.length / 2)))
    await assert.rejects(() => restoreBackupFile({ filePath: truncatedGz, db, createSafetyBackup: false }))

    // Flip a byte inside encrypted ciphertext
    const tamperedEnc = path.join(tmpDir, 'tampered.ekg.enc')
    const encBytes = fs.readFileSync(encPath)
    encBytes[60] ^= 0xff
    fs.writeFileSync(tamperedEnc, encBytes)
    await assert.rejects(
      () => restoreBackupFile({ filePath: tamperedEnc, password: 'PassWord99!', db, createSafetyBackup: false }),
      (err) => err.code === 'BACKUP_DECRYPT_FAILED',
    )

    // Live DB must remain completely intact
    const liveDoc = await db.collection('products').findOne({})
    assert.equal(liveDoc.name, 'محصول زنده دست‌نخورده')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('۴. بازگشت اتمی (Rollback) هنگام خطا در مرحله جایگزینی و حذف مجموعه‌های اضافی', async () => {
  const tmpDir = makeTempDir()
  const sourceDb = createMockDb({
    categories: { docs: [{ _id: new ObjectId(), name: 'دسته بکاپ' }] },
    products: { docs: [{ _id: new ObjectId(), name: 'محصول بکاپ' }] },
  })

  try {
    const backupPath = path.join(tmpDir, 'swap-test.ekg.gz')
    await createBackupFile({ db: sourceDb, outputPath: backupPath })

    // Live DB with different data + extra collection
    const liveDb = createMockDb({
      categories: { docs: [{ _id: new ObjectId(), name: 'دسته زنده قدیمی' }] },
      products: { docs: [{ _id: new ObjectId(), name: 'محصول زنده قدیمی' }] },
      extra_later_col: { docs: [{ _id: new ObjectId(), name: 'داده بعدی' }] },
    })

    // Inject failure when swapping the 2nd collection ("products")
    liveDb.setFailRenameOn('products')

    await assert.rejects(() =>
      restoreBackupFile({
        filePath: backupPath,
        db: liveDb,
        createSafetyBackup: true,
        storageDir: tmpDir,
      }),
    )

    // Verify rollback restored categories back to live state and left zero staging/old collections
    const catDoc = await liveDb.collection('categories').findOne({})
    const prodDoc = await liveDb.collection('products').findOne({})
    assert.equal(catDoc.name, 'دسته زنده قدیمی')
    assert.equal(prodDoc.name, 'محصول زنده قدیمی')

    const remainingNames = (await liveDb.listCollections().toArray()).map((c) => c.name)
    assert.ok(!remainingNames.some((n) => n.startsWith('__rs_') || n.startsWith('__ro_')))

    // Safety snapshot must have been created in tmpDir before swap
    const serverFiles = await listServerBackups(tmpDir)
    assert.ok(serverFiles.some((f) => f.trigger === 'pre-restore'))

    // Now clear injected fault and verify dropUnlistedCollections removes extra_later_col
    liveDb.setFailRenameOn(null)
    const okResult = await restoreBackupFile({
      filePath: backupPath,
      db: liveDb,
      dropUnlistedCollections: true,
      createSafetyBackup: false,
      storageDir: tmpDir,
    })
    assert.deepEqual(okResult.droppedExtraCollections, ['extra_later_col'])
    assert.equal((await liveDb.collection('products').findOne({})).name, 'محصول بکاپ')
    assert.equal(await liveDb.collection('extra_later_col').countDocuments(), 0)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('۵. فیلتر کالکشن‌ها، پاکسازی خودکار، امنیت نام فایل و RBAC فقط برای سوپرادمین', async () => {
  assert.equal(shouldIncludeCollection('products'), true)
  assert.equal(shouldIncludeCollection('search_history'), true)
  assert.equal(shouldIncludeCollection('otps'), false)
  assert.equal(shouldIncludeCollection('captchas'), false)
  assert.equal(shouldIncludeCollection('system.views'), false)
  assert.equal(shouldIncludeCollection('__rs_abc_products'), false)
  assert.equal(shouldIncludeCollection('__ro_abc_products'), false)
  assert.equal(isValidCollectionName('../evil'), false)

  assert.equal(normalizeIndexSpecForCreate({ name: '_id_', key: { _id: 1 } }), null)

  // Path traversal & invalid extension checks
  assert.throws(() => safeBackupFilename('../secret.ekg.gz'))
  assert.throws(() => safeBackupFilename('backup.json'))
  assert.throws(() => safeBackupFilename('backup.backup'))

  // Cron expression checks
  assert.equal(buildCronExpression({ frequency: 'daily', hour: 3 }), '0 3 * * *')
  assert.equal(buildCronExpression({ frequency: 'every_12h', hour: 4 }), '0 4,16 * * *')
  assert.equal(buildCronExpression({ frequency: 'weekly', hour: 2, dayOfWeek: 5 }), '0 2 * * 5')

  // RBAC: ONLY superadmin has backup permissions
  assert.ok(ROLES.superadmin.includes(PERMISSIONS.BACKUP_READ))
  assert.ok(ROLES.superadmin.includes(PERMISSIONS.BACKUP_CREATE))
  assert.ok(ROLES.superadmin.includes(PERMISSIONS.BACKUP_RESTORE))

  for (const role of ['manager', 'admin', 'editor', 'support', 'user', 'guest']) {
    const perms = ROLES[role] || []
    assert.equal(perms.includes(PERMISSIONS.BACKUP_READ), false, `${role} should not have BACKUP_READ`)
    assert.equal(perms.includes(PERMISSIONS.BACKUP_CREATE), false, `${role} should not have BACKUP_CREATE`)
    assert.equal(perms.includes(PERMISSIONS.BACKUP_RESTORE), false, `${role} should not have BACKUP_RESTORE`)
  }

  // Prune auto backups keeps newest N auto backups and leaves manual backups alone
  const tmpDir = makeTempDir()
  try {
    const db = createMockDb({ products: { docs: [{ _id: new ObjectId(), name: 'x' }] } })
    for (let i = 0; i < 4; i++) {
      await createBackupFile({
        db,
        outputPath: path.join(tmpDir, `ekgkala-auto-20260101-00000${i}-aabb.ekg.gz`),
        trigger: 'auto',
        writeMetaSidecar: true,
      })
      await new Promise((r) => setTimeout(r, 15))
    }
    await createBackupFile({
      db,
      outputPath: path.join(tmpDir, 'ekgkala-manual-20260101-000009-ccdd.ekg.gz'),
      trigger: 'manual',
      writeMetaSidecar: true,
    })

    const pruned = await pruneAutoBackups(2, tmpDir)
    assert.equal(pruned.length, 2)
    const remaining = await listServerBackups(tmpDir)
    assert.equal(remaining.length, 3)
    assert.ok(remaining.some((r) => r.trigger === 'manual'))

    await deleteServerBackup('ekgkala-manual-20260101-000009-ccdd.ekg.gz', tmpDir)
    assert.equal((await listServerBackups(tmpDir)).length, 2)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  // Nginx config check
  const nginxConf = fs.readFileSync(path.join(__dirname, '..', '..', 'nginx-security-config.conf'), 'utf8')
  assert.equal(nginxConf.includes('location ^~ /api/backup/'), true)
  assert.equal(nginxConf.includes('client_max_body_size 500M'), true)

  // EJSON & writable storage dir checks
  const ejson = getEjson()
  assert.equal(typeof ejson.stringify, 'function')
  assert.equal(typeof ejson.parse, 'function')
  const resolvedTmp = await resolveWritableStorageDir(os.tmpdir())
  assert.equal(fs.existsSync(resolvedTmp), true)
})
