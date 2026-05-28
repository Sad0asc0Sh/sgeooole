/**
 * Normalize client IP for rate limiting and logging.
 * Mitigates IPv4-mapped IPv6 bypass (e.g. ::ffff:203.0.113.1 -> 203.0.113.1).
 */
function normalizeClientIp(raw) {
  if (!raw || typeof raw !== 'string') return 'unknown'

  let ip = raw.trim()
  if (!ip) return 'unknown'

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7)
  }

  return ip
}

function getClientIp(req) {
  if (!req) return 'unknown'
  return normalizeClientIp(req.ip || req.socket?.remoteAddress)
}

module.exports = {
  normalizeClientIp,
  getClientIp,
}
