#!/usr/bin/env node
/**
 * Disaster Recovery CLI: Verify and restore a full backup archive (.ekg.gz / .ekg.enc)
 * Usage:
 *   node scripts/restore-backup.js <backup-file> [--password secret] [--no-safety] [--keep-extra] [--yes]
 */
const path = require('path')
const mongoose = require('mongoose')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const {
  BACKUP_STORAGE_DIR,
  inspectBackupFile,
  restoreBackupFile,
} = require('../services/backupService')

function parseArgs(argv) {
  const args = { yes: false, noSafety: false, keepExtra: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--yes' || a === '-y') args.yes = true
    else if (a === '--no-safety') args.noSafety = true
    else if (a === '--keep-extra') args.keepExtra = true
    else if (a === '--password' && argv[i + 1]) args.password = argv[++i]
    else if (!a.startsWith('-') && !args.file) args.file = a
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file) {
    console.error('Usage: node scripts/restore-backup.js <backup-file> [--password <pass>] [--yes]')
    process.exit(1)
  }

  const filePath = path.resolve(args.file)
  const password = args.password || ''
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 })

  try {
    const db = mongoose.connection.db
    const report = await inspectBackupFile({ filePath, password, db })

    console.log('🔍 Backup Verification Passed:')
    console.log(`   File:        ${filePath}`)
    console.log(`   Created At:  ${report.header.createdAt}`)
    console.log(`   Database:    ${report.header.database}`)
    console.log(`   Collections: ${report.footer.totalCollections}`)
    console.log(`   Documents:   ${report.footer.totalDocuments}`)
    console.log(`   Indexes:     ${report.footer.totalIndexes}`)
    console.log(`   SHA-256:     ${report.footer.payloadSha256}`)

    if (!args.yes) {
      console.log('\nDry-run only. Re-run with --yes to perform full atomic restore.')
      return
    }

    const result = await restoreBackupFile({
      filePath,
      password,
      db,
      dropUnlistedCollections: !args.keepExtra,
      createSafetyBackup: !args.noSafety,
      actor: { id: 'cli', email: 'cli@local' },
      storageDir: BACKUP_STORAGE_DIR,
    })

    console.log('\n✅ Restore completed successfully:')
    console.log(`   Restored collections: ${result.restoredCollections}`)
    console.log(`   Restored documents:   ${result.restoredDocuments}`)
    console.log(`   Restored indexes:     ${result.restoredIndexes}`)
    if (result.safetyBackupFile) {
      console.log(`   Safety snapshot:      ${result.safetyBackupFile}`)
    }
    console.log(`   Duration:             ${result.durationMs} ms`)
  } finally {
    await mongoose.connection.close()
  }
}

main().catch((err) => {
  console.error('❌ Restore failed:', err.message)
  process.exit(1)
})
