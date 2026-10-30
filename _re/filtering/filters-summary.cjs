const fs = require('node:fs')
const path = require('node:path')
const dir = __dirname
const files = fs.readdirSync(dir).filter((f) => /^tl-q2-.*\.json$/.test(f))
if (!files.length) { console.log('no q2 file'); process.exit(1) }
const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'))
const pf = data.page_filters || []
console.log(`page_filters: ${pf.length}  (from ${files[0]})`)
pf.forEach((p, i) => {
  const items = p.items || []
  const sample = items.slice(0, 3).map((x) => x.name).join(' | ')
  console.log(
    `${String(i).padStart(2)}. ${String(p.title).padEnd(30)} items=${String(items.length).padStart(3)}` +
    ` price=${p.price_range ? `${p.price_range.min}..${p.price_range.max}` : '-'}  ${sample}`,
  )
})
console.log('\n--- distinct item keys ---')
const keySet = new Set()
for (const p of pf) for (const it of p.items || []) for (const k of Object.keys(it)) keySet.add(k)
console.log([...keySet].join(', '))
