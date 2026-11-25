const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Settings = require('../models/Settings')
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/auditLogger')
const { reloadBackupScheduler } = require('../jobs/backupSchedulerJob')
const {
  BACKUP_STORAGE_DIR,
  resolveWritableStorageDir,
  safeBackupFilename,
  buildBackupFilename,
  getDatabaseOverview,
  createBackupFile,
  inspectBackupFile,
  restoreBackupFile,
  listServerBackups,
  deleteServerBackup,
  registerStagedBackup,
  getStagedBackup,
  consumeStagedBackup,
  safeUnlinkFile,
} = require('../services/backupService')

const DEFAULT_BACKUP_SETTINGS = {
  autoBackupEnabled: false,
  frequency: 'daily',
  hour: 3,
  dayOfWeek: 5,
  retentionCount: 7,
  lastAutoBackupAt: null,
  lastAutoBackupStatus: null,
  lastAutoBackupFile: null,
  lastAutoBackupError: null,
  lastManualBackupAt: null,
}

function getDbOrThrow() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    const err = new Error('اتصال به پایگاه داده برقرار نیست')
    err.statusCode = 503
    throw err
  }
  return mongoose.connection.db
}

function handleControllerError(res, err, fallbackMessage) {
  const status = err?.statusCode || (err?.code === 'BACKUP_OPERATION_IN_PROGRESS' ? 409 : 500)
  return res.status(status).json({
    success: false,
    code: err?.code || undefined,
    message: status < 500 ? (err.message || fallbackMessage) : fallbackMessage,
  })
}

exports.getOverview = async (req, res) => {
  try {
    const db = getDbOrThrow()
    const [overview, serverBackups, settingsDoc] = await Promise.all([
      getDatabaseOverview(db),
      listServerBackups(BACKUP_STORAGE_DIR),
      Settings.findOne({ singletonKey: 'main_settings' }).lean(),
    ])

    const backupSettings = {
      ...DEFAULT_BACKUP_SETTINGS,
      ...(settingsDoc?.backupSettings || {}),
    }

    res.json({
      success: true,
      data: {
        overview,
        serverBackups,
        backupSettings,
      },
    })
  } catch (err) {
    console.error('[BackupController] getOverview error:', err)
    handleControllerError(res, err, 'خطا در دریافت اطلاعات بکاپ و بازیابی')
  }
}

exports.listBackups = async (req, res) => {
  try {
    const serverBackups = await listServerBackups(BACKUP_STORAGE_DIR)
    res.json({
      success: true,
      data: serverBackups,
    })
  } catch (err) {
    console.error('[BackupController] listBackups error:', err)
    handleControllerError(res, err, 'خطا در دریافت لیست بکاپ‌های سرور')
  }
}

exports.createServerBackup = async (req, res) => {
  try {
    const db = getDbOrThrow()
    const storageDir = await resolveWritableStorageDir(BACKUP_STORAGE_DIR)
    const { password = '', note = '' } = req.body || {}
    const encrypted = typeof password === 'string' && password.length > 0
    const filename = buildBackupFilename({ trigger: 'manual', encrypted })
    const outputPath = path.join(storageDir, filename)

    const metadata = await createBackupFile({
      db,
      outputPath,
      password: encrypted ? password : '',
      trigger: 'manual',
      note,
      createdBy: req.user?._id || req.user?.id || null,
      writeMetaSidecar: true,
    })

    await Settings.findOneAndUpdate(
      { singletonKey: 'main_settings' },
      { $set: { 'backupSettings.lastManualBackupAt': new Date() } },
      { upsert: true },
    )

    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_CREATED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: {
        filename: metadata.filename,
        encrypted: metadata.encrypted,
        sizeBytes: metadata.sizeBytes,
        totalCollections: metadata.totalCollections,
        totalDocuments: metadata.totalDocuments,
      },
    })

    res.status(201).json({
      success: true,
      message: 'نسخه پشتیبان با موفقیت روی سرور ذخیره شد',
      data: metadata,
    })
  } catch (err) {
    console.error('[BackupController] createServerBackup error:', err)
    handleControllerError(res, err, 'خطا در ایجاد فایل بکاپ')
  }
}

