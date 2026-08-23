/**
 * Adds `scroll={{ x: 'max-content' }}` to every antd Table that lacks a
 * scroll prop. Handles multi-line JSX blocks safely and preserves UTF-8.
 * Usage: node scripts/add-table-scroll.mjs
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

let fixedCount = 0
const changedFiles = []

for (const file of walk(root)) {
  const src = fs.readFileSync(file, 'utf8')
  let out = src
  let count = 0

  // Match each <Table ...> opening block up to its first rowKey=... line.
  const re = /(<Table\b)([\s\S]*?)(rowKey=\{?"?(?:_id|key|orderNumber)"?\}?)/g
  out = out.replace(re, (match, tag, middle, rowKeyPart) => {
    if (/scroll\s*=/.test(middle)) return match // already scrollable
    count++
    // Preserve indentation of the rowKey line for the inserted line.
    const lines = middle.split('\n')
    let indent = '            '
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() !== '') {
        indent = lines[i].match(/^\s*/)[0]
        break
      }
    }
    return `${tag}${middle}${rowKeyPart}\n${indent}scroll={{ x: 'max-content' }}`
  })

  if (count > 0) {
    fs.writeFileSync(file, out, 'utf8')
    fixedCount += count
    changedFiles.push(`${path.basename(file)} (${count})`)
  }
}

console.log(`Added scroll to ${fixedCount} table(s):`)
console.log(changedFiles.join('\n'))
