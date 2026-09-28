/**
 * Codemod: replace legacy antd v4 palette hexes with design tokens.
 *
 * The panel was built against antd's old defaults, so pages carried
 * #1890ff blue and #52c41a green inline. Those no longer mean anything
 * in the new palette (blue reads as a link colour, green as a status)
 * and they sat next to saffron, which muddied every screen they
 * touched. This swaps them for the token values.
 *
 * Usage:  node scripts/migrate-legacy-colors.mjs [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const DRY = process.argv.includes('--dry')

/**
 * hex → replacement. Keys are the exact lowercase hex as written in
 * the source; values are the token (or literal) to put in its place.
 *
 * `var(--x)` only works in CSS — inside a JSX style object it has to be
 * a literal string, so JSX gets a hex and stylesheets get the var.
 */
const MAP = {
  // primary / interactive — now saffron
  '#1677ff': 'BRAND',
  '#1890ff': 'BRAND',
  '#2f54eb': 'BRAND',
  '#1d39c4': 'BRAND',
  // indigo leftovers from the previous skin
  '#4f46e5': 'BRAND',
  '#6366f1': 'BRAND',
  '#8c8c8c': 'INK',
  // status
  '#52c41a': 'OK',
  '#389e0d': 'OK',
  '#73d13d': 'OK',
  '#95de64': 'OK',
  '#f5222d': 'ERR',
  '#ff4d4f': 'ERR',
  '#a8071a': 'ERR',
  '#fa8c16': 'WARN',
  '#faad14': 'WARN',
  '#d48806': 'WARN',
  // neutrals — warm, not cool slate
  '#8c8c8c ': 'INK',
}

const JSX = {
  BRAND: '#b45309',
  OK: '#0f6b33',
  ERR: '#b3261e',
  WARN: '#8a6200',
  INK: '#57534e',
}

const CSS = {
  BRAND: 'var(--brand-600)',
  OK: 'var(--ok)',
  ERR: 'var(--err)',
  WARN: 'var(--warn)',
  INK: 'var(--ink-600)',
}

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(jsx|js|css)$/.test(e.name)) out.push(p)
  }
  return out
}

let files = 0
let swaps = 0
const report = []

for (const file of walk(SRC)) {
  const isCss = file.endsWith('.css')
  const table = isCss ? CSS : JSX
  let src = fs.readFileSync(file, 'utf8')
  let n = 0

  for (const [hex, token] of Object.entries(MAP)) {
    const re = new RegExp(hex.replace('#', '#'), 'gi')
    const matches = src.match(re)
    if (!matches) continue
    src = src.replace(re, table[token])
    n += matches.length
  }

  if (n > 0) {
    files++
    swaps += n
    report.push(`${path.relative(ROOT, file)} — ${n}`)
    if (!DRY) fs.writeFileSync(file, src, 'utf8')
  }
}

console.log(`${DRY ? '[dry] ' : ''}${files} files, ${swaps} colours replaced`)
for (const line of report) console.log('  ' + line)
