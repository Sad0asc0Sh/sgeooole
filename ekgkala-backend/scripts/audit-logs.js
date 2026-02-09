/**
 * ============================================
 * Security Audit Script: Find Sensitive Logs
 * Scans for console.log statements that may leak sensitive data
 * ============================================
 * 
 * Usage: node scripts/audit-logs.js
 */

const fs = require('fs')
const path = require('path')

// Directories to scan
const SCAN_DIRS = [
    'controllers',
    'middleware',
    'routes',
    'utils',
    'services',
    'jobs',
]

// Directories to skip
const SKIP_DIRS = ['node_modules', 'logs', '.git', 'dist', 'build']

// Patterns that indicate sensitive data might be logged
const SENSITIVE_PATTERNS = [
    /console\.(log|info|debug)\s*\([^)]*password/gi,
    /console\.(log|info|debug)\s*\([^)]*token/gi,
    /console\.(log|info|debug)\s*\([^)]*secret/gi,
    /console\.(log|info|debug)\s*\([^)]*authorization/gi,
    /console\.(log|info|debug)\s*\([^)]*cookie/gi,
    /console\.(log|info|debug)\s*\([^)]*session/gi,
    /console\.(log|info|debug)\s*\([^)]*api[_-]?key/gi,
    /console\.(log|info|debug)\s*\([^)]*merchant/gi,
    /console\.(log|info|debug)\s*\([^)]*card/gi,
    /console\.(log|info|debug)\s*\([^)]*cvv/gi,
    /console\.(log|info|debug)\s*\([^)]*pin/gi,
    /console\.(log|info|debug)\s*\([^)]*otp/gi,
    /console\.(log|info|debug)\s*\([^)]*national[_-]?code/gi,
    /console\.(log|info|debug)\s*\([^)]*sheba/gi,
    /console\.(log|info|debug)\s*\([^)]*iban/gi,
    /console\.(log|info|debug)\s*\([^)]*req\.body/gi,
    /console\.(log|info|debug)\s*\([^)]*response\.data/gi,
    /console\.(log|info|debug)\s*\([^)]*err\.stack/gi,
]

// Patterns for potentially problematic logs (warnings, not errors)
const WARNING_PATTERNS = [
    /console\.log\s*\(/g, // Any console.log in production code
    /console\.info\s*\(/g,
    /console\.debug\s*\(/g,
]

let sensitiveFindings = []
let warningFindings = []
let totalFilesScanned = 0
let totalLogsFound = 0

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
        const lineNumber = index + 1

        // Check for sensitive patterns
        for (const pattern of SENSITIVE_PATTERNS) {
            pattern.lastIndex = 0 // Reset regex
            if (pattern.test(line)) {
                sensitiveFindings.push({
                    file: filePath,
                    line: lineNumber,
                    content: line.trim().substring(0, 100),
                    type: 'SENSITIVE',
                })
            }
        }

        // Check for any console.log (warnings)
        for (const pattern of WARNING_PATTERNS) {
            pattern.lastIndex = 0
            if (pattern.test(line)) {
                totalLogsFound++
                // Only add first 50 warning findings
                if (warningFindings.length < 50) {
                    warningFindings.push({
                        file: filePath,
                        line: lineNumber,
                        content: line.trim().substring(0, 80),
                        type: 'WARNING',
                    })
                }
            }
        }
    })
}

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            if (!SKIP_DIRS.includes(entry.name)) {
                scanDirectory(fullPath)
            }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            totalFilesScanned++
            scanFile(fullPath)
        }
    }
}

// Main execution
console.log('🔍 Starting Security Audit: Scanning for sensitive logs...\n')

const baseDir = path.join(__dirname, '..')

for (const dir of SCAN_DIRS) {
    const fullPath = path.join(baseDir, dir)
    scanDirectory(fullPath)
}

// Also scan root files
const rootFiles = fs.readdirSync(baseDir)
for (const file of rootFiles) {
    if (file.endsWith('.js') && !SKIP_DIRS.includes(file)) {
        totalFilesScanned++
        scanFile(path.join(baseDir, file))
    }
}

// Report
console.log('='.repeat(60))
console.log('📊 SECURITY AUDIT REPORT')
console.log('='.repeat(60))
console.log(`\n📁 Files Scanned: ${totalFilesScanned}`)
console.log(`📝 Total console.log/info/debug found: ${totalLogsFound}`)
console.log(`🔴 Sensitive Data Leaks: ${sensitiveFindings.length}`)
console.log()

if (sensitiveFindings.length > 0) {
    console.log('🚨 CRITICAL: Sensitive Data in Logs')
    console.log('-'.repeat(60))
    for (const finding of sensitiveFindings) {
        console.log(`\n  📍 ${finding.file}:${finding.line}`)
        console.log(`     ${finding.content}...`)
    }
    console.log()
}

if (warningFindings.length > 0) {
    console.log('⚠️  WARNING: Console logs to review (first 50)')
    console.log('-'.repeat(60))
    for (const finding of warningFindings.slice(0, 20)) {
        console.log(`  📍 ${finding.file}:${finding.line}`)
    }
    if (totalLogsFound > 20) {
        console.log(`  ... and ${totalLogsFound - 20} more`)
    }
    console.log()
}

// Recommendations
console.log('💡 RECOMMENDATIONS')
console.log('-'.repeat(60))
console.log(`
1. Replace console.log with the logger utility:
   const logger = require('./utils/logger')
   logger.info('message', { safeData })

2. In production, set LOG_LEVEL=warn in .env to suppress info/debug

3. Never log: passwords, tokens, card numbers, OTPs, national codes

4. Use the redact() function in logger.js for any user input

5. For payment data, use logger.payment() which auto-redacts

6. Run this script before every deployment:
   node scripts/audit-logs.js
`)

// Exit with error if sensitive findings found
if (sensitiveFindings.length > 0) {
    console.log('\n❌ Audit FAILED: Fix sensitive logs before deployment!')
    process.exit(1)
} else {
    console.log('\n✅ Audit PASSED: No critical sensitive data leaks found.')
    process.exit(0)
}
