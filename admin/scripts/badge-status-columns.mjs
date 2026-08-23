/**
 * Marks status-like columns as `mobileBadge: true` so ResponsiveTable pins
 * them to the card header on phones. Idempotent. Preserves UTF-8.
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const pagesDir = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..',
  'src',
  'pages',
)

const targets = [
  'OrdersList.jsx',
  'ProductsList.jsx',
  'CustomersList.jsx',
  'InventoryPage.jsx',
  'TicketsList.jsx',
  'RMAPage.jsx',
  'BrandsPage.jsx',
  'CouponsPage.jsx',
  'SalesPage.jsx',
  'ShippingPage.jsx',
  'AdminsPage.jsx',
  'ReviewsPage.jsx',
  'AnnouncementsPage.jsx',
  'NewsletterPage.jsx',
  'BlogPosts.jsx',
  'PagesManagement.jsx',
  'AbandonedCartsPage.jsx',
  'AuditLogs.jsx',
  'CustomersReports.jsx',
  'ProductsReports.jsx',
  'AiProvidersPage.jsx',
  'BannersPage.jsx',
]

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return walk(p)
    if (d.name.endsWith('.jsx')) return [p]
    return []
  })
}

const all = walk(pagesDir)
let count = 0

for (const name of targets) {
  const file = all.find((f) => path.basename(f) === name)
  if (!file) continue

  let src = fs.readFileSync(file, 'utf8')
  const before = src

  // Only inside a column object that does not already carry the flag
  src = src.replace(
    /(\{[ \t]*\r?\n([ \t]*)title:[ \t]*'(?:وضعیت|status|وضعیت سفارش)',[ \t]*\r?\n)(?![^\n]*mobileBadge)/g,
    (m, head, indent) => `${head}${indent}mobileBadge: true,\n`,
  )

  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8')
    count++
    console.log(`Badged: ${name}`)
  }
}
console.log(`Files updated: ${count}`)
