// Extract __NEXT_DATA__ JSON from a captured DOM and summarise its structure.
const fs = require('node:fs')
const file = process.argv[2]
const outPrefix = process.argv[3] || 'nextdata'
const html = fs.readFileSync(file, 'utf8')
const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
if (!m) { console.log('NO __NEXT_DATA__'); process.exit(1) }
let data
try { data = JSON.parse(m[1]) } catch (e) { console.log('PARSE FAIL', e.message); process.exit(1) }
fs.writeFileSync(`${outPrefix}.json`, JSON.stringify(data, null, 2), 'utf8')
console.log('bytes', m[1].length, '-> ', `${outPrefix}.json`)

const seen = new Set()
function walk(node, path, depth) {
  if (depth > 6 || node === null || typeof node !== 'object') return
  if (seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) {
    if (node.length) {
      const first = node[0]
      const shape = first && typeof first === 'object' ? Object.keys(first).slice(0, 12).join(',') : typeof first
      console.log(`  ${path}[] len=${node.length} first={${shape}}`)
    }
    if (node.length) walk(node[0], `${path}[0]`, depth + 1)
    return
  }
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === 'object') {
      walk(value, `${path}.${key}`, depth + 1)
    }
  }
}
console.log('--- top-level ---')
console.log(Object.keys(data).join(', '))
walk(data, '$', 0)
