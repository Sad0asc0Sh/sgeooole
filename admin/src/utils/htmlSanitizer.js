import DOMPurify from 'dompurify'

export const sanitizeAdminHtml = (dirtyHtml) => {
  if (dirtyHtml === null || dirtyHtml === undefined) return ''
  return DOMPurify.sanitize(String(dirtyHtml), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'base', 'meta', 'link', 'svg', 'math'],
    FORBID_ATTR: ['srcdoc', 'formaction', 'xlink:href'],
    ALLOW_DATA_ATTR: false,
  })
}

export const toSafeAdminHref = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '#'
  const trimmed = rawUrl.trim()
  if (!trimmed || /[<>"']/.test(trimmed)) return '#'
  const compact = trimmed.replace(/[\u0000-\u0020\s]+/g, '')
  if (/^(javascript|vbscript|data):/i.test(compact)) return '#'
  if (/^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed
  }
  return '#'
}
