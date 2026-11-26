const path = require('path')
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

const CHECK_INTERVAL_MS = 60 * 1000
const WEEKDAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

let currentTimer = null
let isRunningTick = false
let lastTriggeredSlotKey = null

function getTehranTimeParts(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = {}
  for (const part of formatter.formatToParts(safeDate)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value
    }
  }

  const year = parts.year
  const month = parts.month
  const day = parts.day
  const weekdayNum = WEEKDAY_MAP[parts.weekday] ?? 0
  const hour = Number(parts.hour) % 24
  const minute = Number(parts.minute) % 60
  const slotKey = `${year}-${month}-${day}-${String(hour).padStart(2, '0')}`

  return {
    year,
    month,
    day,
    weekdayNum,
    hour,
    minute,
    slotKey,
  }
}

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

  return `0 ${hour} * * *`
}

function shouldRunScheduledBackup(
  backupSettings = {},
  now = new Date(),
  inMemoryLastSlotKey = null,
) {
  if (!backupSettings || !backupSettings.autoBackupEnabled) {
    return { due: false, slotKey: null }
  }

  const parts = getTehranTimeParts(now)
  const targetHour = Math.max(0, Math.min(23, Number.parseInt(backupSettings.hour ?? 3, 10) || 0))
  const targetDay = Math.max(0, Math.min(6, Number.parseInt(backupSettings.dayOfWeek ?? 5, 10) || 0))
  const frequency = backupSettings.frequency || 'daily'

  let hourMatches = false
  if (frequency === 'every_12h') {
    hourMatches = parts.hour === targetHour || parts.hour === (targetHour + 12) % 24
  } else if (frequency === 'weekly') {
    hourMatches = parts.weekdayNum === targetDay && parts.hour === targetHour
  } else {
    hourMatches = parts.hour === targetHour
  }

  if (!hourMatches) {
    return { due: false, slotKey: parts.slotKey }
  }

  if (inMemoryLastSlotKey && inMemoryLastSlotKey === parts.slotKey) {
    return { due: false, slotKey: parts.slotKey }
  }

  if (backupSettings.lastAutoBackupStatus === 'success' && backupSettings.lastAutoBackupAt) {
    const lastParts = getTehranTimeParts(new Date(backupSettings.lastAutoBackupAt))
    if (lastParts.slotKey === parts.slotKey) {
      return { due: false, slotKey: parts.slotKey }
    }
  }

  return { due: true, slotKey: parts.slotKey }
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

async function checkAndRunScheduledBackup() {
  if (isRunningTick) return
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return

  try {
    const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
    const cfg = settings?.backupSettings
    const check = shouldRunScheduledBackup(cfg, new Date(), lastTriggeredSlotKey)
    if (!check.due) return

    lastTriggeredSlotKey = check.slotKey
    await runScheduledBackupTick()
  } catch (err) {
    console.error('[BackupScheduler] Schedule check error:', err.message)
  }
}

function stopBackupScheduler() {
  if (currentTimer) {
    clearInterval(currentTimer)
    currentTimer = null
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
    currentTimer = setInterval(() => {
      void checkAndRunScheduledBackup()
    }, CHECK_INTERVAL_MS)
    if (typeof currentTimer.unref === 'function') {
      currentTimer.unref()
    }
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
  getTehranTimeParts,
  shouldRunScheduledBackup,
  runScheduledBackupTick,
  checkAndRunScheduledBackup,
  startBackupScheduler,
  reloadBackupScheduler,
  stopBackupScheduler,
}
