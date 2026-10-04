/**
 * ============================================
 * Pre-Deployment Checklist Script
 * Run this before deploying to production
 * ============================================
 * 
 * Usage: node scripts/pre-deploy-check.js
 */

const fs = require('fs')
const path = require('path')

console.log('🚀 EkgKala Pre-Deployment Checklist\n')
console.log('='.repeat(60))

let errors = []
let warnings = []

// Check 1: NODE_ENV should be production ready
console.log('\n📋 Checking environment...')

const envFile = path.join(__dirname, '..', '.env')
if (!fs.existsSync(envFile)) {
    errors.push('.env file not found!')
} else {
    const envContent = fs.readFileSync(envFile, 'utf8')

    // Check for required variables
    const requiredVars = [
        'MONGODB_URI',
        'JWT_SECRET',
        'PARSPACK_ENDPOINT',
        'PARSPACK_ACCESS_KEY',
        'PARSPACK_SECRET_KEY',
    ]

    for (const varName of requiredVars) {
        if (!envContent.includes(varName + '=') || envContent.includes(varName + '=your-') || envContent.includes(varName + '=CHANGE_THIS')) {
            errors.push(`${varName} not properly configured in .env`)
        }
    }

    // Check for production settings
    if (envContent.includes('NODE_ENV=development')) {
        warnings.push('NODE_ENV is set to development (should be production)')
    }

    if (envContent.includes('ZARINPAL_SANDBOX=true')) {
        warnings.push('ZARINPAL_SANDBOX is true (should be false for production)')
    }

    console.log('  ✓ .env file exists')
}

// Check 2: Package.json dependencies
console.log('\n📦 Checking dependencies...')

const packageJson = require('../package.json')
if (packageJson.dependencies['xss-clean']) {
    errors.push('xss-clean is still in dependencies (should be removed)')
} else {
    console.log('  ✓ xss-clean removed')
}

// Check 3: Check for debug files
console.log('\n🔍 Checking for debug files...')

const debugPatterns = [
    'debug_*.js',
    'test_*.js',
    '*.log',
    '*.tmp',
]

const rootFiles = fs.readdirSync(path.join(__dirname, '..'))
for (const file of rootFiles) {
    for (const pattern of debugPatterns) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$')
        if (regex.test(file) && file !== 'server.log') {
            warnings.push(`Debug file found: ${file} (consider removing)`)
        }
    }
}
console.log('  ✓ Debug files check complete')

// Check 4: Logs directory
console.log('\n📝 Checking logs directory...')

const logsDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
    console.log('  ✓ Created logs directory')
} else {
    console.log('  ✓ Logs directory exists')
}

// Check 5: Check security configurations
console.log('\n🔒 Checking security configurations...')

const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8')

if (serverJs.includes("app.set('trust proxy', 1)")) {
    console.log('  ✓ Trust proxy enabled')
} else {
    errors.push('Trust proxy not enabled in server.js')
}

if (serverJs.includes('helmet(')) {
    console.log('  ✓ Helmet security headers enabled')
} else {
    errors.push('Helmet not configured')
}

if (serverJs.includes('productionConsole')) {
    console.log('  ✓ Production console handler enabled')
} else {
    warnings.push('Production console handler not imported')
}

// Check 6: Verify files exist
console.log('\n📁 Checking required files...')

const requiredFiles = [
    'middleware/auth.js',
    'middleware/upload.js',
    'config/rbac.js',
    'utils/logger.js',
    'utils/productionConsole.js',
]

for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
        console.log(`  ✓ ${file}`)
    } else {
        errors.push(`Required file missing: ${file}`)
    }
}

// Check 7: Verify ecosystem.config.js exists
console.log('\n⚙️ Checking PM2 configuration...')

const ecosystemPath = path.join(__dirname, '..', '..', 'ecosystem.config.js')
if (fs.existsSync(ecosystemPath)) {
    console.log('  ✓ ecosystem.config.js exists')
} else {
    warnings.push('ecosystem.config.js not found (needed for PM2)')
}

// Summary
console.log('\n' + '='.repeat(60))
console.log('📊 SUMMARY')
console.log('='.repeat(60))

if (errors.length > 0) {
    console.log('\n❌ ERRORS (must fix before deploy):')
    errors.forEach(e => console.log(`   • ${e}`))
}

if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (review before deploy):')
    warnings.forEach(w => console.log(`   • ${w}`))
}

if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ All checks passed! Ready for deployment.')
} else if (errors.length === 0) {
    console.log('\n⚠️  No critical errors. Review warnings before deploying.')
} else {
    console.log('\n❌ Fix errors before deploying!')
}

console.log('\n📖 Next steps:')
console.log('   1. Run: pnpm audit')
console.log('   2. Run: node scripts/audit-logs.js')
console.log('   3. Review deploy/DEPLOYMENT_GUIDE.md')
console.log('   4. Copy deploy/nginx.conf to server')
console.log('   5. Start with PM2: pm2 start ecosystem.config.js --env production')
console.log()

// Exit with error if there are critical errors
process.exit(errors.length > 0 ? 1 : 0)
