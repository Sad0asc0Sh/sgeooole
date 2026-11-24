/**
 * ============================================
 * Production-Ready Logger Configuration
 * Uses Winston with environment-aware settings
 * ============================================
 */

const { createLogger, format, transports } = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const path = require('path')
const fs = require('fs')

const isProduction = process.env.NODE_ENV === 'production'

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// ============================================
// SECURITY: Sensitive data patterns to redact
// ============================================
const sensitiveKeys = [
  'password',
  'token',
  'authorization',
  'refreshToken',
  'apiKey',
  'secret',
  'merchantId',
  'merchant_id',
  'cardPan',
  'card_pan',
  'cardHash',
  'card_hash',
  'nationalCode',
  'shebaNumber',
  'otp',
  'pin',
  'cvv',
  'cookie',
  'session',
  'jwt',
  'bearer',
]

const sensitivePatterns = [
  { regex: /bearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: 'Bearer [REDACTED]' },
  { regex: /mongodb(?:\+srv)?:\/\/[^:\s/]+:[^@\s]+@/gi, replacement: 'mongodb://[REDACTED]@' },
  { regex: /\/api\/send\/(?:shared|simple|otp)\/[A-Za-z0-9_-]+/gi, replacement: '/api/send/[REDACTED]' },
  { regex: /\b\d{10}\b/g, replacement: '[REDACTED]' }, // 10-digit national codes
  { regex: /IR\d{24}/g, replacement: '[REDACTED]' }, // IBAN/Sheba numbers
]

const redactString = (value) => {
  if (typeof value !== 'string') return value
  let out = value
  for (const { regex, replacement } of sensitivePatterns) {
    out = out.replace(regex, replacement)
  }
  return out
}

const cloneSafe = (value, seen = new WeakSet(), depth = 0) => {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? redactString(value) : value
  }
  if (depth > 6) return '[MAX_DEPTH]'
  if (seen.has(value)) return '[CIRCULAR]'
  seen.add(value)

  if (Array.isArray(value)) {
    const arr = value.map((item) => cloneSafe(item, seen, depth + 1))
    seen.delete(value)
    return arr
  }

  const out = {}
  for (const key of Object.keys(value)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      out[key] = '[REDACTED]'
      continue
    }
    if (typeof value[key] === 'function') continue
    out[key] = cloneSafe(value[key], seen, depth + 1)
  }
  seen.delete(value)
  return out
}

/**
 * Redact sensitive information from log metadata
 */
const redact = (meta = {}) => {
  if (!meta || typeof meta !== 'object') return meta
  return cloneSafe(meta)
}

// ============================================
// Log Format
// ============================================
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.printf(info => {
    const { timestamp, level, message, stack, ...meta } = info
    const safeMeta = redact(meta)
    const safeMessage = redactString(String(message || ''))
    const safeStack = stack ? redactString(String(stack)) : ''
    const base = `${timestamp} [${level.toUpperCase()}] ${safeMessage}`
    const metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : ''
    return safeStack ? `${base}${metaStr}\n${safeStack}` : `${base}${metaStr}`
  }),
)

// ============================================
// Console Format (colorized for development)
// ============================================
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(info => {
    const { timestamp, level, message } = info
    return `${timestamp} [${level}] ${redactString(String(message || ''))}`
  }),
)

// ============================================
// Determine log level based on environment
// ============================================
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL
  return isProduction ? 'warn' : 'debug'
}

const getConsoleLevel = () => {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL
  // In production, only show warnings and errors in console
  return isProduction ? 'warn' : 'debug'
}

// ============================================
// Create Logger Instance
// ============================================
const logger = createLogger({
  level: getLogLevel(),
  format: logFormat,
  transports: [
    // Console transport (different levels for dev/prod)
    new transports.Console({
      level: getConsoleLevel(),
      format: consoleFormat,
      silent: process.env.LOG_SILENT === 'true', // For testing
    }),

    // All logs (info and above) - rotated daily
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d', // Keep logs for 14 days
      maxSize: '20m', // Max 20MB per file
      level: isProduction ? 'info' : 'debug',
      zippedArchive: true, // Compress old logs
    }),

    // Error logs only - kept longer
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Keep error logs for 30 days
      maxSize: '20m',
      level: 'error',
      zippedArchive: true,
    }),

    // Security/Audit logs - kept longest
    new DailyRotateFile({
      dirname: logDir,
      filename: 'security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d', // Keep security logs for 90 days
      maxSize: '50m',
      level: 'warn',
      zippedArchive: true,
    }),
  ],

  // Don't exit on handled exceptions
  exitOnError: false,
})

// ============================================
// Helper methods for structured logging
// ============================================

/**
 * Log API request (use sparingly in production)
 */
logger.logRequest = (req, message = 'API Request') => {
  if (isProduction) return // Skip request logging in production

  logger.debug(message, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
}

/**
 * Log security event (always logged)
 */
logger.security = (message, meta = {}) => {
  logger.warn(`[SECURITY] ${message}`, meta)
}

/**
 * Log payment event (sensitive data redacted)
 */
logger.payment = (message, meta = {}) => {
  logger.info(`[PAYMENT] ${message}`, redact(meta))
}

/**
 * Log database operation
 */
logger.db = (message, meta = {}) => {
  if (isProduction && meta.level !== 'error') return
  logger.debug(`[DB] ${message}`, meta)
}

module.exports = logger
