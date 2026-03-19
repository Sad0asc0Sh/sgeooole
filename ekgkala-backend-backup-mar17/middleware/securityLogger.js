/**
 * ============================================
 * SECURITY LOGGING MIDDLEWARE
 * ============================================
 * 
 * SECURITY FEATURES:
 * - [HIGH] Logs all sensitive access attempts
 * - [HIGH] Redacts sensitive data (passwords, tokens, cards)
 * - [MEDIUM] Request fingerprinting for threat detection
 * 
 * OWASP Reference: A09:2021 - Security Logging and Monitoring Failures
 */

const logger = require('../utils/logger')
const crypto = require('crypto')

/**
 * Fields that should NEVER be logged
 */
const REDACTED_FIELDS = [
    'password', 'newPassword', 'currentPassword', 'confirmPassword',
    'token', 'accessToken', 'refreshToken', 'apiKey', 'secret',
    'otp', 'pin', 'verificationCode',
    'cardNumber', 'cardPan', 'cvv', 'cvc', 'cardHash',
    'accountNumber', 'shebaNumber', 'iban',
    'nationalCode', 'ssn', 'dateOfBirth',
    'cookie', 'sessionId', 'jwt',
]

/**
 * Headers that should be redacted
 */
const REDACTED_HEADERS = [
    'authorization', 'cookie', 'x-api-key', 'x-auth-token',
]

/**
 * Deep redact sensitive fields from an object
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

        if (REDACTED_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
            redacted[key] = '[REDACTED]'
            continue
        }

        if (typeof value === 'object' && value !== null) {
            redacted[key] = deepRedact(value, maxDepth - 1)
        } else if (typeof value === 'string') {
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
 */
const securityLogger = (category = 'general', options = {}) => {
    const {
        logBody = true,
        logHeaders = false,
        logQuery = true,
        logResponse = false,
        sensitiveOperations = [],
    } = options

    return (req, res, next) => {
        const startTime = Date.now()
        const requestId = req.headers['x-request-id'] || crypto.randomUUID()
        const fingerprint = generateFingerprint(req)

        req.requestId = requestId

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

        if (logQuery && req.query && Object.keys(req.query).length > 0) {
            logContext.query = deepRedact(req.query)
        }

        if (logBody && req.body && Object.keys(req.body).length > 0 && req.method !== 'GET') {
            logContext.body = deepRedact(req.body)
        }

        if (logHeaders) {
            logContext.headers = redactHeaders(req.headers)
        }

        const isSensitiveOperation = sensitiveOperations.some(op =>
            req.path.includes(op) || req.originalUrl.includes(op)
        )

        const sensitivePaths = ['/login', '/register', '/password', '/admin', '/payment', '/delete']
        const isSensitivePath = sensitivePaths.some(p => req.path.toLowerCase().includes(p))

        if (isSensitiveOperation || isSensitivePath || category === 'auth' || category === 'admin') {
            logger.security(`[REQUEST] ${req.method} ${req.path}`, logContext)
        }

        res.on('finish', () => {
            const duration = Date.now() - startTime

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

            if (res.statusCode === 429) {
                logger.security(`[RATE_LIMITED] ${req.method} ${req.path}`, {
                    requestId,
                    fingerprint,
                    ip: logContext.ip,
                })
            }

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
 */
const accessLogger = (req, res, next) => {
    const startTime = Date.now()

    res.on('finish', () => {
        const duration = Date.now() - startTime

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
