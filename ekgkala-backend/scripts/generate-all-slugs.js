/**
 * ============================================
 * Master Migration Script: Generate ALL slugs
 * ============================================
 * 
 * این اسکریپت برای همه موجودیت‌ها (Products, Categories, Brands)
 * slug فارسی تولید می‌کند
 * 
 * Usage:
 *   node scripts/generate-all-slugs.js
 *   node scripts/generate-all-slugs.js --dry-run
 *   node scripts/generate-all-slugs.js --verbose
 * 
 * یا از طریق pnpm:
 *   pnpm run migrate:all-slugs
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')
const Category = require('../models/Category')
const Brand = require('../models/Brand')

// ============================================
// CONFIGURATION
// ============================================
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// ============================================
// SLUG GENERATOR (Unicode-safe, supports Persian/Arabic)
// ============================================
const generateSlug = (name) => {
    if (!name) return null

    const base = name.toString().trim().toLowerCase()

    let slug = base
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Keep only Unicode letters, numbers, and hyphens (supports Persian/Arabic/etc)
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
// GENERIC MIGRATION FUNCTION
// ============================================
const migrateModel = async (Model, modelName, existingSlugsSet) => {
    console.log(`\n📂 Processing ${modelName}...`)

    const documents = await Model.find({}).lean()
    console.log(`   Total ${modelName}: ${documents.length}`)

    // Find documents needing update
    const needsUpdate = documents.filter(doc => {
        if (!doc.slug) return true
        if (doc.slug === doc._id.toString()) return true
        if (/^[a-f0-9]{24}$/i.test(doc.slug)) return true
        return false
    })

    console.log(`   Needing update: ${needsUpdate.length}`)

    if (needsUpdate.length === 0) {
        console.log(`   ✅ All ${modelName} have valid slugs`)
        return { updated: 0, errors: 0 }
    }

    let updatedCount = 0
    let errorCount = 0

    for (const doc of needsUpdate) {
        try {
            const baseSlug = generateSlug(doc.name || doc.title)

            if (!baseSlug) {
                if (VERBOSE) console.log(`   ⚠️ Cannot generate slug for: ${doc._id}`)
                errorCount++
                continue
            }

            // Generate unique slug
            let uniqueSlug = baseSlug
            let suffix = 1

            while (existingSlugsSet.has(uniqueSlug)) {
                suffix++
                uniqueSlug = `${baseSlug}-${suffix}`
            }

            // Double-check database
            let dbCheck = await Model.findOne({ slug: uniqueSlug, _id: { $ne: doc._id } })
            while (dbCheck) {
                suffix++
                uniqueSlug = `${baseSlug}-${suffix}`
                dbCheck = await Model.findOne({ slug: uniqueSlug, _id: { $ne: doc._id } })
            }

            if (VERBOSE) {
                console.log(`   📝 ${doc.name || doc.title}: ${doc.slug || '(empty)'} → ${uniqueSlug}`)
            }

            if (!DRY_RUN) {
                await Model.updateOne(
                    { _id: doc._id },
                    { $set: { slug: uniqueSlug } }
                )
            }

            existingSlugsSet.add(uniqueSlug)
            updatedCount++

        } catch (err) {
            console.error(`   ❌ Error: ${doc._id}:`, err.message)
            errorCount++
        }
    }

    console.log(`   ✅ Updated: ${updatedCount}, Errors: ${errorCount}`)
    return { updated: updatedCount, errors: errorCount }
}

// ============================================
// MAIN FUNCTION
// ============================================
const migrateAllSlugs = async () => {
    console.log('╔════════════════════════════════════════════╗')
    console.log('║  🚀 Master Slug Migration Script           ║')
    console.log('║  Generates SEO-friendly Persian slugs      ║')
    console.log('╚════════════════════════════════════════════╝')
    console.log('')
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '⚡ LIVE RUN (will update database)'}`)

    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
        console.log(`\n📦 Connecting to MongoDB...`)
        await mongoose.connect(mongoUri)
        console.log(`✅ Connected: ${mongoose.connection.host}`)

        // Track all slugs to ensure uniqueness across models
        const allExistingSlugs = new Set()

        // Pre-load existing valid slugs
        const existingProducts = await Product.find({ slug: { $exists: true, $ne: null } }, 'slug').lean()
        const existingCategories = await Category.find({ slug: { $exists: true, $ne: null } }, 'slug').lean()
        const existingBrands = await Brand.find({ slug: { $exists: true, $ne: null } }, 'slug').lean()

        existingProducts.forEach(p => {
            if (p.slug && !/^[a-f0-9]{24}$/i.test(p.slug)) allExistingSlugs.add(p.slug)
        })
        existingCategories.forEach(c => {
            if (c.slug && !/^[a-f0-9]{24}$/i.test(c.slug)) allExistingSlugs.add(c.slug)
        })
        existingBrands.forEach(b => {
            if (b.slug && !/^[a-f0-9]{24}$/i.test(b.slug)) allExistingSlugs.add(b.slug)
        })

        console.log(`\n📊 Pre-loaded ${allExistingSlugs.size} existing valid slugs`)

        // Migrate each model
        const categoryResult = await migrateModel(Category, 'Categories', allExistingSlugs)
        const brandResult = await migrateModel(Brand, 'Brands', allExistingSlugs)
        const productResult = await migrateModel(Product, 'Products', allExistingSlugs)

        // Summary
        console.log('\n╔════════════════════════════════════════════╗')
        console.log('║  📊 Migration Summary                       ║')
        console.log('╠════════════════════════════════════════════╣')
        console.log(`║  Categories: ${categoryResult.updated} updated, ${categoryResult.errors} errors`)
        console.log(`║  Brands:     ${brandResult.updated} updated, ${brandResult.errors} errors`)
        console.log(`║  Products:   ${productResult.updated} updated, ${productResult.errors} errors`)
        console.log('╚════════════════════════════════════════════╝')

        const totalUpdated = categoryResult.updated + brandResult.updated + productResult.updated
        const totalErrors = categoryResult.errors + brandResult.errors + productResult.errors

        if (DRY_RUN) {
            console.log('\n🔍 This was a DRY RUN - no changes were made.')
            console.log('   Run without --dry-run to apply changes:')
            console.log('   node scripts/generate-all-slugs.js')
        } else {
            console.log(`\n✅ Migration completed! ${totalUpdated} items updated.`)
        }

        if (totalErrors > 0) {
            console.log(`\n⚠️ ${totalErrors} items could not be processed. Check logs above.`)
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error)
        process.exit(1)
    } finally {
        await mongoose.disconnect()
        console.log('\n📦 Disconnected from MongoDB')
    }
}

migrateAllSlugs()
