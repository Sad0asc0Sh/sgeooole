// Extractor: turn a REA capture bundle into inspectable artifacts.
// Usage: node extract.cjs <capture.json> <outPrefix>
const fs = require('node:fs')
const path = require('node:path')

const [, , input, prefix] = process.argv
if (!input || !prefix) {
  console.error('usage: node extract.cjs <capture.json> <outPrefix>')
  process.exit(2)
}

function readTextSmart(file) {
  const buf = fs.readFileSync(file)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le')
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    // BE → swap to LE
    const swapped = Buffer.from(buf.subarray(2))
    swapped.swap16()
    return swapped.toString('utf16le')
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8')
  return buf.toString('utf8')
}

const raw = JSON.parse(readTextSmart(input))
const nr = raw.normalized_result || raw
const steps = nr.steps || []

const outDir = path.dirname(prefix)
fs.mkdirSync(outDir, { recursive: true })

// --- DOM / accessibility / screenshot ---
const domChunks = []
for (const step of steps) {
  const art = step.artifacts || {}
  if (art.dom && art.dom.state === 'captured' && art.dom.value && (!art.dom.value.sha256 || art.dom.value.text || art.dom.value.html)) {
    const value = art.dom.value
    domChunks.push({ step: step.step_id, html: value.html || value.text || '' , sha: value.sha256, bytes: value.bytes })
  }
}
const finalDom = domChunks.filter((d) => d.html).at(-1)
if (finalDom) {
  fs.writeFileSync(`${prefix}.dom.html`, finalDom.html, 'utf8')
  console.log(`DOM: step=${finalDom.step} bytes=${finalDom.html.length} sha=${finalDom.sha}`)
} else {
  console.log('DOM: none captured')
}

const a11y = []
for (const step of steps) {
  const art = step.artifacts || {}
  if (art.accessibility && art.accessibility.state === 'captured' && art.accessibility.value?.text) {
    a11y.push({ step: step.step_id, text: art.accessibility.value.text })
  }
}
if (a11y.length) {
  fs.writeFileSync(`${prefix}.a11y.txt`, a11y.map((a) => `### ${a.step}\n${a.text}`).join('\n\n'), 'utf8')
  console.log(`A11Y: steps=${a11y.length}`)
}

// --- Screenshots ---
for (const step of steps) {
  const art = step.artifacts || {}
  const shot = art.screenshot
  if (shot && shot.state === 'captured' && shot.value) {
    const base64 = shot.value.data_base64 || shot.value.base64
    if (!base64) continue
    const file = `${prefix}.${step.step_id}.png`
    fs.writeFileSync(file, Buffer.from(base64, 'base64'))
    console.log(`SCREENSHOT: ${file} (${shot.value.bytes} bytes, ${shot.value.media_type})`)
  }
}

// --- Network: request/response pairs + json bodies ---
const events = []
for (const step of steps) {
  for (const ev of step.events?.items || []) events.push({ step: step.step_id, ...ev })
}
// Some bundles keep events at the top level.
for (const ev of nr.events?.items || []) events.push({ step: 'top', ...ev })

const requests = new Map()
const responses = new Map()
const contents = new Map()
for (const ev of events) {
  const id = ev.transaction_id || ev.request?.transaction_id
  if (!id) continue
  if (ev.kind === 'request') requests.set(id, ev)
  else if (ev.kind === 'response') responses.set(id, ev)
  else if (ev.kind === 'network-content') {
    const list = contents.get(id) || []
    list.push(ev)
    contents.set(id, list)
  }
}

const rows = []
for (const [id, req] of requests) {
  const res = responses.get(id) || {}
  const url = req.request?.url || req.url || res.response?.url || ''
  const status = res.response?.status ?? res.status ?? null
  const mime = res.response?.mime_type || res.response?.mimeType || res.mime_type || ''
  rows.push({ id, url, status, mime, method: req.request?.method || req.method || 'GET' })
}
fs.writeFileSync(`${prefix}.network.json`, JSON.stringify(rows, null, 2), 'utf8')
console.log(`NETWORK: transactions=${rows.length}`)

const apiDump = []
for (const [id, list] of contents) {
  for (const ev of list) {
    const c = ev.content || ev.value || ev
    const body = c.body_text || c.bodyText || c.text || (c.body_base64 ? null : null)
    const url = requests.get(id)?.request?.url || requests.get(id)?.url || ''
    if (!body) continue
    apiDump.push({ id, url, mime: c.media_type || c.mediaType || '', body })
  }
}
if (apiDump.length) {
  fs.writeFileSync(`${prefix}.network-bodies.json`, JSON.stringify(apiDump, null, 2), 'utf8')
  console.log(`BODIES: ${apiDump.length}`)
}

// --- Console / page errors ---
const logs = events
  .filter((ev) => ev.kind === 'console' || ev.kind === 'page-error')
  .map((ev) => ({ kind: ev.kind, step: ev.step, text: ev.text || ev.message || ev.console?.text || JSON.stringify(ev).slice(0, 400) }))
fs.writeFileSync(`${prefix}.logs.json`, JSON.stringify(logs, null, 2), 'utf8')
console.log(`LOGS: ${logs.length}`)

console.log(`FINAL_URL: ${JSON.stringify(nr.steps?.at(-1)?.after_url || nr.final_url || null)}`)
