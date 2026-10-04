/**
 * ============================================
 * Migration Script: Generate slugs for all products
 * ============================================
 * 
 * این اسکریپت برای محصولاتی که slug ندارند یا slug نامعتبر دارند
 * یک slug فارسی-friendly از روی نام محصول تولید می‌کند
 * 
 * Usage:
 *   node scripts/generate-product-slugs.js
 * 
 * یا از طریق pnpm:
 *   pnpm run migrate:slugs
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')

// ============================================
// CONFIGURATION
// ============================================
const DRY_RUN = process.argv.includes('--dry-run')  // اگر true باشد، تغییرات اعمال نمی‌شود
const VERBOSE = process.argv.includes('--verbose')

// ============================================
// SLUG GENERATOR (Same logic as Product model)
// ============================================
const generateSlug = (name) => {
    if (!name) return null

    const base = name.toString().trim().toLowerCase()

    let slug = base
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Keep only Unicode letters, numbers, and hyphens (supports Persian/Arabic)
        .replace(/[^\p{L}\p{N}\-]+/gu, '')
        // Replace multiple hyphens with single hyphen
        .replace(/\-+/g, '-')
        // Remove leading hyphens
        .replace(/^-+/, '')
        // Remove trailing hyphens
        .replace(/-+$/, '')

    return slug || null
}

// ============================================
// UNIQUE SLUG GENERATOR
// ============================================
const generateUniqueSlug = async (baseSlug, productId, existingSlugs) => {
    if (!baseSlug) return null

    let uniqueSlug = baseSlug
    let suffix = 1

    // Check in memory first (for batch processing)
    while (existingSlugs.has(uniqueSlug)) {
        suffix++
        uniqueSlug = `${baseSlug}-${suffix}`
    }

    // Double-check in database (to be safe)
    let dbCheck = await Product.findOne({ slug: uniqueSlug, _id: { $ne: productId } })
    while (dbCheck) {
        suffix++
        uniqueSlug = `${baseSlug}-${suffix}`
        dbCheck = await Product.findOne({ slug: uniqueSlug, _id: { $ne: productId } })
    }

    return uniqueSlug
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================
const migrateProductSlugs = async () => {
    console.log('============================================')
    console.log('🚀 Product Slug Migration Script')
    console.log('============================================')
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE RUN'}`)
    console.log('')

    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
        console.log(`📦 Connecting to MongoDB...`)
        await mongoose.connect(mongoUri)
        console.log(`✅ Connected to MongoDB`)
        console.log('')

        // Get all products
        const products = await Product.find({}).lean()
        console.log(`📊 Total products found: ${products.length}`)

        // Collect existing slugs to track uniqueness
        const existingSlugs = new Set(
            products
                .filter(p => p.slug && p.slug !== p._id.toString())
                .map(p => p.slug)
        )

        // Find products that need slug update
        const needsUpdate = products.filter(p => {
            // No slug at all
            if (!p.slug) return true
            // Slug is just the MongoDB ID (gibberish)
            if (p.slug === p._id.toString()) return true
            // Slug is a MongoDB ObjectId format (24 hex chars)
            if (/^[a-f0-9]{24}$/i.test(p.slug)) return true
            return false
        })

        console.log(`🔄 Products needing slug update: ${needsUpdate.length}`)
        console.log('')

        if (needsUpdate.length === 0) {
            console.log('✅ All products already have valid slugs!')
            await mongoose.disconnect()
            return
        }

        // Process each product
        let updatedCount = 0
        let errorCount = 0

        for (const product of needsUpdate) {
            try {
                const baseSlug = generateSlug(product.name)

                if (!baseSlug) {
                    console.log(`⚠️ [${product._id}] Cannot generate slug from name: "${product.name}"`)
                    errorCount++
                    continue
                }

                // Generate unique slug
                const newSlug = await generateUniqueSlug(baseSlug, product._id, existingSlugs)

                if (VERBOSE || DRY_RUN) {
                    console.log(`📝 [${product._id}]`)
                    console.log(`   Name: ${product.name}`)
                    console.log(`   Old Slug: ${product.slug || '(empty)'}`)
                    console.log(`   New Slug: ${newSlug}`)
                }

                if (!DRY_RUN) {
                    // Update in database
                    await Product.updateOne(
                        { _id: product._id },
                        { $set: { slug: newSlug } }
                    )
                }

                // Track the new slug
                existingSlugs.add(newSlug)
                updatedCount++

            } catch (err) {
                console.error(`❌ Error processing product ${product._id}:`, err.message)
                errorCount++
            }
        }

        console.log('')
        console.log('============================================')
        console.log('📊 Migration Summary')
        console.log('============================================')
        console.log(`✅ Products updated: ${updatedCount}`)
        console.log(`❌ Errors: ${errorCount}`)
        console.log(`📦 Total products: ${products.length}`)
        console.log('')

        if (DRY_RUN) {
            console.log('🔍 This was a DRY RUN. No changes were made.')
            console.log('   Run without --dry-run to apply changes.')
        } else {
            console.log('✅ Migration completed successfully!')
        }

    } catch (error) {
        console.error('❌ Migration failed:', error)
        process.exit(1)
    } finally {
        await mongoose.disconnect()
        console.log('📦 Disconnected from MongoDB')
    }
}

// ============================================
// RUN
// ============================================
migrateProductSlugs()
