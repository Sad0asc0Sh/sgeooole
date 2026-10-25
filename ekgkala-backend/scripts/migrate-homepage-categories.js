/**
 * Migration: replace legacy isFeatured / isPopular flags with the unified
 * "show on homepage" placement (showOnHomepage + homepageOrder).
 *
 * What it does:
 *   1. Categories with isFeatured=true OR isPopular=true get showOnHomepage=true
 *      (featured entries first, then popular ones, preserving their tree order).
 *   2. homepageOrder is assigned sequentially per migration order.
 *   3. The legacy fields are $unset from every category document.
 *   4. The legacy popularCategoriesSettings block is removed from Settings.
 *   5. The categoryViews collection (popular-categories analytics) is dropped.
 *
 * Usage:
 *   node scripts/migrate-homepage-categories.js          # apply
 *   node scripts/migrate-homepage-categories.js --dry    # preview only
 */
const mongoose = require('mongoose')
require('dotenv').config()

const DRY_RUN = process.argv.includes('--dry')

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const categories = db.collection('categories')

  const flagged = await categories
    .find({ $or: [{ isFeatured: true }, { isPopular: true }] })
    .sort({ order: 1, name: 1 })
    .toArray()

  console.log(`Found ${flagged.length} categories flagged as featured/popular.`)

  // Featured first (curated editorial order), then popular-only ones.
  const ordered = [
    ...flagged.filter((c) => c.isFeatured === true),
    ...flagged.filter((c) => c.isFeatured !== true && c.isPopular === true),
  ]

  if (!DRY_RUN) {
    for (let i = 0; i < ordered.length; i += 1) {
      await categories.updateOne(
        { _id: ordered[i]._id },
        { $set: { showOnHomepage: true, homepageOrder: i } },
      )
    }
    console.log(`✅ ${ordered.length} categories marked for the homepage carousel.`)

    const unsetResult = await categories.updateMany(
      {},
      { $unset: { isFeatured: '', isPopular: '' } },
    )
    console.log(`✅ Legacy flags removed from ${unsetResult.modifiedCount} documents.`)

    const settings = await db.collection('settings').updateOne(
      {},
      { $unset: { popularCategoriesSettings: '' } },
    )
    console.log(
      settings.modifiedCount > 0
        ? '✅ popularCategoriesSettings removed from Settings.'
        : 'ℹ️ No popularCategoriesSettings found in Settings.',
    )

    try {
      await db.dropCollection('categoryviews')
      console.log('✅ categoryviews collection dropped.')
    } catch (err) {
      console.log('ℹ️ categoryviews collection not present, skipped.')
    }
  } else {
    ordered.forEach((c, i) => {
      console.log(`  [dry] ${c.name} → showOnHomepage=true, homepageOrder=${i}`)
    })
    console.log('[dry] No changes were written.')
  }

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
