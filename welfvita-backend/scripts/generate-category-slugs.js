/**
 * ============================================
 * Migration Script: Generate slugs for all categories
 * ============================================
 * 
 * این اسکریپت برای دسته‌بندی‌هایی که slug ندارند یا slug نامعتبر دارند
 * یک slug فارسی-friendly از روی نام تولید می‌کند
 * 
 * Usage:
 *   node scripts/generate-category-slugs.js
 *   node scripts/generate-category-slugs.js --dry-run
 *   node scripts/generate-category-slugs.js --verbose
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Category = require('../models/Category')

// ============================================
// CONFIGURATION
// ============================================
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// ============================================
// SLUG GENERATOR
// ============================================
const generateSlug = (name) => {
    if (!name) return null

    const base = name.toString().trim().toLowerCase()

    let slug = base
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-]+/gu, '')
        .replace(/\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')

    return slug || null
}

// ============================================
// UNIQUE SLUG GENERATOR
// ============================================
const generateUniqueSlug = async (baseSlug, categoryId, existingSlugs) => {
    if (!baseSlug) return null

    let uniqueSlug = baseSlug
    let suffix = 1

    while (existingSlugs.has(uniqueSlug)) {
        suffix++
        uniqueSlug = `${baseSlug}-${suffix}`
    }

    let dbCheck = await Category.findOne({ slug: uniqueSlug, _id: { $ne: categoryId } })
    while (dbCheck) {
        suffix++
        uniqueSlug = `${baseSlug}-${suffix}`
        dbCheck = await Category.findOne({ slug: uniqueSlug, _id: { $ne: categoryId } })
    }

    return uniqueSlug
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================
const migrateCategorySlugs = async () => {
    console.log('============================================')
    console.log('🚀 Category Slug Migration Script')
    console.log('============================================')
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE RUN'}`)
    console.log('')

    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita'
        console.log(`📦 Connecting to MongoDB...`)
        await mongoose.connect(mongoUri)
        console.log(`✅ Connected to MongoDB`)
        console.log('')

        const categories = await Category.find({}).lean()
        console.log(`📊 Total categories found: ${categories.length}`)

        const existingSlugs = new Set(
            categories
                .filter(c => c.slug && c.slug !== c._id.toString())
                .map(c => c.slug)
        )

        const needsUpdate = categories.filter(c => {
            if (!c.slug) return true
            if (c.slug === c._id.toString()) return true
            if (/^[a-f0-9]{24}$/i.test(c.slug)) return true
            return false
        })

        console.log(`🔄 Categories needing slug update: ${needsUpdate.length}`)
        console.log('')

        if (needsUpdate.length === 0) {
            console.log('✅ All categories already have valid slugs!')
            await mongoose.disconnect()
            return
        }

        let updatedCount = 0
        let errorCount = 0

        for (const category of needsUpdate) {
            try {
                const baseSlug = generateSlug(category.name)

                if (!baseSlug) {
                    console.log(`⚠️ [${category._id}] Cannot generate slug from name: "${category.name}"`)
                    errorCount++
                    continue
                }

                const newSlug = await generateUniqueSlug(baseSlug, category._id, existingSlugs)

                if (VERBOSE || DRY_RUN) {
                    console.log(`📝 [${category._id}]`)
                    console.log(`   Name: ${category.name}`)
                    console.log(`   Old Slug: ${category.slug || '(empty)'}`)
                    console.log(`   New Slug: ${newSlug}`)
                }

                if (!DRY_RUN) {
                    await Category.updateOne(
                        { _id: category._id },
                        { $set: { slug: newSlug } }
                    )
                }

                existingSlugs.add(newSlug)
                updatedCount++

            } catch (err) {
                console.error(`❌ Error processing category ${category._id}:`, err.message)
                errorCount++
            }
        }

        console.log('')
        console.log('============================================')
        console.log('📊 Migration Summary')
        console.log('============================================')
        console.log(`✅ Categories updated: ${updatedCount}`)
        console.log(`❌ Errors: ${errorCount}`)
        console.log(`📦 Total categories: ${categories.length}`)
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

migrateCategorySlugs()
