/**
 * Converts the main list tables of target pages to <ResponsiveTable>.
 * - Replaces every `<Table` with `<ResponsiveTable`
 * - Adds the proper relative import after the antd import line
 * - Removes `Table` from the antd import when no longer referenced
 * Preserves UTF-8. Usage: node scripts/apply-responsive-table.mjs
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
const compDir = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..',
  'src',
  'components',
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
let updated = 0

for (const name of targets) {
  const file = all.find((f) => path.basename(f) === name)
  if (!file) {
    console.log(`SKIP (not found): ${name}`)
    continue
  }

  let src = fs.readFileSync(file, 'utf8')

  const hasPlainTable = /<Table[\s>]/.test(src)
  const hasResponsive = /<ResponsiveTable[\s>]/.test(src)

  if (!hasPlainTable && !hasResponsive) {
    console.log(`SKIP (no table): ${name}`)
    continue
  }

  // 1) Replace plain Table usages (no-op on re-runs)
  if (hasPlainTable) {
    src = src.replace(/<Table(\s|>|\/)/g, '<ResponsiveTable$1')
  }

  // 2) Remove now-unused `Table` from the antd named import
  const bodyWithoutAntdImport = src.replace(
    /import\s*\{[^}]*\}\s*from\s*'antd'/,
    '',
  )
  const usesTableElsewhere =
    /(?<!Responsive)(?<!<)Table[.\s,}/]/.test(bodyWithoutAntdImport) ||
    /<Table[\s>/]/.test(src)

  if (!usesTableElsewhere) {
    src = src.replace(
      /(import\s*\{[^}]*?)\bTable,\s*([^}]*\}\s*from\s*'antd')/,
      "$1$2",
    )
    src = src.replace(
      /(import\s*\{\s*)Table,\s*/,
      '$1',
    )
    src = src.replace(
      /(import\s*\{[^}]*?),\s*Table(\s*\}\s*from\s*'antd')/,
      '$1$2',
    )
  }

  // 3) Add ResponsiveTable import after the antd import line
  const rel = path.relative(path.dirname(file), compDir).split(path.sep).join('/')
  const impLine = `import ResponsiveTable from '${rel}/ResponsiveTable'`

  if (!src.includes('ResponsiveTable from')) {
    if (/import\s*\{[^}]*\}\s*from\s*'antd'\r?\n/.test(src)) {
      src = src.replace(
        /(import\s*\{[^}]*\}\s*from\s*'antd'\r?\n)/,
        `$1${impLine}\n`,
      )
    } else {
      src = `${impLine}\n${src}`
    }
  }

  fs.writeFileSync(file, src, 'utf8')
  updated++
  console.log(`Converted: ${name}`)
}

console.log(`Done. Files updated: ${updated}`)
