/**
 * ============================================
 * NOSQL INJECTION PREVENTION MIDDLEWARE
 * ============================================
 * 
 * SECURITY FIXES:
 * - [HIGH] Prevents NoSQL Injection attacks
 * - [HIGH] Sanitizes $-prefixed operators from user input
 * - [HIGH] Blocks dangerous operators like $where, $expr
 * - [MEDIUM] Type coercion protection
 * 
 * OWASP Reference: A03:2021 - Injection
 * 
 * ATTACK VECTORS BLOCKED:
 * 1. Query selector injection: {"$gt": ""} always returns true
 * 2. JavaScript injection: {"$where": "this.password.match(/^a/)"} 
 * 3. Regex DoS: {"$regex": "^(a+)+$"} can cause ReDoS
 * 4. Type coercion: Passing objects instead of strings
 */

const logger = require('../utils/logger')

/**
 * Dangerous MongoDB operators that should NEVER be in user input
 * These can be used for injection attacks
 */
const DANGEROUS_OPERATORS = [
    // Comparison operators (can be used for blind injection)
    '$gt', '$gte', '$lt', '$lte', '$ne', '$nin', '$in',

    // Logical operators
    '$and', '$or', '$not', '$nor',

    // Element operators
    '$exists', '$type',

    // Evaluation operators (VERY DANGEROUS)
    '$expr', '$jsonSchema', '$mod', '$regex', '$text', '$where',

    // Array operators
    '$all', '$elemMatch', '$size',

    // Update operators (should not be in queries)
    '$set', '$unset', '$inc', '$push', '$pull', '$addToSet',

    // Aggregation operators
    '$match', '$group', '$project', '$lookup',
]

/**
 * Check if a value contains dangerous operators
 */
const containsDangerousOperator = (value, path = '') => {
    if (typeof value === 'string') {
        // Check if string starts with $ (potential operator in string form)
        if (value.startsWith('$')) {
            return { found: true, operator: value, path }
        }
        return { found: false }
    }

    if (typeof value !== 'object' || value === null) {
        return { found: false }
    }

    // Check arrays
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const result = containsDangerousOperator(value[i], `${path}[${i}]`)
            if (result.found) return result
        }
        return { found: false }
    }

    // Check objects
    for (const [key, val] of Object.entries(value)) {
        // Check if key is a dangerous operator
        if (key.startsWith('$')) {
            return { found: true, operator: key, path: path ? `${path}.${key}` : key }
        }

        // Recursively check nested values
        const result = containsDangerousOperator(val, path ? `${path}.${key}` : key)
        if (result.found) return result
    }

    return { found: false }
}

/**
 * Deep sanitize an object by removing all $-prefixed keys
 * Returns a new sanitized object (does not mutate original)
 */
const deepSanitize = (obj, path = '', maxDepth = 10) => {
    if (maxDepth <= 0) {
        logger.security('Max sanitization depth reached', { path })
        return {} // Return empty object to prevent DoS via deep nesting
    }

    if (typeof obj !== 'object' || obj === null) {
        return obj
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map((item, index) =>
            deepSanitize(item, `${path}[${index}]`, maxDepth - 1)
        )
    }

    // Handle objects
    const sanitized = {}

    for (const [key, value] of Object.entries(obj)) {
        // Skip keys that start with $
        if (key.startsWith('$')) {
            logger.security('Removed dangerous operator from input', {
                path: path ? `${path}.${key}` : key,
                operator: key,
            })
            continue
        }

        // Skip keys that could be used for prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            logger.security('Prototype pollution attempt blocked', {
                path: path ? `${path}.${key}` : key,
            })
            continue
        }

        // Recursively sanitize nested objects
        sanitized[key] = deepSanitize(value, path ? `${path}.${key}` : key, maxDepth - 1)
    }

    return sanitized
}

/**
 * Convert potential injection values to safe strings
 * Prevents type coercion attacks
 */
const coerceToSafeTypes = (obj, schema = {}) => {
    if (typeof obj !== 'object' || obj === null) {
        return obj
    }

    const result = Array.isArray(obj) ? [] : {}

    for (const [key, value] of Object.entries(obj)) {
        const expectedType = schema[key]

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // If we expect a string but got an object, stringify it
            if (expectedType === 'string') {
                result[key] = JSON.stringify(value)
                logger.security('Type coercion prevented', { key, expectedType })
            } else {
                // Recursively process nested objects
                result[key] = coerceToSafeTypes(value, schema[key] || {})
            }
        } else {
            result[key] = value
        }
    }

    return result
}

/**
 * Main NoSQL Injection Prevention Middleware
 * 
 * Sanitizes req.body, req.query, and req.params
 * 
 * Usage: app.use(noSqlInjectionPrevention())
 */
const noSqlInjectionPrevention = (options = {}) => {
    const {
        logAttempts = true,
        blockOnDetection = true, // If true, return 400 on detection. If false, sanitize and continue.
        allowedOperators = [], // Whitelist specific operators if needed
    } = options

    return (req, res, next) => {
        const sources = ['body', 'query', 'params']
        let injectionDetected = false
        const detectedOperators = []

        for (const source of sources) {
            if (!req[source] || typeof req[source] !== 'object') continue

            const result = containsDangerousOperator(req[source])

            if (result.found) {
                // Check if operator is in whitelist
                if (allowedOperators.includes(result.operator)) {
                    continue
                }

                injectionDetected = true
                detectedOperators.push({
                    source,
                    operator: result.operator,
                    path: result.path,
                })

                // Sanitize the input regardless of blockOnDetection setting
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
 * 
 * Use this in controllers before passing user input to MongoDB
 * 
 * Usage:
 * const safeFilter = sanitizeMongoQuery(req.query, ['name', 'category'])
 */
const sanitizeMongoQuery = (input, allowedFields = []) => {
    if (typeof input !== 'object' || input === null) {
        return {}
    }

    const sanitized = {}

    for (const field of allowedFields) {
        if (input[field] !== undefined) {
            const value = input[field]

            // Only allow primitive values and safe patterns
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                sanitized[field] = value
            }
        }
    }

    return sanitized
}

/**
 * Validate MongoDB ObjectId
 * 
 * Use this to validate :id parameters before querying
 */
const isValidObjectId = (id) => {
    if (!id) return false
    // MongoDB ObjectId is 24 hex characters
    return /^[a-fA-F0-9]{24}$/.test(id)
}

/**
 * Middleware: Validate ObjectId Parameter
 * 
 * Usage: router.get('/:id', validateObjectId('id'), getProduct)
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
 * Escapes special regex characters to prevent ReDoS
 */
const createSafeRegex = (input, flags = 'i') => {
    if (typeof input !== 'string') return null

    // Escape all special regex characters
    const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Limit length to prevent DoS
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
    coerceToSafeTypes,
    DANGEROUS_OPERATORS,
}
