const mongoose = require('mongoose')
const BlockedIP = require('../models/BlockedIP')
const { getClientIp } = require('../utils/clientIp')
const { logger } = require('../utils/logger')

// Short in-memory cache for blocked IPs to prevent DB overhead on every request
const blockedCache = new Map() // ip -> expireTime
const memoryFailureCounts = new Map() // ip -> { count, resetAt }

const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [ip, expireTime] of blockedCache.entries()) {
    if (now > expireTime) blockedCache.delete(ip)
  }
  for (const [ip, data] of memoryFailureCounts.entries()) {
    if (now > data.resetAt) memoryFailureCounts.delete(ip)
  }
}, 60 * 1000)
if (cleanupInterval.unref) cleanupInterval.unref()

/**
 * Middleware to reject requests from blocked IPs
 */
async function checkIpBlocklist(req, res, next) {
  const ip = getClientIp(req)
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
    return next()
  }

  const now = Date.now()
  const cachedExpire = blockedCache.get(ip)
  if (cachedExpire && cachedExpire > now) {
    return res.status(403).json({
      success: false,
      message: 'دسترسی این IP به دلیل فعالیت مشکوک موقتاً مسدود شده است.',
      code: 'IP_BLOCKED',
    })
  }

  // Fail-open: If Mongoose connection is not ready, do not block request
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return next()
  }

  try {
    const blocked = await BlockedIP.findOne({ ip }).maxTimeMS(1000).lean()
    if (blocked && blocked.expiresAt > new Date()) {
      blockedCache.set(ip, blocked.expiresAt.getTime())
      return res.status(403).json({
        success: false,
        message: 'دسترسی این IP به دلیل فعالیت مشکوک موقتاً مسدود شده است.',
        code: 'IP_BLOCKED',
      })
    }
  } catch (err) {
    // If DB query fails or times out, fail open
  }

  next()
}

/**
 * Record a suspicious activity/failure for an IP (e.g. invalid captcha, rate limit exceeded)
 */
async function recordIpFailure(ip, reason = 'Repeated security failure', threshold = 5, blockDurationSec = 3600) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return

  const now = Date.now()
  let data = memoryFailureCounts.get(ip)
  if (!data || now > data.resetAt) {
    data = { count: 1, resetAt: now + 10 * 60 * 1000 } // 10-min window
  } else {
    data.count += 1
  }
  memoryFailureCounts.set(ip, data)

  if (data.count >= threshold) {
    const expiresAt = new Date(now + blockDurationSec * 1000)
    blockedCache.set(ip, expiresAt.getTime())

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await BlockedIP.findOneAndUpdate(
          { ip },
          {
            ip,
            reason,
            failedCount: data.count,
            expiresAt,
          },
          { upsert: true, new: true }
        )
        if (logger && logger.warn) {
          logger.warn(`[SECURITY ALERT] IP ${ip} automatically blocked for ${blockDurationSec}s. Reason: ${reason}`)
        } else {
          console.warn(`[SECURITY ALERT] IP ${ip} automatically blocked for ${blockDurationSec}s. Reason: ${reason}`)
        }
      } catch (err) {
        console.error('Failed to block IP in DB:', err)
      }
    }
  }
}

module.exports = {
  checkIpBlocklist,
  recordIpFailure,
}
