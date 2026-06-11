const Page = require('../models/Page')

const defaultPages = [
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    status: 'published',
    content: '<h1>Terms & Conditions</h1><p>Please update this content from the admin panel.</p>',
  },
  {
    slug: 'faq',
    title: 'FAQ',
    status: 'published',
    content: '<h1>FAQ</h1><p>Please update this content from the admin panel.</p>',
  },
  {
    slug: 'about',
    title: 'About Us',
    status: 'published',
    content: '<h1>About Us</h1><p>Please update this content from the admin panel.</p>',
  },
]

/**
 * Seed default pages if they don't already exist.
 * Uses upsert logic: inserts only when slug is missing, never overwrites existing content.
 */
async function seedPages() {
  try {
    let created = 0
    let skipped = 0

    for (const page of defaultPages) {
      // upsert: only set content/setOnInsert so existing content is never overwritten
      const result = await Page.updateOne(
        { slug: page.slug },
        {
          $setOnInsert: {
            title: page.title,
            slug: page.slug,
            content: page.content,
            status: page.status,
          },
        },
        { upsert: true },
      )

      if (result.upsertedCount > 0) {
        created++
        console.log(`  ✅ Seeded page: ${page.slug}`)
      } else {
        skipped++
        console.log(`  ⏭️  Already exists: ${page.slug}`)
      }
    }

    console.log(`📄 Page seeder complete: ${created} created, ${skipped} skipped`)
  } catch (error) {
    console.error('❌ Page seeder failed:', error.message)
  }
}

module.exports = seedPages
