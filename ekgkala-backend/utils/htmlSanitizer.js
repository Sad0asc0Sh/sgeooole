const SAFE_HREF_PROTOCOL_REGEX = /^(https?:|mailto:|tel:|\/|#|\?)/i
const SAFE_DATA_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i
const DANGEROUS_SCHEME_REGEX = /^(javascript|vbscript|data):/i
const CONTROL_AND_SPACE_REGEX = /[\u0000-\u0020\u007f-\u009f\s]+/g

const decodeHtmlEntitiesForScheme = (raw) =>
  String(raw || '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      const code = parseInt(dec, 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    })
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')

const escapeHtml = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const isSafeUrlAttribute = (attrName, rawValue) => {
  const decoded = decodeHtmlEntitiesForScheme(rawValue)
  const stripped = decoded.replace(CONTROL_AND_SPACE_REGEX, '').trim()
  if (!stripped) return true
  if (DANGEROUS_SCHEME_REGEX.test(stripped)) {
    if (String(attrName).toLowerCase() === 'src' && SAFE_DATA_IMAGE_REGEX.test(decoded.trim())) {
      return true
    }
    return false
  }
  return SAFE_HREF_PROTOCOL_REGEX.test(stripped) || !stripped.includes(':')
}

const sanitizeInlineStyle = (styleValue) => {
  if (typeof styleValue !== 'string') return ''
  const raw = decodeHtmlEntitiesForScheme(styleValue)
  if (
    /expression\s*\(|javascript\s*:|vbscript\s*:|@import|-moz-binding|behavior\s*:|data\s*:\s*text\/html|data\s*:\s*image\/svg\+xml/i.test(
      raw,
    )
  ) {
    return ''
  }
  // Block url(...) values pointing to non-https/relative resources or data SVG/HTML
  const cleaned = raw.replace(/url\s*\(([^)]*)\)/gi, (full, inner) => {
    const innerUnquoted = String(inner || '').trim().replace(/^['"]|['"]$/g, '')
    if (/^(https?:\/\/|\/)/i.test(innerUnquoted) && !/[<>]/.test(innerUnquoted)) {
      return `url(${innerUnquoted})`
    }
    return ''
  })
  return cleaned.trim()
}

const BLOCKED_PAIR_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'svg',
  'math',
  'style',
  'form',
  'textarea',
  'select',
  'button',
  'noscript',
  'template',
]

const BLOCKED_VOID_TAGS = ['input', 'base', 'meta', 'link', 'param', 'source']

/**
 * Sanitize admin-authored rich HTML while preserving safe structural tags and
 * benign inline styles (`background`, `border-radius`, `direction`, `margin`, `width`, etc.).
 */
const sanitizeHtmlContent = (input) => {
  if (input === null || input === undefined) return ''
  let html = String(input)
  if (!html) return ''

  // Strip null bytes & HTML comments (can conceal broken tag boundaries in parsers)
  html = html.replace(/\0/g, '').replace(/<!--[\s\S]*?-->/g, '')

  // Repeatedly strip paired dangerous elements (catches nested payloads like <scr<script>ipt>)
  for (let pass = 0; pass < 3; pass += 1) {
    const prev = html
    for (const tag of BLOCKED_PAIR_TAGS) {
      const pairRegex = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi')
      const unclosedRegex = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*$`, 'gi')
      const closingRegex = new RegExp(`<\\s*\\/\\s*${tag}\\b[^>]*>`, 'gi')
      html = html.replace(pairRegex, '').replace(unclosedRegex, '').replace(closingRegex, '')
    }
    for (const tag of BLOCKED_VOID_TAGS) {
      const voidRegex = new RegExp(`<\\s*\\/?\\s*${tag}\\b[^>]*>`, 'gi')
      html = html.replace(voidRegex, '')
    }
    if (html === prev) break
  }

  // Strip event handlers & unsafe URL/style attributes inside remaining tags
  html = html.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)(\s+[^>]*)?>/g, (full, tagName, attrsRaw) => {
    if (!attrsRaw) return full

    let attrs = attrsRaw
    // Strip all on* event attributes, srcdoc, formaction, xlink:href
    attrs = attrs.replace(
      /\s+(?:on[a-z0-9_-]+|srcdoc|formaction|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]+)/gi,
      '',
    )
    attrs = attrs.replace(/\s+(?:on[a-z0-9_-]+|srcdoc|formaction)\b(?=\s|$)/gi, '')

    // Filter URL attributes
    attrs = attrs.replace(
      /\s+(href|src|action|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s>]+))/gi,
      (attrMatch, attrName, v1, v2, v3, v4) => {
        const val = v1 ?? v2 ?? v3 ?? v4 ?? ''
        if (!isSafeUrlAttribute(attrName, val)) {
          return ''
        }
        return attrMatch
      },
    )

    // Filter inline styles
    attrs = attrs.replace(
      /\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
      (styleMatch, v1, v2) => {
        const quote = v1 !== undefined ? '"' : "'"
        const val = v1 ?? v2 ?? ''
        const safeStyle = sanitizeInlineStyle(val)
        if (!safeStyle) return ''
        return ` style=${quote}${safeStyle}${quote}`
      },
    )

    return `<${tagName}${attrs}>`
  })

  return html
}

/**
 * Neutralize spreadsheet CSV formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
 * and properly quote CSV fields.
 */
const sanitizeCsvCell = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  const str = String(value ?? '')
  const neutralized =
    /^[\t\r\n ]*[=+\-@]/.test(str) || /^[\t\r]/.test(str)
      ? `'${str}`
      : str

  if (/[",\r\n]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`
  }
  return neutralized
}

module.exports = {
  escapeHtml,
  sanitizeHtmlContent,
  sanitizeCsvCell,
}
