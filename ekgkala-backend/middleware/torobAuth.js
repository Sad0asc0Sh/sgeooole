const jwt = require('jsonwebtoken')
const logger = require('../utils/logger')

const getPublicKey = () => (process.env.TOROB_PUBLIC_KEY || '').replace(/\\n/g, '\n')

function torobAuth(req, res, next) {
  const token = req.headers['x-torob-token']
  if (!token) return res.status(401).json({ error: 'X-Torob-Token header is missing' })

  const publicKey = getPublicKey()
  if (!publicKey) return res.status(500).json({ error: 'torob public key is not configured' })

  try {
    req.torob = { payload: jwt.verify(token, publicKey, { algorithms: ['RS256'] }) }
    const expectedVersion = process.env.TOROB_TOKEN_VERSION
    const receivedVersion = req.headers['c-torob-token-version']
    if (expectedVersion && receivedVersion && receivedVersion !== expectedVersion) {
      logger.warn('[TOROB] Token version does not match configured version', { ip: req.ip, receivedVersion })
    }
    return next()
  } catch (_) {
    return res.status(401).json({ error: 'invalid or expired torob token' })
  }
}

module.exports = { torobAuth }