exports.exportBackup = async (req, res) => {
  let tempPathToCleanup = null
  try {
    const db = getDbOrThrow()
    const { password = '', note = '', saveOnServer = true } = req.body || {}
    const encrypted = typeof password === 'string' && password.length > 0
    const filename = buildBackupFilename({ trigger: 'manual', encrypted })

    const targetDir = saveOnServer
      ? await resolveWritableStorageDir(BACKUP_STORAGE_DIR)
      : path.join(os.tmpdir(), 'ekgkala-backup-exports')
    const outputPath = path.join(
      targetDir,
      saveOnServer ? filename : `${crypto.randomBytes(4).toString('hex')}-${filename}`,
    )

    if (!saveOnServer) {
      tempPathToCleanup = outputPath
    }

    const metadata = await createBackupFile({
      db,
      outputPath,
      password: encrypted ? password : '',
      trigger: 'manual',
      note,
      createdBy: req.user?._id || req.user?.id || null,
      writeMetaSidecar: Boolean(saveOnServer),
    })

    await Settings.findOneAndUpdate(
      { singletonKey: 'main_settings' },
      { $set: { 'backupSettings.lastManualBackupAt': new Date() } },
      { upsert: true },
    )

    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_CREATED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: {
        filename,
        savedOnServer: Boolean(saveOnServer),
        encrypted: metadata.encrypted,
        sizeBytes: metadata.sizeBytes,
        totalCollections: metadata.totalCollections,
        totalDocuments: metadata.totalDocuments,
      },
    })

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', String(metadata.sizeBytes))
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.setHeader('X-Backup-Filename', filename)
    res.setHeader('X-Backup-Checksum', metadata.payloadSha256)
    res.setHeader('X-Backup-Collections', String(metadata.totalCollections))
    res.setHeader('X-Backup-Documents', String(metadata.totalDocuments))

    const stream = fs.createReadStream(outputPath)
    let cleaned = false
    const cleanupOnce = () => {
      if (cleaned) return
      cleaned = true
      if (tempPathToCleanup) {
        safeUnlinkFile(tempPathToCleanup)
      }
    }

    res.on('finish', cleanupOnce)
    res.on('close', cleanupOnce)
    stream.on('error', (streamErr) => {
      console.error('[BackupController] Export stream error:', streamErr.message)
      cleanupOnce()
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'خطا در ارسال فایل بکاپ' })
      } else {
        res.destroy(streamErr)
      }
    })
    stream.pipe(res)
  } catch (err) {
    if (tempPathToCleanup) {
      await safeUnlinkFile(tempPathToCleanup)
    }
    console.error('[BackupController] exportBackup error:', err)
    if (!res.headersSent) {
      handleControllerError(res, err, 'خطا در تهیه و دانلود بکاپ')
    }
  }
}

exports.downloadServerBackup = async (req, res) => {
  try {
    const storageDir = await resolveWritableStorageDir(BACKUP_STORAGE_DIR)
    const filePath = safeBackupFilename(req.params.filename, storageDir)
    let stat
    try {
      stat = await fs.promises.stat(filePath)
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        return res.status(404).json({ success: false, message: 'فایل بکاپ یافت نشد' })
      }
      throw err
    }

    const safeName = path.basename(filePath)
    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_DOWNLOADED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: { filename: safeName, sizeBytes: stat.size },
    })

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    res.setHeader('Content-Length', String(stat.size))
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.setHeader('X-Backup-Filename', safeName)

    const stream = fs.createReadStream(filePath)
    stream.on('error', (streamErr) => {
      console.error('[BackupController] Download stream error:', streamErr.message)
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'خطا در دانلود فایل بکاپ' })
      } else {
        res.destroy(streamErr)
      }
    })
    stream.pipe(res)
  } catch (err) {
    console.error('[BackupController] downloadServerBackup error:', err)
    if (!res.headersSent) {
      handleControllerError(res, err, 'خطا در دانلود بکاپ')
    }
  }
}

exports.deleteServerBackupHandler = async (req, res) => {
  try {
    const storageDir = await resolveWritableStorageDir(BACKUP_STORAGE_DIR)
    const result = await deleteServerBackup(req.params.filename, storageDir)
    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_DELETED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: { filename: result.filename },
    })
    res.json({
      success: true,
      message: 'فایل بکاپ با موفقیت از سرور حذف شد',
      data: result,
    })
  } catch (err) {
    console.error('[BackupController] deleteServerBackup error:', err)
    handleControllerError(res, err, 'خطا در حذف فایل بکاپ')
  }
}

