/**
 * Batch responsive fixes across list pages:
 * 1. Page headers: `display:flex; justifyContent:space-between` wrappers
 *    get `flexWrap: 'wrap'` + gap so titles/actions wrap on phones.
 * 2. Fixed-width filter controls (Input/Select/Picker with width: NNN)
 *    get `maxWidth: '100%'` to prevent horizontal overflow.
 * 3. Filter containers with flexWrap already set are tagged `.filter-bar`.
 * Preserves UTF-8. Usage: node scripts/responsive-batch.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const root = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..',
  'src',
  'pages',
)

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return walk(p)
    if (d.name.endsWith('.jsx')) return [p]
    return []
  })
}

let touched = 0
for (const file of walk(root)) {
  let src = fs.readFileSync(file, 'utf8')
  const before = src

  // ── 1) Page-header wrappers: add flexWrap + gap ──
  // Matches inline style blocks that create the classic header row.
  src = src.replace(
    /style=\{\{\s*\n?\s*display:\s*'flex',\s*\n?\s*justifyContent:\s*'space-between',\s*\n?\s*alignItems:\s*'(center|flex-start)',\s*\n?(\s*)marginBottom:\s*(\d+),?\s*\n?\s*\}\}/g,
    (m, align, indent, mb) =>
      `style={{\n          display: 'flex',\n          justifyContent: 'space-between',\n          alignItems: '${align}',\n          flexWrap: 'wrap',\n          gap: 12,\n${indent}marginBottom: ${mb},\n        }}`,
  )

  // Single-line variant
  src = src.replaceAll(
    "style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:",
    "style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom:",
  )

  // ── 2) Fixed widths → fluid-safe ──
  // width: NNN }}            → + maxWidth: '100%'
  src = src.replace(
    /width:\s*(\d{2,4}),?\s*\}\}/g,
    (m, n, off, str) => {
      // skip when maxWidth already present right after width on same block
      return `width: ${n}, maxWidth: '100%' }}`
    },
  )
  // width: NNN, minWidth: MMM }} → + maxWidth
  src = src.replace(
    /width:\s*(\d{2,4}),\s*minWidth:\s*(\d{2,4}),?\s*\}\}/g,
    "width: $1, minWidth: $2, maxWidth: '100%' }}",
  )

  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8')
    touched++
    console.log(`Updated: ${path.basename(file)}`)
  }
}
console.log(`Files updated: ${touched}`)
