const SAFE_HREF_PROTOCOL_REGEX = /^(https?:|mailto:|tel:|\/(?!\/)|#|\?)/i
const SAFE_DATA_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i
const DANGEROUS_SCHEME_REGEX = /^(javascript|vbscript|data):/i
const CONTROL_AND_SPACE_REGEX = /[\u0000-\u0020\u007f-\u009f\s]+/g
const BENIGN_COMMENT_TEXT_REGEX = /^[ \t\r\nA-Za-z0-9_.:/\-\u0600-\u06FF]{1,120}$/

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
  const cleaned = raw.replace(/url\s*\(([^)]*)\)/gi, (_full, inner) => {
    const innerUnquoted = String(inner || '').trim().replace(/^['"]|['"]$/g, '')
    if (/^(https?:\/\/|\/(?!\/))/i.test(innerUnquoted) && !/[<>]/.test(innerUnquoted)) {
      return `url(${innerUnquoted})`
    }
    return ''
  })
  return cleaned.trim()
}

export const sanitizeAdminHtml = (dirtyHtml) => {
  if (dirtyHtml === null || dirtyHtml === undefined) return ''
  let html = String(dirtyHtml)
  if (!html) return ''

  html = html.replace(/\0/g, '').replace(/<!--([\s\S]*?)-->/g, (_full, inner) => {
    const commentText = String(inner || '')
    if (!/\[if/i.test(commentText) && BENIGN_COMMENT_TEXT_REGEX.test(commentText)) {
      return `<!--${commentText}-->`
    }
    return ''
  })

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

  html = html.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)(\s+[^>]*)?>/g, (full, tagName, attrsRaw) => {
    if (!attrsRaw) return full

    let attrs = attrsRaw
    attrs = attrs.replace(
      /\s+(?:on[a-z0-9_-]+|srcdoc|formaction|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]+)/gi,
      '',
    )
    attrs = attrs.replace(/\s+(?:on[a-z0-9_-]+|srcdoc|formaction|xlink:href)\b(?=\s|$)/gi, '')

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

    attrs = attrs.replace(
      /\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
      (_styleMatch, v1, v2) => {
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

export const sanitizeCaptchaSvg = (rawSvg) => {
  if (typeof rawSvg !== 'string') return ''
  const trimmed = rawSvg.trim()
  if (!/^<svg\b[\s\S]*<\/svg>$/i.test(trimmed)) return ''

  const decoded = decodeHtmlEntitiesForScheme(trimmed)
  if (
    /<\s*(?:script|foreignObject|iframe|object|embed|use|image|feImage|animate|set|a|style|link|meta)\b/i.test(
      trimmed,
    ) ||
    /\bon[a-z0-9_-]+\s*=|(?:javascript|vbscript|data)\s*:|xlink:href/i.test(decoded)
  ) {
    return ''
  }
  return trimmed
}

export const toSafeAdminHref = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '#'
  const trimmed = rawUrl.trim()
  if (!trimmed || /[<>"']/.test(trimmed)) return '#'
  const decoded = decodeHtmlEntitiesForScheme(trimmed)
  const compact = decoded.replace(CONTROL_AND_SPACE_REGEX, '')
  if (DANGEROUS_SCHEME_REGEX.test(compact)) return '#'
  if (SAFE_HREF_PROTOCOL_REGEX.test(trimmed)) {
    return trimmed
  }
  return '#'
}
