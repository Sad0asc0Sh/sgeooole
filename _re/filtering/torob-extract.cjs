const fs = require('node:fs')
const html = fs.readFileSync('torob-api-retry.dom.html', 'utf8')
const m = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
if (!m) { console.log('no pre'); process.exit(1) }
const decoded = m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
let data
try { data = JSON.parse(decoded) } catch (e) { console.log('parse fail', e.message, decoded.slice(0,200)); process.exit(1) }
fs.writeFileSync('torob-search-sample.json', JSON.stringify(data, null, 2), 'utf8')
console.log('top keys:', Object.keys(data).join(', '))
for (const [k,v] of Object.entries(data)) {
  const shape = Array.isArray(v) ? `array(${v.length})` : (v && typeof v === 'object' ? `{${Object.keys(v).slice(0,12).join(',')}}` : typeof v)
  console.log(` ${k}: ${shape}`)
}
if (data.results?.length) console.log('result[0] keys:', Object.keys(data.results[0]).join(', '))
