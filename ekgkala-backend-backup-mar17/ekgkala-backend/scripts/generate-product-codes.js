/**
 * ============================================
 * Migration Script: Generate productCode for all products
 * ============================================
 * 
 * این اسکریپت برای محصولاتی که productCode ندارند
 * یک کد یکتا (KY-XXXXXXX) تولید می‌کند
 * 
 * Usage:
 *   node scripts/generate-product-codes.js
 *   node scripts/generate-product-codes.js --dry-run
 *   node scripts/generate-product-codes.js --verbose
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')

// ============================================
// CONFIGURATION
// ============================================
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// ============================================
// PRODUCT CODE GENERATOR
// ============================================
const generateProductCode = (product, existingCodes) => {
    let code = ''

    // Try to extract 7 digits from SKU first
    if (product.sku) {
        const skuDigits = product.sku.replace(/\D/g, '')
        if (skuDigits.length > 0) {
            code = skuDigits.slice(-7).padStart(7, '0')
        }
    }

    // If no valid SKU, generate from MongoDB ObjectId
    if (!code) {
        const id = product._id.toString()
        // Convert hex to numeric and take last 7 digits
        const numericId = parseInt(id.slice(-8), 16)
        code = (numericId % 10000000).toString().padStart(7, '0')
    }

    let productCode = `KY-${code}`

    // Ensure uniqueness
    let suffix = 1
    while (existingCodes.has(productCode)) {
        suffix++
        const newNum = (parseInt(code) + suffix) % 10000000
        productCode = `KY-${newNum.toString().padStart(7, '0')}`
    }

    return productCode
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================
const migrateProductCodes = async () => {
    console.log('╔════════════════════════════════════════════╗')
    console.log('║  🚀 Product Code Migration Script          ║')
    console.log('║  Generates KY-XXXXXXX codes for products   ║')
    console.log('╚════════════════════════════════════════════╝')
    console.log('')
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '⚡ LIVE RUN (will update database)'}`)

    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
        console.log(`\n📦 Connecting to MongoDB...`)
        await mongoose.connect(mongoUri)
        console.log(`✅ Connected: ${mongoose.connection.host}`)

        // Get all products
        const products = await Product.find({}).lean()
        console.log(`\n📊 Total products found: ${products.length}`)

        // Collect existing product codes
        const existingCodes = new Set(
            products
                .filter(p => p.productCode)
                .map(p => p.productCode)
        )
        console.log(`📦 Existing product codes: ${existingCodes.size}`)

        // Find products needing update
        const needsUpdate = products.filter(p => !p.productCode)
        console.log(`🔄 Products needing code: ${needsUpdate.length}`)

        if (needsUpdate.length === 0) {
            console.log('\n✅ All products already have product codes!')
            await mongoose.disconnect()
            return
        }

        let updatedCount = 0
        let errorCount = 0

        console.log('\n📝 Generating product codes...\n')

        for (const product of needsUpdate) {
            try {
                const newCode = generateProductCode(product, existingCodes)

                if (VERBOSE || DRY_RUN) {
                    console.log(`   [${product._id}] ${product.name.substring(0, 40)}...`)
                    console.log(`   → Code: ${newCode}`)
                    if (product.sku) console.log(`   → SKU: ${product.sku}`)
                    console.log('')
                }

                if (!DRY_RUN) {
                    await Product.updateOne(
                        { _id: product._id },
                        { $set: { productCode: newCode } }
                    )
                }

                existingCodes.add(newCode)
                updatedCount++

            } catch (err) {
                console.error(`❌ Error processing ${product._id}:`, err.message)
                errorCount++
            }
        }

        console.log('╔════════════════════════════════════════════╗')
        console.log('║  📊 Migration Summary                       ║')
        console.log('╠════════════════════════════════════════════╣')
        console.log(`║  ✅ Products updated: ${updatedCount}`)
        console.log(`║  ❌ Errors: ${errorCount}`)
        console.log(`║  📦 Total products: ${products.length}`)
        console.log('╚════════════════════════════════════════════╝')

        if (DRY_RUN) {
            console.log('\n🔍 This was a DRY RUN - no changes were made.')
            console.log('   Run without --dry-run to apply changes:')
            console.log('   node scripts/generate-product-codes.js')
        } else {
            console.log(`\n✅ Migration completed! ${updatedCount} products updated.`)
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error)
        process.exit(1)
    } finally {
        await mongoose.disconnect()
        console.log('\n📦 Disconnected from MongoDB')
    }
}

migrateProductCodes()
