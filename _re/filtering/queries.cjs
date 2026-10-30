const fs = require('node:fs')
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const prefix = process.argv[3] || 'tl'

function shapeOf(value, depth = 0) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `array(${value.length})`
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    return `{${keys.slice(0, 10).join(',')}${keys.length > 10 ? ',…' : ''}}`
  }
  if (typeof value === 'string') return `str(${value.length})`
  return typeof value
}

const queries = data?.props?.pageProps?.dehydratedState?.queries || []
console.log('queries:', queries.length)
queries.forEach((q, i) => {
  const key = JSON.stringify(q.queryKey)
  console.log(`\n[${i}] queryKey=${key} hash=${q.queryHash}`)
  const state = q.state || {}
  const d = state.data
  console.log('  data:', shapeOf(d))
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    for (const [k, v] of Object.entries(d)) console.log(`    .${k}: ${shapeOf(v)}`)
    // one level deeper for objects
    for (const [k, v] of Object.entries(d)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) console.log(`      .${k}.${k2}: ${shapeOf(v2)}`)
      }
    }
  } else if (Array.isArray(d) && d.length) {
    console.log('  first item:', shapeOf(d[0]))
    if (d[0] && typeof d[0] === 'object') {
      for (const [k, v] of Object.entries(d[0])) console.log(`    [0].${k}: ${shapeOf(v)}`)
    }
  }
  // dump each query separately for inspection
  const safe = key.replace(/[^a-z0-9]/gi, '_').slice(0, 80)
  fs.writeFileSync(`${prefix}-q${i}-${safe}.json`, JSON.stringify(d, null, 2), 'utf8')
})
console.log('\nwrote per-query json files')
