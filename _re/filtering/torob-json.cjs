const fs = require('node:fs')
const [,, input, prefix] = process.argv
const html = fs.readFileSync(input, 'utf8')
const m = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
if (!m) { console.log(prefix, 'no pre'); process.exit(0) }
const decoded = m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
let d
try { d = JSON.parse(decoded) } catch (e) { console.log(prefix, 'parse fail', e.message); process.exit(0) }
fs.writeFileSync(`${prefix}.json`, JSON.stringify(d, null, 2), 'utf8')
console.log(`\n### ${prefix}: count=${d.count} price=${d.min_price}..${d.max_price} leaf=${d.category_is_leaf}`)
const show = (name, v) => {
  if (!Array.isArray(v) || !v.length) return
  console.log(` -- ${name} (${v.length})`)
  v.forEach((item) => {
    const n = Array.isArray(item.items) ? item.items.length : 0
    const sample = Array.isArray(item.items) ? JSON.stringify(item.items.slice(0,3)) : ''
    console.log(`    ${item.type || '?'} | ${item.slug} | ${item.title} | items=${n} ${sample.slice(0,220)}`)
  })
}
show('filters1', d.filters1)
show('filters2', d.filters2)
show('attributes', d.attributes)
show('available_filters', d.available_filters)
if (Array.isArray(d.categories)) console.log(' -- categories:', d.categories.length, JSON.stringify(d.categories.slice(0,6)))
