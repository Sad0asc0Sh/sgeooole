const crypto = require('crypto')
const { getClientIp } = require('../utils/clientIp')
const logger = require('../utils/logger')

// In-memory IP tracking store for sliding window rate limiting
// Structure: Map<ip, Array<{ timestamp: number }>>
const ipRequestHistory = new Map()

// Clean up old IP history records every 15 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  for (const [ip, timestamps] of ipRequestHistory.entries()) {
    const valid = timestamps.filter(ts => ts > oneDayAgo)
    if (valid.length === 0) {
      ipRequestHistory.delete(ip)
    } else {
      ipRequestHistory.set(ip, valid)
    }
  }
}, 15 * 60 * 1000)

if (cleanupTimer && cleanupTimer.unref) {
  cleanupTimer.unref()
}

/**
 * Check if the request hits IP-level rate limits:
 * - Max 10 OTP SMS requests per 10 minutes per IP
 * - Max 30 OTP SMS requests per 24 hours per IP
 */
function checkIpRateLimit(ip) {
  const now = Date.now()
  const tenMinutesAgo = now - 10 * 60 * 1000
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

  const history = ipRequestHistory.get(ip) || []

  // Filter requests within windows
  const recent10Min = history.filter(ts => ts > tenMinutesAgo)
  const recent24Hours = history.filter(ts => ts > twentyFourHoursAgo)

  if (recent10Min.length >= 10) {
    return { allowed: false, reason: 'ip_10m_limit', count: recent10Min.length }
  }

  if (recent24Hours.length >= 30) {
    return { allowed: false, reason: 'ip_24h_limit', count: recent24Hours.length }
  }

  return { allowed: true }
}

/**
 * Record a valid OTP SMS request attempt for this IP
 */
function recordIpRequest(ip) {
  const now = Date.now()
  const history = ipRequestHistory.get(ip) || []
  history.push(now)
  ipRequestHistory.set(ip, history)
}

/**
 * Verify Proof of Work Nonce
 */
function verifyPoW(loadTime, ts, powNonce) {
  if (!powNonce || !ts) return false
  const input = `ekgkala_pow_${loadTime}_${ts}_${powNonce}`
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  return hash.startsWith('00')
}

/**
 * Validate invisible bot telemetry (Honeypot & timing signals)
 * Safe for real users on any browser/device
 */
function inspectBotTelemetry(req) {
  const { hp_field, telemetry } = req.body || {}

  // 1. Honeypot check: If hidden field is filled, trap it as bot
  if (hp_field && String(hp_field).trim().length > 0) {
    return { isBot: true, reason: 'honeypot_filled' }
  }

  // 2. If telemetry payload is provided, inspect timing
  if (telemetry && typeof telemetry === 'string' && telemetry.trim().length > 0) {
    try {
      const data = JSON.parse(Buffer.from(telemetry, 'base64').toString('utf-8'))
      const loadTime = Number(data.loadTime) || 0
      const ts = Number(data.ts) || 0

      // Form submitted faster than 200ms after page load -> clear automated bot
      if (loadTime > 0 && loadTime < 200) {
        return { isBot: true, reason: 'too_fast_submit', loadTime }
      }

      // Telemetry timestamp age check (older than 10 minutes)
      if (ts > 0 && Math.abs(Date.now() - ts) > 600 * 1000) {
        return { isBot: true, reason: 'expired_telemetry_timestamp' }
      }
    } catch {
      // Ignore telemetry parsing errors for real user compatibility
    }
  }

  return { isBot: false }
}

module.exports = {
  checkIpRateLimit,
  recordIpRequest,
  inspectBotTelemetry,
}
