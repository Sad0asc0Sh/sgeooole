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
  /bearer\s+[\w-]+/gi, // Bearer tokens
  /\b\d{10}\b/g, // 10-digit national codes (keep first 3)
  /IR\d{24}/g, // IBAN/Sheba numbers
]

/**
 * Redact sensitive information from log metadata
 */
const redact = (meta = {}) => {
  if (!meta || typeof meta !== 'object') return meta

  const clone = JSON.parse(JSON.stringify(meta))

  const redactObject = (obj, depth = 0) => {
    if (depth > 5 || !obj || typeof obj !== 'object') return

    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase()

      // Check if key matches sensitive patterns
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        obj[key] = '[REDACTED]'
        continue
      }

      // Recursively check nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        redactObject(obj[key], depth + 1)
      }

      // Redact sensitive patterns in string values
      if (typeof obj[key] === 'string') {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(obj[key])) {
            obj[key] = obj[key].replace(pattern, '[REDACTED]')
          }
        }
      }
    }
  }

  redactObject(clone)
  return clone
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
    const base = `${timestamp} [${level.toUpperCase()}] ${message}`
    const metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : ''
    return stack ? `${base}${metaStr}\n${stack}` : `${base}${metaStr}`
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
    return `${timestamp} [${level}] ${message}`
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
