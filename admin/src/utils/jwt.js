const base64UrlToUtf8 = (value) => {
  if (!value || typeof value !== 'string') return null

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

  try {
    // Browser
    if (typeof atob === 'function') {
      const binary = atob(padded)
      if (typeof TextDecoder === 'function') {
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
        return new TextDecoder().decode(bytes)
      }

      // Fallback for older browsers (JWT payload is typically ASCII/UTF-8 JSON)
      try {
        // eslint-disable-next-line no-undef
        return decodeURIComponent(escape(binary))
      } catch (_) {
        return binary
      }
    }

    // Node / build tools
    // eslint-disable-next-line no-undef
    if (typeof Buffer !== 'undefined') {
      // eslint-disable-next-line no-undef
      return Buffer.from(padded, 'base64').toString('utf8')
    }
  } catch (_) {
    return null
  }

  return null
}

export const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null

  const json = base64UrlToUtf8(parts[1])
  if (!json) return null

  try {
    return JSON.parse(json)
  } catch (_) {
    return null
  }
}

export const getJwtExpirationMs = (token) => {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp !== 'number') return null
  return exp * 1000
}
