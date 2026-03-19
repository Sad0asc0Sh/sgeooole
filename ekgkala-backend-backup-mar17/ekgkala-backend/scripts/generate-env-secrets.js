/**
 * ============================================
 * Generate Secure .env Values
 * Generates cryptographically secure values for .env
 * ============================================
 * 
 * Usage: node scripts/generate-env-secrets.js
 */

const crypto = require('crypto')

console.log('🔐 Generating Secure Values for .env\n')
console.log('='.repeat(60))
console.log('Copy these values to your .env file:\n')

// JWT Secret (64 bytes = 128 hex chars)
const jwtSecret = crypto.randomBytes(64).toString('hex')
console.log('JWT_SECRET=' + jwtSecret)
console.log()

// Admin Setup Key (32 bytes = 64 hex chars)
const adminSetupKey = crypto.randomBytes(32).toString('hex')
console.log('ADMIN_SETUP_KEY=' + adminSetupKey)
console.log()

// MongoDB Password suggestion (16 bytes = 32 chars, alphanumeric)
const dbPassword = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24)
console.log('# Suggested MongoDB Password (use in MONGODB_URI):')
console.log('# DB_PASSWORD=' + dbPassword)
console.log()

console.log('='.repeat(60))
console.log('\n📋 Instructions:')
console.log('1. Copy the values above to your .env file')
console.log('2. Replace CHANGE_THIS_... placeholders with real values')
console.log('3. Set chmod 600 .env to protect the file')
console.log('4. Never commit .env to git!')
console.log()

// Quick reference for other required values
console.log('📝 Other values you need to configure:')
console.log('   - MONGODB_URI: Your MongoDB connection string')
console.log('   - CLOUDINARY_*: From your Cloudinary dashboard')
console.log('   - ZARINPAL_MERCHANT_ID: From ZarinPal panel')
console.log('   - KAVENEGAR_API_KEY: From Kavenegar panel')
console.log('   - SMTP_*: Your email server settings')
console.log('   - CLIENT_URL/FRONTEND_URL: Your production domain')
console.log()
