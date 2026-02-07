/**
 * ============================================
 * SECURITY LOGGING MIDDLEWARE
 * ============================================
 * 
 * SECURITY FEATURES:
 * - [HIGH] Logs all sensitive access attempts
 * - [HIGH] Redacts sensitive data (passwords, tokens, cards)
 * - [MEDIUM] Request fingerprinting for threat detection
 * - [MEDIUM] Audit trail for compliance
 * 
 * OWASP Reference: A09:2021 - Security Logging and Monitoring Failures
 * 
 * USAGE:
 * app.use('/api/auth', securityLogger('auth'))
 * app.use('/api/admin', securityLogger('admin'))
 */

const logger = require('../utils/logger')
const crypto = require('crypto')

/**
 * Fields that should NEVER be logged
 * These are completely removed from log output
 */
const REDACTED_FIELDS = [
    // Authentication
    'password',
    'newPassword',
    'currentPassword',
    'confirmPassword',
    'passwordConfirm',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'otp',
    'pin',
    'verificationCode',

    // Payment
    'cardNumber',
    'cardPan',
    'cvv',
    'cvc',
    'cardHash',
    'accountNumber',
    'shebaNumber',
    'iban',

    // Personal
    'nationalCode',
    'ssn',
    'dateOfBirth',

    // Session
    'cookie',
    'sessionId',
    'jwt',
]

/**
 * Headers that should be redacted
 */
const REDACTED_HEADERS = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
]

/**
 * Deep redact sensitive fields from an object
 * Returns a new object with sensitive fields replaced by [REDACTED]
 */
const deepRedact = (obj, maxDepth = 5) => {
    if (!obj || typeof obj !== 'object' || maxDepth <= 0) {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepRedact(item, maxDepth - 1))
    }

    const redacted = {}

    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase()

        // Check if key should be redacted
        if (REDACTED_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
            redacted[key] = '[REDACTED]'
            continue
        }

        // Recursively redact nested objects
        if (typeof value === 'object' && value !== null) {
            redacted[key] = deepRedact(value, maxDepth - 1)
        } else if (typeof value === 'string') {
            // Redact values that look like tokens (long random strings)
            if (value.length > 50 && /^[A-Za-z0-9._-]+$/.test(value)) {
                redacted[key] = `${value.substring(0, 10)}...[REDACTED]`
            } else {
                redacted[key] = value
            }
        } else {
            redacted[key] = value
        }
    }

    return redacted
}

/**
 * Redact headers
 */
const redactHeaders = (headers) => {
    if (!headers) return {}

    const redacted = {}

    for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase()

        if (REDACTED_HEADERS.includes(lowerKey)) {
            if (typeof value === 'string' && value.length > 10) {
                redacted[key] = `${value.substring(0, 10)}...[REDACTED]`
            } else {
                redacted[key] = '[REDACTED]'
            }
        } else {
            redacted[key] = value
        }
    }

    return redacted
}

/**
 * Generate request fingerprint for threat correlation
 */
const generateFingerprint = (req) => {
    const components = [
        req.ip,
        req.get('user-agent') || '',
        req.get('accept-language') || '',
        req.get('accept-encoding') || '',
    ]

    return crypto
        .createHash('sha256')
        .update(components.join('|'))
        .digest('hex')
        .substring(0, 16)
}

