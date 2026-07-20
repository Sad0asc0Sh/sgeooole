const crypto = require('crypto')

const getPublicKey = () => (process.env.TOROB_PUBLIC_KEY || '').replace(/\\n/g, '\n')

const decodeBase64Url = (value) => {
  if (typeof value !== 'string' || !value) throw new Error('invalid jwt segment')
  return Buffer.from(value, 'base64url')
}

const parseJsonSegment = (value) => JSON.parse(decodeBase64Url(value).toString('utf8'))

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

  // normalize hostname (www.ekgkala.ir -> ekgkala.ir)
  const normalizedHost = String(reqHostname || '').replace(/^www\./i, '')
  const normalizedAud = String(payload.aud || '').replace(/^www\./i, '')

  console.error("[TOROB DEBUG]", {
    host: reqHostname,
    normalizedHost,
    aud: payload.aud,
    normalizedAud
  });

  if (normalizedAud !== normalizedHost)
    throw new Error('jwt audience mismatch')

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
    console.error('[TOROB AUTH]', err.message)
    return res.status(401).json({ error: 'invalid or expired torob token' })
  }
}

module.exports = { torobAuth, verifyEdDsaJwt }
