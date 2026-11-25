#!/usr/bin/env node
/**
 * Disaster Recovery CLI: Create full MongoDB backup archive (.ekg.gz / .ekg.enc)
 * Usage:
 *   node scripts/create-backup.js [--out /path/to/file.ekg.gz] [--password secret] [--note "..."]
 */
const path = require('path')
const mongoose = require('mongoose')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const {
  BACKUP_STORAGE_DIR,
  buildBackupFilename,
  createBackupFile,
} = require('../services/backupService')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' && argv[i + 1]) args.out = argv[++i]
    else if (a === '--password' && argv[i + 1]) args.password = argv[++i]
    else if (a === '--note' && argv[i + 1]) args.note = argv[++i]
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const password = args.password || ''
  const encrypted = password.length > 0
  const filename = buildBackupFilename({ trigger: 'cli', encrypted })
  const outputPath = path.resolve(args.out || path.join(BACKUP_STORAGE_DIR, filename))

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 })

  try {
    const meta = await createBackupFile({
      db: mongoose.connection.db,
      outputPath,
      password,
      trigger: 'cli',
      note: args.note || 'CLI backup',
      createdBy: 'cli',
      writeMetaSidecar: true,
    })

    console.log('✅ Backup created successfully:')
    console.log(`   File:        ${outputPath}`)
    console.log(`   Collections: ${meta.totalCollections}`)
    console.log(`   Documents:   ${meta.totalDocuments}`)
    console.log(`   Indexes:     ${meta.totalIndexes}`)
    console.log(`   Size:        ${(meta.sizeBytes / 1024).toFixed(1)} KB`)
    console.log(`   Encrypted:   ${meta.encrypted ? 'Yes (AES-256-GCM)' : 'No'}`)
    console.log(`   SHA-256:     ${meta.payloadSha256}`)
  } finally {
    await mongoose.connection.close()
  }
}

main().catch((err) => {
  console.error('❌ Backup failed:', err.message)
  process.exit(1)
})