/**
 * Main Security Logger Middleware Factory
 * 
 * @param {string} category - Log category (e.g., 'auth', 'admin', 'payment')
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
const securityLogger = (category = 'general', options = {}) => {
    const {
        logBody = true,
        logHeaders = false,
        logQuery = true,
        logResponse = false,
        sensitiveOperations = [], // Additional operations to always log
    } = options

    return (req, res, next) => {
        const startTime = Date.now()
        const requestId = req.headers['x-request-id'] || crypto.randomUUID()
        const fingerprint = generateFingerprint(req)

        // Attach request ID for correlation
        req.requestId = requestId

        // Build log context
        const logContext = {
            requestId,
            fingerprint,
            category,
            method: req.method,
            path: req.path,
            originalUrl: req.originalUrl,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.user?._id?.toString() || 'anonymous',
            userRole: req.user?.role || 'guest',
        }

        // Add query params (redacted)
        if (logQuery && req.query && Object.keys(req.query).length > 0) {
            logContext.query = deepRedact(req.query)
        }

        // Add body (redacted) - only for non-GET requests
        if (logBody && req.body && Object.keys(req.body).length > 0 && req.method !== 'GET') {
            logContext.body = deepRedact(req.body)
        }

        // Add headers (redacted) - only if explicitly enabled
        if (logHeaders) {
            logContext.headers = redactHeaders(req.headers)
        }

        // Log request (for sensitive categories or operations)
        const isSensitiveOperation = sensitiveOperations.some(op =>
            req.path.includes(op) || req.originalUrl.includes(op)
        )

        const sensitivePaths = ['/login', '/register', '/password', '/admin', '/payment', '/delete']
        const isSensitivePath = sensitivePaths.some(p => req.path.toLowerCase().includes(p))

        if (isSensitiveOperation || isSensitivePath || category === 'auth' || category === 'admin') {
            logger.security(`[REQUEST] ${req.method} ${req.path}`, logContext)
        }

        // Capture response
        if (logResponse) {
            const originalJson = res.json.bind(res)

            res.json = (body) => {
                const duration = Date.now() - startTime

                logger.security(`[RESPONSE] ${req.method} ${req.path}`, {
                    requestId,
                    fingerprint,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    // Only log response success/failure, not full body
                    success: body?.success,
                })

                return originalJson(body)
            }
        }

        // Log failed auth attempts
        res.on('finish', () => {
            const duration = Date.now() - startTime

            // Log authentication failures
            if (res.statusCode === 401 || res.statusCode === 403) {
                logger.security(`[AUTH_FAILURE] ${req.method} ${req.path}`, {
                    requestId,
                    fingerprint,
                    statusCode: res.statusCode,
                    ip: logContext.ip,
                    userId: logContext.userId,
                    duration: `${duration}ms`,
                })
            }

            // Log rate limit hits
            if (res.statusCode === 429) {
                logger.security(`[RATE_LIMITED] ${req.method} ${req.path}`, {
                    requestId,
                    fingerprint,
                    ip: logContext.ip,
                })
            }

            // Log server errors
            if (res.statusCode >= 500) {
                logger.error(`[SERVER_ERROR] ${req.method} ${req.path}`, {
                    requestId,
                    fingerprint,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                })
            }
        })

        next()
    }
}

/**
 * Audit Logger for specific actions
 * Use for logging critical business operations
 * 
 * Usage:
 * auditLog(req, 'ORDER_CREATED', { orderId: order._id, amount: order.total })
 */
const auditLog = (req, action, details = {}) => {
    const logContext = {
        action,
        requestId: req.requestId || crypto.randomUUID(),
        userId: req.user?._id?.toString() || 'system',
        userRole: req.user?.role || 'system',
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get?.('user-agent'),
        timestamp: new Date().toISOString(),
        details: deepRedact(details),
    }

    logger.info(`[AUDIT] ${action}`, logContext)
}

/**
 * Threat Logger for suspicious activity
 * 
 * Usage:
 * threatLog(req, 'BRUTE_FORCE_SUSPECTED', { attempts: 10, timeframe: '5min' })
 */
const threatLog = (req, threatType, details = {}) => {
    const logContext = {
        threatType,
        requestId: req.requestId || crypto.randomUUID(),
        fingerprint: generateFingerprint(req),
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get?.('user-agent'),
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        details: deepRedact(details),
    }

    logger.security(`[THREAT] ${threatType}`, logContext)
}

/**
 * Access Log Middleware
 * Lightweight logging for all requests (not just security-sensitive)
 */
const accessLogger = (req, res, next) => {
    const startTime = Date.now()

    res.on('finish', () => {
        const duration = Date.now() - startTime

        // Only log non-200 responses or slow requests
        if (res.statusCode !== 200 || duration > 1000) {
            logger.info(`[ACCESS] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
                ip: req.ip,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
            })
        }
    })

    next()
}

module.exports = {
    securityLogger,
    auditLog,
    threatLog,
    accessLogger,
    deepRedact,
    generateFingerprint,
    REDACTED_FIELDS,
}
