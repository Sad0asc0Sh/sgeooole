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
 * Validate invisible bot telemetry (Honeypot, timing, interaction signals)
 */
function inspectBotTelemetry(req) {
  const { hp_field, telemetry } = req.body || {}

  // 1. Honeypot check: If bot filled hidden field, trap it!
  if (hp_field && String(hp_field).trim().length > 0) {
    return { isBot: true, reason: 'honeypot_filled' }
  }

  // 2. Telemetry timing and behavioral signals if present
  if (telemetry) {
    let data = telemetry
    if (typeof telemetry === 'string') {
      try {
        data = JSON.parse(Buffer.from(telemetry, 'base64').toString('utf-8'))
      } catch {
        // Bad telemetry encoding -> suspect
        return { isBot: true, reason: 'invalid_telemetry_encoding' }
      }
    }

    const loadTime = Number(data.loadTime) || 0
    const focusTime = Number(data.focusTime) || 0
    const hasInteraction = Boolean(data.hasInteraction)

    // Form submitted faster than 1200ms after page load -> clear bot behavior
    if (loadTime > 0 && loadTime < 1200) {
      return { isBot: true, reason: 'too_fast_submit', loadTime }
    }

    // Form submitted without user ever focusing or interacting with input
    if (!hasInteraction && loadTime > 0) {
      return { isBot: true, reason: 'no_user_interaction' }
    }

    // Focus to submit in less than 200ms -> scripted automated input
    if (focusTime > 0 && focusTime < 200) {
      return { isBot: true, reason: 'scripted_focus' }
    }
  }

  return { isBot: false }
}

module.exports = {
  checkIpRateLimit,
  recordIpRequest,
  inspectBotTelemetry,
}