exports.inspectUploadedBackup = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'لطفاً فایل بکاپ را انتخاب کنید',
    })
  }

  const uploadedPath = req.file.path
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  try {
    const db = getDbOrThrow()
    const inspection = await inspectBackupFile({
      filePath: uploadedPath,
      password,
      db,
      currentUserId: req.user?._id,
    })

    const restoreToken = await registerStagedBackup({
      filePath: uploadedPath,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      source: 'upload',
      createdBy: String(req.user._id),
    })

    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_INSPECTED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: {
        source: 'upload',
        filename: req.file.originalname,
        totalCollections: inspection.footer.totalCollections,
        totalDocuments: inspection.footer.totalDocuments,
      },
    })

    return res.json({
      success: true,
      requiresPassword: false,
      restoreToken,
      filename: req.file.originalname,
      sizeBytes: req.file.size,
      inspection,
    })
  } catch (err) {
    if (err?.code === 'BACKUP_PASSWORD_REQUIRED') {
      const stagedToken = await registerStagedBackup({
        filePath: uploadedPath,
        originalName: req.file.originalname,
        sizeBytes: req.file.size,
        source: 'upload',
        createdBy: String(req.user._id),
      })

      return res.json({
        success: true,
        requiresPassword: true,
        stagedToken,
        filename: req.file.originalname,
        sizeBytes: req.file.size,
      })
    }

    await safeUnlinkFile(uploadedPath)
    console.error('[BackupController] inspectUploadedBackup error:', err.message)
    return handleControllerError(res, err, 'فایل بکاپ معتبر نیست')
  }
}

exports.inspectStagedBackup = async (req, res) => {
  try {
    const db = getDbOrThrow()
    const { stagedToken, serverFilename, password = '' } = req.body || {}

    if (serverFilename) {
      const storageDir = await resolveWritableStorageDir(BACKUP_STORAGE_DIR)
      const serverPath = safeBackupFilename(serverFilename, storageDir)
      let stat
      try {
        stat = await fs.promises.stat(serverPath)
      } catch (err) {
        if (err && err.code === 'ENOENT') {
          return res.status(404).json({ success: false, message: 'فایل بکاپ روی سرور یافت نشد' })
        }
        throw err
      }

      try {
        const inspection = await inspectBackupFile({
          filePath: serverPath,
          password,
          db,
          currentUserId: req.user?._id,
        })

        const restoreToken = await registerStagedBackup({
          filePath: serverPath,
          originalName: path.basename(serverPath),
          sizeBytes: stat.size,
          source: 'server',
          createdBy: String(req.user._id),
        })

        await logSecurityEvent({
          action: SECURITY_EVENTS.BACKUP_INSPECTED,
          entity: 'Backup',
          userId: req.user?._id,
          req,
          details: {
            source: 'server',
            filename: path.basename(serverPath),
            totalCollections: inspection.footer.totalCollections,
            totalDocuments: inspection.footer.totalDocuments,
          },
        })

        return res.json({
          success: true,
          requiresPassword: false,
          restoreToken,
          filename: path.basename(serverPath),
          sizeBytes: stat.size,
          inspection,
        })
      } catch (err) {
        if (err?.code === 'BACKUP_PASSWORD_REQUIRED') {
          return res.json({
            success: true,
            requiresPassword: true,
            serverFilename: path.basename(serverPath),
            filename: path.basename(serverPath),
            sizeBytes: stat.size,
          })
        }
        throw err
      }
    }

    if (!stagedToken) {
      return res.status(400).json({
        success: false,
        message: 'شناسه فایل آپلودشده ارسال نشده است',
      })
    }

    const staged = await getStagedBackup(stagedToken, req.user?._id)
    if (!staged) {
      return res.status(404).json({
        success: false,
        message: 'نشست بررسی فایل بکاپ منقضی شده است. لطفاً فایل را مجدداً انتخاب کنید.',
      })
    }

    const inspection = await inspectBackupFile({
      filePath: staged.filePath,
      password,
      db,
      currentUserId: req.user?._id,
    })

    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_INSPECTED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: {
        source: staged.source,
        filename: staged.originalName,
        totalCollections: inspection.footer.totalCollections,
        totalDocuments: inspection.footer.totalDocuments,
      },
    })

    return res.json({
      success: true,
      requiresPassword: false,
      restoreToken: stagedToken,
      filename: staged.originalName,
      sizeBytes: staged.sizeBytes,
      inspection,
    })
  } catch (err) {
    console.error('[BackupController] inspectStagedBackup error:', err.message)
    return handleControllerError(res, err, 'خطا در بررسی فایل بکاپ')
  }
}

