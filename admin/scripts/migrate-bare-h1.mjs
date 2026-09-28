/**
 * One-off: convert remaining bare <h1> page titles to <PageHeader>.
 * Each entry names the literal title text as it appears in the file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [
  {
    file: 'src/pages/products/ProductForm.jsx',
    literal: '<h1>{isEdit ? \'ویرایش محصول\' : \'ایجاد محصول جدید\'}</h1>',
    expr: "{isEdit ? 'ویرایش محصول' : 'ایجاد محصول جدید'}",
  },
  {
    file: 'src/pages/products/ProductVariants.jsx',
    literal: '<h1>ProductVariants</h1>',
    expr: '"ProductVariants"',
  },
  {
    file: 'src/pages/tickets/TicketDetail.jsx',
    literal: '<h1>جزئیات تیکت</h1>',
    expr: '"جزئیات تیکت"',
  },
  {
    file: 'src/pages/reports/ProductsReports.jsx',
    literal: '<h1>گزارش محصولات</h1>',
    expr: '"گزارش محصولات"',
  },
  {
    file: 'src/pages/reports/CustomersReports.jsx',
    literal: '<h1>گزارش مشتریان</h1>',
    expr: '"گزارش مشتریان"',
  },
]

for (const { file, literal, expr } of TARGETS) {
  const full = path.join(ROOT, file)
  let src = fs.readFileSync(full, 'utf8')
  const idx = src.indexOf(literal)
  if (idx < 0) {
    console.log('MISS', file)
    continue
  }

  // Reuse the whitespace that preceded the <h1> for the new element.
  const lineStart = src.lastIndexOf('\n', idx) + 1
  const indent = src.slice(lineStart, idx)

  src =
    src.slice(0, idx) +
    `${indent}<PageHeader title={${expr}} />` +
    src.slice(idx + literal.length)

  if (!/import\s+PageHeader\s+from/.test(src)) {
    const depth = path
      .relative(path.join(ROOT, 'src', 'pages'), full)
      .split(path.sep).length
    const rel = '../'.repeat(depth) + 'components/ui/PageHeader'
    src = `import PageHeader from '${rel}'\n` + src
  }

  fs.writeFileSync(full, src, 'utf8')
  console.log('ok  ', file)
}
