#!/usr/bin/env node

/**
 * ============================================
 * Final Production Readiness Test
 * تست نهایی آمادگی برای Production
 * ============================================
 */

const fs = require('fs')
const path = require('path')

console.log('🚀 EkgKala Production Readiness Test')
console.log('='.repeat(60))

let score = 0
let total = 0
const issues = []
const warnings = []

// Helper function
function test(name, check, critical = true) {
    total++
    const passed = check()
    if (passed) {
        score++
        console.log(`✅ ${name}`)
    } else {
        console.log(`❌ ${name}`)
        if (critical) {
            issues.push(name)
        } else {
            warnings.push(name)
        }
    }
    return passed
}

console.log('\n📦 Structure Check')
console.log('-'.repeat(40))

test('ekgkala-backend directory exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'ekgkala-backend'))
)

test('frontend directory exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'frontend'))
)

test('admin directory exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'admin'))
)

test('deploy directory exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'deploy'))
)

console.log('\n🔒 Security Files')
console.log('-'.repeat(40))

test('server.js has trust proxy', () => {
    const serverJs = fs.readFileSync(
        path.join(__dirname, '..', 'server.js'),
        'utf8'
    )
    return serverJs.includes("app.set('trust proxy', 1)")
})

test('server.js has PM2 ready signal', () => {
    const serverJs = fs.readFileSync(
        path.join(__dirname, '..', 'server.js'),
        'utf8'
    )
    return serverJs.includes("process.send('ready')")
})

test('productionConsole.js exists', () =>
    fs.existsSync(path.join(__dirname, '..', 'utils', 'productionConsole.js'))
)

test('.env in .gitignore', () => {
    const gitignore = fs.readFileSync(
        path.join(__dirname, '..', '.gitignore'),
        'utf8'
    )
    return gitignore.includes('.env')
})

console.log('\n📝 Configuration Files')
console.log('-'.repeat(40))

test('.env.example complete', () => {
    const envExample = fs.readFileSync(
        path.join(__dirname, '..', '.env.example'),
        'utf8'
    )
    return envExample.includes('MONGODB_URI') &&
        envExample.includes('JWT_SECRET') &&
        envExample.includes('PARSPACK_ENDPOINT')
})

test('ecosystem.config.js exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'ecosystem.config.js'))
)

test('frontend/vercel.json exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'frontend', 'vercel.json'))
)

test('admin/vercel.json exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'admin', 'vercel.json'))
)

console.log('\n📚 Documentation')
console.log('-'.repeat(40))

test('DEPLOYMENT_GUIDE.md exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'deploy', 'DEPLOYMENT_GUIDE.md'))
)

test('PRE_DEPLOY_CHECKLIST.md exists', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'deploy', 'PRE_DEPLOY_CHECKLIST.md'))
)

test('README.md exists (root)', () =>
    fs.existsSync(path.join(__dirname, '..', '..', 'README.md'))
)

console.log('\n🛠️ Scripts')
console.log('-'.repeat(40))

test('generate-env-secrets.js exists', () =>
    fs.existsSync(path.join(__dirname, 'generate-env-secrets.js'))
)

test('pre-deploy-check.js exists', () =>
    fs.existsSync(path.join(__dirname, 'pre-deploy-check.js'))
)

test('audit-logs.js exists', () =>
    fs.existsSync(path.join(__dirname, 'audit-logs.js'))
)

console.log('\n🔐 Security Audit')
console.log('-'.repeat(40))

test('No xss-clean in package.json', () => {
    const packageJson = require('../package.json')
    return !packageJson.dependencies['xss-clean']
}, false)

test('logger.js has redaction', () => {
    const logger = fs.readFileSync(
        path.join(__dirname, '..', 'utils', 'logger.js'),
        'utf8'
    )
    return logger.includes('redact')
})

// Summary
console.log('\n' + '='.repeat(60))
console.log('📊 RESULTS')
console.log('='.repeat(60))
console.log(`\nScore: ${score}/${total} (${Math.round(score / total * 100)}%)`)

if (issues.length > 0) {
    console.log('\n❌ CRITICAL ISSUES:')
    issues.forEach(issue => console.log(`   • ${issue}`))
}

if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:')
    warnings.forEach(warning => console.log(`   • ${warning}`))
}

if (score === total) {
    console.log('\n🎉 ALL TESTS PASSED! Ready for Production!')
    console.log('\n📋 Next Steps:')
    console.log('   1. Read deploy/DEPLOYMENT_GUIDE.md')
    console.log('   2. Generate secrets: node scripts/generate-env-secrets.js')
    console.log('   3. Follow deploy/PRE_DEPLOY_CHECKLIST.md')
    console.log('   4. Deploy backend to Render')
    console.log('   5. Deploy frontend to Vercel')
    console.log('   6. Deploy admin to Vercel')
    process.exit(0)
} else {
    console.log('\n⚠️  Fix issues before deploying!')
    process.exit(1)
}
