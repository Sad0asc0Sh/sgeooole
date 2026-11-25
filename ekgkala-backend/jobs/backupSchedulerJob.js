const path = require('path')
const cron = require('node-cron')
const mongoose = require('mongoose')
const Settings = require('../models/Settings')
const {
  BACKUP_STORAGE_DIR,
  resolveWritableStorageDir,
  buildBackupFilename,
  createBackupFile,
  pruneAutoBackups,
  getOperationStatus,
} = require('../services/backupService')

let currentTask = null
let isRunningTick = false

function buildCronExpression(backupSettings = {}) {
  const frequency = backupSettings.frequency || 'daily'
  const hour = Math.max(0, Math.min(23, Number.parseInt(backupSettings.hour ?? 3, 10) || 0))
  const dayOfWeek = Math.max(0, Math.min(6, Number.parseInt(backupSettings.dayOfWeek ?? 5, 10) || 0))

  if (frequency === 'every_12h') {
    const secondHour = (hour + 12) % 24
    const hours = [hour, secondHour].sort((a, b) => a - b).join(',')
    return `0 ${hours} * * *`
  }

  if (frequency === 'weekly') {
    return `0 ${hour} * * ${dayOfWeek}`
  }

  // daily
  return `0 ${hour} * * *`
}

async function runScheduledBackupTick() {
  if (isRunningTick) return
  if (getOperationStatus()) {
    console.log('[BackupScheduler] Skipping tick — restore operation in progress')
    return
  }
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return
  }

  isRunningTick = true
  try {
    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
    const cfg = settings?.backupSettings
    if (!cfg || !cfg.autoBackupEnabled) return

    const storageDir = await resolveWritableStorageDir(BACKUP_STORAGE_DIR)
    const filename = buildBackupFilename({ trigger: 'auto', encrypted: false })
    const outputPath = path.join(storageDir, filename)

    const meta = await createBackupFile({
      db: mongoose.connection.db,
      outputPath,
      password: '',
      trigger: 'auto',
      note: 'بکاپ خودکار زمان‌بندی‌شده',
      createdBy: 'scheduler',
      writeMetaSidecar: true,
    })

    await pruneAutoBackups(cfg.retentionCount || 7, storageDir)

    await Settings.findOneAndUpdate(
      { singletonKey: 'main_settings' },
      {
        $set: {
          'backupSettings.lastAutoBackupAt': new Date(),
          'backupSettings.lastAutoBackupStatus': 'success',
          'backupSettings.lastAutoBackupFile': meta.filename,
          'backupSettings.lastAutoBackupError': null,
        },
      },
    )

    console.log(
      `[BackupScheduler] Auto backup completed: ${meta.filename} (${meta.totalDocuments} docs)`,
    )
  } catch (err) {
    console.error('[BackupScheduler] Auto backup failed:', err.message)
    await Settings.findOneAndUpdate(
      { singletonKey: 'main_settings' },
      {
        $set: {
          'backupSettings.lastAutoBackupAt': new Date(),
          'backupSettings.lastAutoBackupStatus': 'failed',
          'backupSettings.lastAutoBackupError': err.message || 'خطای نامشخص',
        },
      },
    ).catch(() => {})
  } finally {
    isRunningTick = false
  }
}

function stopBackupScheduler() {
  if (currentTask) {
    try {
      currentTask.stop()
      if (typeof currentTask.destroy === 'function') {
        currentTask.destroy()
      }
    } catch {
      // ignore
    }
    currentTask = null
  }
}

async function reloadBackupScheduler() {
  stopBackupScheduler()
  try {
    if (mongoose.connection.readyState !== 1) return null
    const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
    const cfg = settings?.backupSettings
    if (!cfg || !cfg.autoBackupEnabled) {
      return null
    }

    const expr = buildCronExpression(cfg)
    currentTask = cron.schedule(expr, runScheduledBackupTick, {
      scheduled: true,
      timezone: 'Asia/Tehran',
    })
    console.log(`[BackupScheduler] Scheduled auto backups (${expr}, Asia/Tehran)`)
    return expr
  } catch (err) {
    console.error('[BackupScheduler] Failed to schedule auto backups:', err.message)
    return null
  }
}

function startBackupScheduler() {
  return reloadBackupScheduler()
}

module.exports = {
  buildCronExpression,
  runScheduledBackupTick,
  startBackupScheduler,
  reloadBackupScheduler,
  stopBackupScheduler,
}
