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
 * - Max 3 OTP SMS requests per 10 minutes per IP
 * - Max 6 OTP SMS requests per 24 hours per IP
 */
function checkIpRateLimit(ip) {
  const now = Date.now()
  const tenMinutesAgo = now - 10 * 60 * 1000
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

  const history = ipRequestHistory.get(ip) || []

  // Filter requests within windows
  const recent10Min = history.filter(ts => ts > tenMinutesAgo)
  const recent24Hours = history.filter(ts => ts > twentyFourHoursAgo)

  if (recent10Min.length >= 3) {
    return { allowed: false, reason: 'ip_10m_limit', count: recent10Min.length }
  }

  if (recent24Hours.length >= 6) {
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
 * Validate invisible bot telemetry (Honeypot, timing, interaction signals, PoW)
 * MANDATORY: Telemetry payload MUST be provided by real frontend
 */
function inspectBotTelemetry(req) {
  const { hp_field, telemetry } = req.body || {}

  // 1. Honeypot check: If bot filled hidden field, trap it!
  if (hp_field && String(hp_field).trim().length > 0) {
    return { isBot: true, reason: 'honeypot_filled' }
  }

  // 2. MANDATORY CHECK: Direct cURL / Python HTTP requests without telemetry payload are INSTANTLY TRAPPED
  if (!telemetry || typeof telemetry !== 'string' || telemetry.trim().length === 0) {
    return { isBot: true, reason: 'missing_telemetry_payload' }
  }

  let data
  try {
    data = JSON.parse(Buffer.from(telemetry, 'base64').toString('utf-8'))
  } catch {
    return { isBot: true, reason: 'invalid_telemetry_encoding' }
  }

  const loadTime = Number(data.loadTime) || 0
  const focusTime = Number(data.focusTime) || 0
  const hasInteraction = Boolean(data.hasInteraction)
  const ts = Number(data.ts) || 0
  const powNonce = data.powNonce

  // Telemetry timestamp age check (token expires in 2 minutes)
  if (!ts || Math.abs(Date.now() - ts) > 120 * 1000) {
    return { isBot: true, reason: 'expired_telemetry_timestamp' }
  }

  // Mandatory user interaction signal check
  if (!hasInteraction) {
    return { isBot: true, reason: 'no_user_interaction' }
  }

  // Form submitted faster than 1200ms after page load -> bot behavior
  if (loadTime < 1200) {
    return { isBot: true, reason: 'too_fast_submit', loadTime }
  }

  // Focus to submit duration check
  if (focusTime > 0 && focusTime < 200) {
    return { isBot: true, reason: 'scripted_focus' }
  }

  // Verify Proof of Work challenge
  if (!verifyPoW(loadTime, ts, powNonce)) {
    return { isBot: true, reason: 'failed_pow_challenge' }
  }

  return { isBot: false }
}

module.exports = {
  checkIpRateLimit,
  recordIpRequest,
  inspectBotTelemetry,
}
