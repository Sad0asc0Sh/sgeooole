/**
 * ============================================
 * NOSQL INJECTION PREVENTION MIDDLEWARE
 * ============================================
 * 
 * SECURITY FIXES:
 * - [HIGH] Prevents NoSQL Injection attacks
 * - [HIGH] Sanitizes $-prefixed operators from user input
 * - [HIGH] Blocks dangerous operators like $where, $expr
 * 
 * OWASP Reference: A03:2021 - Injection
 */

const logger = require('../utils/logger')

/**
 * Dangerous MongoDB operators that should NEVER be in user input
 */
const DANGEROUS_OPERATORS = [
    '$gt', '$gte', '$lt', '$lte', '$ne', '$nin', '$in',
    '$and', '$or', '$not', '$nor',
    '$exists', '$type',
    '$expr', '$jsonSchema', '$mod', '$regex', '$text', '$where',
    '$all', '$elemMatch', '$size',
    '$set', '$unset', '$inc', '$push', '$pull', '$addToSet',
    '$match', '$group', '$project', '$lookup',
]

/**
 * Check if a value contains dangerous operators
 */
const containsDangerousOperator = (value, path = '') => {
    if (typeof value === 'string') {
        if (value.startsWith('$')) {
            return { found: true, operator: value, path }
        }
        return { found: false }
    }

    if (typeof value !== 'object' || value === null) {
        return { found: false }
    }

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const result = containsDangerousOperator(value[i], `${path}[${i}]`)
            if (result.found) return result
        }
        return { found: false }
    }

    for (const [key, val] of Object.entries(value)) {
        if (key.startsWith('$')) {
            return { found: true, operator: key, path: path ? `${path}.${key}` : key }
        }

        const result = containsDangerousOperator(val, path ? `${path}.${key}` : key)
        if (result.found) return result
    }

    return { found: false }
}

/**
 * Deep sanitize an object by removing all $-prefixed keys
 */
const deepSanitize = (obj, path = '', maxDepth = 10) => {
    if (maxDepth <= 0) {
        logger.security('Max sanitization depth reached', { path })
        return {}
    }

    if (typeof obj !== 'object' || obj === null) {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map((item, index) =>
            deepSanitize(item, `${path}[${index}]`, maxDepth - 1)
        )
    }

    const sanitized = {}

    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) {
            logger.security('Removed dangerous operator from input', {
                path: path ? `${path}.${key}` : key,
                operator: key,
            })
            continue
        }

        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            logger.security('Prototype pollution attempt blocked', {
                path: path ? `${path}.${key}` : key,
            })
            continue
        }

        sanitized[key] = deepSanitize(value, path ? `${path}.${key}` : key, maxDepth - 1)
    }

    return sanitized
}

/**
 * Main NoSQL Injection Prevention Middleware
 */
const noSqlInjectionPrevention = (options = {}) => {
    const {
        logAttempts = true,
        blockOnDetection = true,
        allowedOperators = [],
    } = options

    return (req, res, next) => {
        const sources = ['body', 'query', 'params']
        let injectionDetected = false
        const detectedOperators = []

        for (const source of sources) {
            if (!req[source] || typeof req[source] !== 'object') continue

            const result = containsDangerousOperator(req[source])

            if (result.found) {
                if (allowedOperators.includes(result.operator)) {
                    continue
                }

                injectionDetected = true
                detectedOperators.push({
                    source,
                    operator: result.operator,
                    path: result.path,
                })

                req[source] = deepSanitize(req[source])
            }
        }

        if (injectionDetected) {
            if (logAttempts) {
                logger.security('NoSQL injection attempt detected', {
                    ip: req.ip,
                    method: req.method,
                    path: req.originalUrl,
                    userAgent: req.get('user-agent'),
                    userId: req.user?._id?.toString() || 'anonymous',
                    detectedOperators,
                })
            }

            if (blockOnDetection) {
                return res.status(400).json({
                    success: false,
                    message: 'درخواست نامعتبر است',
                })
            }
        }

        next()
    }
}

/**
 * Sanitize MongoDB Query Helper
 */
const sanitizeMongoQuery = (input, allowedFields = []) => {
    if (typeof input !== 'object' || input === null) {
        return {}
    }

    const sanitized = {}

    for (const field of allowedFields) {
        if (input[field] !== undefined) {
            const value = input[field]

            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                sanitized[field] = value
            }
        }
    }

    return sanitized
}

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
    if (!id) return false
    return /^[a-fA-F0-9]{24}$/.test(id)
}

/**
 * Middleware: Validate ObjectId Parameter
 */
const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName]

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'شناسه نامعتبر است',
            })
        }

        next()
    }
}

/**
 * Create safe regex pattern from user input
 */
const createSafeRegex = (input, flags = 'i') => {
    if (typeof input !== 'string') return null

    const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const truncated = escaped.slice(0, 100)

    try {
        return new RegExp(truncated, flags)
    } catch (e) {
        return null
    }
}

module.exports = {
    noSqlInjectionPrevention,
    deepSanitize,
    containsDangerousOperator,
    sanitizeMongoQuery,
    isValidObjectId,
    validateObjectId,
    createSafeRegex,
    DANGEROUS_OPERATORS,
}
