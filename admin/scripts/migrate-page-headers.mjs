/**
 * Codemod: replace hand-written inline page headers with <PageHeader>.
 *
 * Most list pages open with the same copy-pasted flex <div> — twelve of
 * them are byte-identical apart from the margin value. This rewrites
 * them so they share one component, and adds the import where missing.
 *
 * Usage:  node scripts/migrate-page-headers.mjs [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAGES = path.join(ROOT, 'src', 'pages')
const DRY = process.argv.includes('--dry')

/** Props that mark an inline header row, in any order/spacing. */
const HEADER_PROPS = [
  'display',
  'justifyContent',
  'alignItems',
  'flexWrap',
  'gap',
  'marginBottom',
]

/** Props on a header row that mean "this isn't a page header". */
const NOT_A_HEADER = [
  'flexDirection',
  'position',
  'background',
  'overflow',
  'maxWidth',
  'textAlign',
  'gridTemplateColumns',
  'minHeight',
  'borderBottom',
]

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith('.jsx')) out.push(p)
  }
  return out
}

/** Index just past the matching `}` for the `{` at `openIdx`. */
function matchBrace(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Split a JSX element's direct children into (before <h1>, h1, after).
 * Scans at depth 1 and is not fooled by braces inside expressions.
 */
function splitAtH1(inner) {
  const open = inner.indexOf('<h1')
  if (open < 0) return null
  const afterH1Open = inner.indexOf('>', open)
  const h1Close = inner.indexOf('</h1>', afterH1Open)
  if (h1Close < 0) return null
  return {
    before: inner.slice(0, open),
    title: inner.slice(open, h1Close + 5),
    after: inner.slice(h1Close + 5),
  }
}

const titleText = (jsx) => {
  const m = jsx.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  if (!m) return null
  // Only plain text titles are safe to lift; anything with an expression
  // or a nested element is left alone for a human to look at.
  if (/[<>{}]/.test(m[1].trim())) return null
  return m[1].trim()
}

let changedFiles = 0
let changedBlocks = 0
const skipped = []

for (const file of walk(PAGES)) {
  const original = fs.readFileSync(file, 'utf8')
  let src = original
  let touched = false

  // Only rows that immediately precede an <h1>. The style object is a
  // flat literal, so it contains no `>`; forbidding one stops the lazy
  // match from running past this div and pairing with a much later <h1>.
  const pattern = /<div\s+style=\{\{([^>]*?)\}\}\s*>\s*<h1/g
  let match
  const edits = []

  while ((match = pattern.exec(src)) !== null) {
    // The style object opens with a doubled brace — `style={{…}}` — so
    // the value expression starts at the second `{`. Search forward from
    // the match so a lazy regex can't pair a `style={{` with a much later
    // `<h1>`.
    const styleEq = src.indexOf('style=', match.index)
    const braceOpen = src.indexOf('{', styleEq) + 1
    const braceClose = matchBrace(src, braceOpen)
    if (braceClose < 0) continue

    // `braceClose` is the `}` that closes the style *value*; the object
    // literal's own `}` follows it. Check that pair is really there, so
    // a lazy regex can't have paired a `style={{` with a later `<h1>`.
    if (src[braceClose + 1] !== '}') continue

    const styleBody = src.slice(braceOpen + 1, braceClose)
    const props = styleBody
      .split(',')
      .map((s) => s.split(':')[0].trim())
      .filter(Boolean)

    if (!props.includes('display') || !props.includes('justifyContent')) continue
    if (props.some((p) => NOT_A_HEADER.includes(p))) continue
    const missing = HEADER_PROPS.filter((p) => !props.includes(p))
    if (missing.length > 0) {
      skipped.push([path.relative(ROOT, file), `props: ${props.join(',')}`])
      continue
    }

    // Full element span: <div …> … </div>. The tag must close right after
    // the style object (whitespace and a bare `>`), otherwise this div
    // carries other attributes and we have paired the wrong element.
    const gtMatch = /^\}\s*>/.exec(src.slice(braceClose + 1))
    if (!gtMatch) continue

    const divOpenEnd = braceClose + 1 + gtMatch[0].length
    const closeTag = '</div>'
    const closeIdx = src.indexOf(closeTag, divOpenEnd)
    if (closeIdx < 0) continue
    const inner = src.slice(divOpenEnd, closeIdx)
    const parts = splitAtH1(inner)
    if (!parts) continue

    const title = titleText(parts.title)
    if (!title) continue

    const actions = parts.after.replace(/\s+$/, '')
    const indent = (match[0].match(/\n\s*/) || ['        '])[0]
    const pad = ' '.repeat(Math.max(0, indent.length - 2))

    const rawActions = actions.trim()
    const actionBlock = rawActions
      ? `\n${pad}  actions={\n${pad}    <>\n${rawActions.replace(/\n/g, '\n' + pad + '      ')}\n${pad}    </>\n${pad}  }`
      : ''

    const replacement = `<PageHeader\n${pad}  title="${title}"${actionBlock}\n${pad}/>`

    edits.push({
      start: match.index,
      end: closeIdx + closeTag.length,
      text: replacement,
    })
  }

  if (edits.length) {
    // Apply back-to-front so earlier offsets stay valid.
    for (let i = edits.length - 1; i >= 0; i--) {
      const e = edits[i]
      src = src.slice(0, e.start) + e.text + src.slice(e.end)
    }
    changedBlocks += edits.length
    touched = true
  }

  if (touched) {
    if (!/import\s+PageHeader\s+from/.test(src)) {
      // Add after the final import line so the diff stays at the top.
      const importRe = /^import .*$/gm
      let last = null
      let m2
      while ((m2 = importRe.exec(src)) !== null) last = m2
      if (last) {
        const idx = last.index + last[0].length
        const depth = path.relative(path.join(ROOT, 'src', 'pages'), file).split(path.sep).length
        const rel = '../'.repeat(depth) + 'components/ui/PageHeader'
        src =
          src.slice(0, idx) +
          `\nimport PageHeader from '${rel}'` +
          src.slice(idx)
      }
    }
    changedFiles++
    if (!DRY) fs.writeFileSync(file, src, 'utf8')
  }
}

console.log(`${DRY ? '[dry] ' : ''}${changedFiles} files, ${changedBlocks} headers rewritten`)
if (skipped.length) {
  console.log('\nSkipped (review by hand):')
  for (const [f, why] of skipped) console.log(`  ${f} — ${why}`)
}