exports.executeRestore = async (req, res) => {
  const {
    restoreToken,
    confirmPhrase = '',
    password = '',
    dropUnlistedCollections = true,
    createSafetyBackup = true,
  } = req.body || {}

  const normalizedPhrase = String(confirmPhrase || '').trim()
  if (normalizedPhrase !== 'بازیابی' && normalizedPhrase.toUpperCase() !== 'RESTORE') {
    return res.status(400).json({
      success: false,
      message: 'برای تایید عملیات، عبارت «بازیابی» را به درستی وارد کنید',
    })
  }

  const staged = await getStagedBackup(restoreToken, req.user?._id)
  if (!staged) {
    return res.status(404).json({
      success: false,
      message: 'فایل تاییدشده برای بازیابی منقضی شده یا یافت نشد. لطفاً دوباره بررسی کنید.',
    })
  }

  try {
    const db = getDbOrThrow()
    const storageDir = await resolveWritableStorageDir(BACKUP_STORAGE_DIR)
    const result = await restoreBackupFile({
      filePath: staged.filePath,
      password,
      db,
      dropUnlistedCollections: dropUnlistedCollections !== false,
      createSafetyBackup: createSafetyBackup !== false,
      actor: {
        id: req.user?._id ? String(req.user._id) : null,
        email: req.user?.email || null,
      },
      storageDir,
    })

    await consumeStagedBackup(restoreToken, staged.source === 'upload')

    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_RESTORED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: {
        source: staged.source,
        filename: staged.originalName,
        restoredCollections: result.restoredCollections,
        restoredDocuments: result.restoredDocuments,
        restoredIndexes: result.restoredIndexes,
        safetyBackupFile: result.safetyBackupFile,
        durationMs: result.durationMs,
      },
    })

    return res.json({
      success: true,
      message: 'بازیابی کامل دیتابیس با موفقیت انجام شد',
      data: result,
    })
  } catch (err) {
    console.error('[BackupController] executeRestore error:', err)
    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_RESTORE_FAILED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      status: 'failed',
      details: {
        filename: staged.originalName,
        error: err.message,
      },
    })
    return handleControllerError(res, err, 'خطا در بازیابی دیتابیس')
  }
}

exports.updateBackupSettings = async (req, res) => {
  try {
    const {
      autoBackupEnabled,
      frequency,
      hour,
      dayOfWeek,
      retentionCount,
    } = req.body || {}

    const allowedFrequencies = ['every_12h', 'daily', 'weekly']
    if (frequency !== undefined && !allowedFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: 'بازه زمانی انتخاب‌شده نامعتبر است',
      })
    }

    const parsedHour = hour !== undefined ? Number(hour) : undefined
    if (parsedHour !== undefined && (!Number.isInteger(parsedHour) || parsedHour < 0 || parsedHour > 23)) {
      return res.status(400).json({
        success: false,
        message: 'ساعت اجرا باید بین ۰ تا ۲۳ باشد',
      })
    }

    const parsedDay = dayOfWeek !== undefined ? Number(dayOfWeek) : undefined
    if (parsedDay !== undefined && (!Number.isInteger(parsedDay) || parsedDay < 0 || parsedDay > 6)) {
      return res.status(400).json({
        success: false,
        message: 'روز هفته باید بین ۰ تا ۶ باشد',
      })
    }

    const parsedRetention = retentionCount !== undefined ? Number(retentionCount) : undefined
    if (
      parsedRetention !== undefined &&
      (!Number.isInteger(parsedRetention) || parsedRetention < 1 || parsedRetention > 30)
    ) {
      return res.status(400).json({
        success: false,
        message: 'تعداد نگهداری بکاپ‌های خودکار باید بین ۱ تا ۳۰ باشد',
      })
    }

    let settings = await Settings.findOne({ singletonKey: 'main_settings' })
    if (!settings) {
      settings = new Settings({ singletonKey: 'main_settings' })
    }

    const current = settings.backupSettings?.toObject?.() || { ...DEFAULT_BACKUP_SETTINGS }
    settings.backupSettings = {
      ...current,
      ...(autoBackupEnabled !== undefined ? { autoBackupEnabled: Boolean(autoBackupEnabled) } : {}),
      ...(frequency !== undefined ? { frequency } : {}),
      ...(parsedHour !== undefined ? { hour: parsedHour } : {}),
      ...(parsedDay !== undefined ? { dayOfWeek: parsedDay } : {}),
      ...(parsedRetention !== undefined ? { retentionCount: parsedRetention } : {}),
    }

    await settings.save()
    await reloadBackupScheduler()

    await logSecurityEvent({
      action: SECURITY_EVENTS.BACKUP_SETTINGS_UPDATED,
      entity: 'Backup',
      userId: req.user?._id,
      req,
      details: {
        autoBackupEnabled: settings.backupSettings.autoBackupEnabled,
        frequency: settings.backupSettings.frequency,
        hour: settings.backupSettings.hour,
        dayOfWeek: settings.backupSettings.dayOfWeek,
        retentionCount: settings.backupSettings.retentionCount,
      },
    })

    return res.json({
      success: true,
      message: 'تنظیمات بکاپ‌گیری خودکار ذخیره شد',
      data: settings.backupSettings,
    })
  } catch (err) {
    console.error('[BackupController] updateBackupSettings error:', err)
    return handleControllerError(res, err, 'خطا در ذخیره تنظیمات بکاپ')
  }
}
