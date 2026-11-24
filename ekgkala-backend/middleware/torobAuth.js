const crypto = require('crypto')

const getPublicKey = () => (process.env.TOROB_PUBLIC_KEY || '').replace(/\\n/g, '\n')

const decodeBase64Url = (value) => {
  if (typeof value !== 'string' || !value) throw new Error('invalid jwt segment')
  return Buffer.from(value, 'base64url')
}

const parseJsonSegment = (value) => JSON.parse(decodeBase64Url(value).toString('utf8'))

const getExpectedTorobHost = () => {
  const raw = process.env.TOROB_EXPECTED_HOST || process.env.FRONTEND_URL || process.env.BASE_URL || ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  try {
    const host = trimmed.includes('://') ? new URL(trimmed).hostname : trimmed.split('/')[0]
    return host.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

const verifyEdDsaJwt = (token, publicKeyPem, reqHostname) => {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw new Error('invalid jwt format')

  const [encodedHeader, encodedPayload, encodedSignature] = parts

  const header = parseJsonSegment(encodedHeader)
  if (header.alg !== 'EdDSA') throw new Error('invalid jwt algorithm')

  const publicKey = crypto.createPublicKey(publicKeyPem)

  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`)
  const signature = decodeBase64Url(encodedSignature)

  const validSignature = crypto.verify(
    null,
    signingInput,
    publicKey,
    signature
  )

  if (!validSignature) throw new Error('invalid jwt signature')

  const payload = parseJsonSegment(encodedPayload)

  const now = Math.floor(Date.now() / 1000)

  if (!Number.isFinite(payload.exp) || now > Number(payload.exp))
    throw new Error('jwt expired')

  if (!Number.isFinite(payload.nbf) || now < Number(payload.nbf))
    throw new Error('jwt not active')

  // Verify audience against server-configured canonical domain (never trust Host header in production)
  const expectedHost = getExpectedTorobHost()
  const normalizedHost = String(reqHostname || '').trim().toLowerCase().replace(/^www\./, '')
  const normalizedAud = String(payload.aud || '').trim().toLowerCase().replace(/^www\./, '')

  if (!normalizedAud) {
    throw new Error('jwt audience missing')
  }

  if (process.env.NODE_ENV === 'production') {
    if (!expectedHost) {
      throw new Error('torob expected host not configured')
    }
    if (normalizedAud !== expectedHost) {
      throw new Error('jwt audience mismatch')
    }
  } else {
    const isLocalLoopback =
      (normalizedAud === '127.0.0.1' || normalizedAud === 'localhost') &&
      (normalizedHost === '127.0.0.1' || normalizedHost === 'localhost')
    const matchesConfigured = expectedHost ? normalizedAud === expectedHost : normalizedAud === normalizedHost
    if (!matchesConfigured && !isLocalLoopback) {
      throw new Error('jwt audience mismatch')
    }
  }

  return payload
}

function torobAuth(req, res, next) {
  const token = req.headers['x-torob-token']
  const tokenVersion = req.headers['x-torob-token-version']

  if (!token) {
    return res.status(401).json({ error: 'X-Torob-Token header is missing' })
  }

  const publicKey = getPublicKey()

  if (!publicKey) {
    return res.status(500).json({ error: 'torob public key is not configured' })
  }

  try {
    const payload = verifyEdDsaJwt(token, publicKey, req.hostname)
    req.torob = { payload, tokenVersion }
    return next()
  } catch (err) {
    console.error("[TOROB AUTH]", err);
    return res.status(401).json({ error: 'invalid or expired torob token' })
  }
}

module.exports = { torobAuth, verifyEdDsaJwt }
