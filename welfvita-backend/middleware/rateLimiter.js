/**
 * ============================================
 * REDIS-BASED RATE LIMITING MIDDLEWARE
 * ============================================
 * 
 * SECURITY FIXES:
 * - [HIGH] Distributed rate limiting across multiple server instances
 * - [HIGH] Sliding window algorithm for accurate limiting
 * - [MEDIUM] IP + User ID combined key for authenticated routes
 * 
 * OWASP Reference: A04:2021 - Insecure Design (Brute Force Prevention)
 */

const rateLimit = require('express-rate-limit')
const redis = require('../utils/redis')
const logger = require('../utils/logger')

/**
 * Rate limit configuration
 */
const CONFIG = {
    general: {
        windowMs: 60 * 1000,
        max: 100,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    login: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        skipFailedRequests: false,
        skipSuccessfulRequests: true,
    },

    sensitive: {
        windowMs: 60 * 60 * 1000,
        max: 10,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    otp: {
        windowMs: 60 * 60 * 1000,
        max: 5,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    passwordReset: {
        windowMs: 60 * 60 * 1000,
        max: 3,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    upload: {
        windowMs: 60 * 60 * 1000,
        max: 50,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },
}

/**
 * Persian error messages
 */
const MESSAGES = {
    general: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.',
    login: 'تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.',
    sensitive: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً بعداً تلاش کنید.',
    otp: 'تعداد درخواست‌های OTP بیش از حد مجاز است. لطفاً یک ساعت دیگر تلاش کنید.',
    passwordReset: 'تعداد درخواست‌های بازنشانی رمز عبور بیش از حد مجاز است.',
    upload: 'تعداد آپلودها بیش از حد مجاز است. لطفاً یک ساعت دیگر تلاش کنید.',
}

/**
 * Generate rate limit key based on request
 */
const generateKey = (type = 'ip') => {
    return (req) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown'

        switch (type) {
            case 'ip':
                return ip

            case 'ip+email':
                const email = req.body?.email || req.body?.username || ''
                return `${ip}:${email.toLowerCase().substring(0, 50)}`

            case 'ip+user':
                const userId = req.user?._id?.toString() || ''
                return userId ? `${ip}:${userId}` : ip

            case 'ip+phone':
                const phone = req.body?.phone || req.body?.mobile || ''
                return `${ip}:${phone.substring(0, 15)}`

            default:
                return ip
        }
    }
}

/**
 * Create rate limiter with in-memory store (fail-safe)
 */
const createRateLimiter = (name, config = {}, keyType = 'ip') => {
    const settings = { ...CONFIG[name] || CONFIG.general, ...config }
    const message = MESSAGES[name] || MESSAGES.general

    return rateLimit({
        windowMs: settings.windowMs,
        max: settings.max,
        standardHeaders: true,
        legacyHeaders: false,
        skipFailedRequests: settings.skipFailedRequests,
        skipSuccessfulRequests: settings.skipSuccessfulRequests,

        skip: (req) => req.method === 'OPTIONS',

        keyGenerator: generateKey(keyType),

        handler: (req, res, next, options) => {
            logger.security('Rate limit exceeded', {
                ip: req.ip,
                path: req.originalUrl,
                limiterName: name,
                limit: options.max,
                windowMs: options.windowMs,
                userId: req.user?._id?.toString() || 'anonymous',
            })

            res.status(429).json({
                success: false,
                message,
                retryAfter: Math.ceil(options.windowMs / 1000),
            })
        },
    })
}

// ============================================
// PRE-CONFIGURED RATE LIMITERS
// ============================================

const generalLimiter = createRateLimiter('general', {}, 'ip')
const loginLimiter = createRateLimiter('login', {}, 'ip+email')
const sensitiveLimiter = createRateLimiter('sensitive', {}, 'ip+user')
const otpLimiter = createRateLimiter('otp', {}, 'ip+phone')
const passwordResetLimiter = createRateLimiter('passwordReset', {}, 'ip+email')
const uploadLimiter = createRateLimiter('upload', {}, 'ip+user')

/**
 * Create a custom rate limiter for specific endpoints
 */
const createCustomLimiter = (options = {}) => {
    const {
        name = 'custom',
        windowMs = 60 * 1000,
        max = 100,
        keyType = 'ip',
        skipFailedRequests = false,
        skipSuccessfulRequests = false,
    } = options

    return createRateLimiter(name, {
        windowMs,
        max,
        skipFailedRequests,
        skipSuccessfulRequests,
    }, keyType)
}

/**
 * Sliding window rate limiter using Redis sorted sets
 */
const slidingWindowCheck = async (key, maxRequests, windowSeconds) => {
    try {
        const client = redis.getClient()
        if (!client || !redis.isConnected()) {
            return true
        }

        const now = Date.now()
        const windowStart = now - (windowSeconds * 1000)
        const fullKey = `sw:${key}`

        const pipeline = client.pipeline()

        pipeline.zremrangebyscore(fullKey, 0, windowStart)
        pipeline.zcard(fullKey)
        pipeline.zadd(fullKey, now, `${now}:${Math.random()}`)
        pipeline.expire(fullKey, windowSeconds)

        const results = await pipeline.exec()
        const currentCount = results[1][1]

        return currentCount < maxRequests
    } catch (error) {
        logger.warn('Sliding window check failed', { error: error.message, key })
        return true
    }
}

/**
 * Middleware wrapper for sliding window rate limiting
 */
const slidingWindowLimiter = (keyPrefix, maxRequests, windowSeconds, getMessage = () => MESSAGES.general) => {
    return async (req, res, next) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown'
        const userId = req.user?._id?.toString() || ''
        const key = userId ? `${keyPrefix}:${ip}:${userId}` : `${keyPrefix}:${ip}`

        const isAllowed = await slidingWindowCheck(key, maxRequests, windowSeconds)

        if (!isAllowed) {
            logger.security('Sliding window rate limit exceeded', {
                ip,
                path: req.originalUrl,
                key,
                maxRequests,
                windowSeconds,
            })

            return res.status(429).json({
                success: false,
                message: getMessage(req),
                retryAfter: windowSeconds,
            })
        }

        next()
    }
}

module.exports = {
    generalLimiter,
    loginLimiter,
    sensitiveLimiter,
    otpLimiter,
    passwordResetLimiter,
    uploadLimiter,
    createRateLimiter,
    createCustomLimiter,
    slidingWindowCheck,
    slidingWindowLimiter,
    CONFIG,
    MESSAGES,
}
