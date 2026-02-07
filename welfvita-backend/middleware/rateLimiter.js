/**
 * ============================================
 * REDIS-BASED RATE LIMITING MIDDLEWARE
 * ============================================
 * 
 * SECURITY FIXES:
 * - [HIGH] Distributed rate limiting across multiple server instances
 * - [HIGH] Sliding window algorithm for accurate limiting
 * - [MEDIUM] IP + User ID combined key for authenticated routes
 * - [MEDIUM] Customizable limits per endpoint type
 * 
 * OWASP Reference: A04:2021 - Insecure Design (Brute Force Prevention)
 * 
 * ARCHITECTURE:
 * This module provides three types of rate limiters:
 * 1. generalLimiter - For public API endpoints (100 req/min)
 * 2. loginLimiter - Strict for auth endpoints (5 req/15min)
 * 3. sensitiveLimiter - For high-risk operations (10 req/hour)
 * 
 * FAIL-SAFE: If Redis is unavailable, falls back to in-memory limiting
 */

const rateLimit = require('express-rate-limit')
const RedisStore = require('rate-limit-redis').default
const redis = require('../utils/redis')
const logger = require('../utils/logger')

/**
 * Rate limit configuration
 */
const CONFIG = {
    general: {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 login attempts per 15 minutes
        skipFailedRequests: false,
        skipSuccessfulRequests: true, // Don't count successful logins
    },

    sensitive: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 requests per hour
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    otp: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5, // 5 OTP requests per hour
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 password reset attempts per hour
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
    },

    upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 uploads per hour
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
 * Supports IP-based and IP+UserID based limiting
 */
const generateKey = (type = 'ip') => {
    return (req) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown'

        switch (type) {
            case 'ip':
                return ip

            case 'ip+email':
                // For login endpoints, combine IP + email for more granular limiting
                const email = req.body?.email || req.body?.username || ''
                return `${ip}:${email.toLowerCase().substring(0, 50)}`

            case 'ip+user':
                // For authenticated routes, combine IP + user ID
                const userId = req.user?._id?.toString() || ''
                return userId ? `${ip}:${userId}` : ip

            case 'ip+phone':
                // For OTP endpoints, combine IP + phone
                const phone = req.body?.phone || req.body?.mobile || ''
                return `${ip}:${phone.substring(0, 15)}`

            default:
                return ip
        }
    }
}

/**
 * Create rate limiter with Redis store (fail-safe)
 * Falls back to in-memory store if Redis is unavailable
 */
const createRateLimiter = (name, config = {}, keyType = 'ip') => {
    const settings = { ...CONFIG[name] || CONFIG.general, ...config }
    const message = MESSAGES[name] || MESSAGES.general

    // Common options
    const commonOptions = {
        windowMs: settings.windowMs,
        max: settings.max,
        standardHeaders: true, // Return rate limit info in headers
        legacyHeaders: false, // Disable X-RateLimit-* headers
        skipFailedRequests: settings.skipFailedRequests,
        skipSuccessfulRequests: settings.skipSuccessfulRequests,

        // Skip OPTIONS requests (CORS preflight)
        skip: (req) => req.method === 'OPTIONS',

        // Key generator
        keyGenerator: generateKey(keyType),

        // Error handler
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
    }

    // Try to use Redis store, fall back to memory store
    try {
        const redisClient = redis.getClient()

        if (redisClient && redis.isConnected()) {
            return rateLimit({
                ...commonOptions,
                store: new RedisStore({
                    // @rate-limit/redis expects 'sendCommand' function
                    sendCommand: (...args) => redisClient.call(...args),
                    prefix: `rl:${name}:`,
                }),
            })
        }
    } catch (error) {
        logger.warn(`Redis store unavailable for ${name} limiter, using memory store`, {
            error: error.message,
        })
    }

    // Fallback to in-memory store
    return rateLimit(commonOptions)
}

// ============================================
// PRE-CONFIGURED RATE LIMITERS
// ============================================

/**
 * General API rate limiter
 * Usage: app.use('/api', generalLimiter)
 */
const generalLimiter = createRateLimiter('general', {}, 'ip')

/**
 * Strict login rate limiter
 * Uses IP + Email combination to prevent distributed brute force
 * Usage: app.use('/api/auth/login', loginLimiter)
 */
const loginLimiter = createRateLimiter('login', {}, 'ip+email')

/**
 * Sensitive operations rate limiter
 * For endpoints like password change, account deletion, etc.
 * Usage: app.use('/api/account/delete', sensitiveLimiter)
 */
const sensitiveLimiter = createRateLimiter('sensitive', {}, 'ip+user')

/**
 * OTP rate limiter
 * For SMS/Email OTP endpoints
 * Usage: app.use('/api/auth/send-otp', otpLimiter)
 */
const otpLimiter = createRateLimiter('otp', {}, 'ip+phone')

/**
 * Password reset rate limiter
 * Usage: app.use('/api/auth/forgot-password', passwordResetLimiter)
 */
const passwordResetLimiter = createRateLimiter('passwordReset', {}, 'ip+email')

/**
 * Upload rate limiter
 * Usage: app.use('/api/uploads', uploadLimiter)
 */
const uploadLimiter = createRateLimiter('upload', {}, 'ip+user')

// ============================================
// DYNAMIC RATE LIMITER FACTORY
// ============================================

/**
 * Create a custom rate limiter for specific endpoints
 * 
 * Usage:
 * const customLimiter = createCustomLimiter({
 *   windowMs: 60000,
 *   max: 50,
 *   keyType: 'ip+user',
 *   message: 'Custom message',
 * })
 * 
 * router.post('/endpoint', customLimiter, handler)
 */
const createCustomLimiter = (options = {}) => {
    const {
        name = 'custom',
        windowMs = 60 * 1000,
        max = 100,
        keyType = 'ip',
        message = MESSAGES.general,
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

// ============================================
// SLIDING WINDOW RATE LIMITER (Redis Native)
// ============================================

/**
 * Sliding window rate limiter using Redis sorted sets
 * More accurate than fixed window, but slightly more expensive
 * 
 * Usage:
 * const isAllowed = await slidingWindowCheck('user:123:action', 10, 60)
 * if (!isAllowed) return res.status(429).json({ error: 'Rate limited' })
 */
const slidingWindowCheck = async (key, maxRequests, windowSeconds) => {
    try {
        const client = redis.getClient()
        if (!client || !redis.isConnected()) {
            // Redis unavailable - fail open (allow request)
            return true
        }

        const now = Date.now()
        const windowStart = now - (windowSeconds * 1000)
        const fullKey = `sw:${key}`

        // Use Redis transaction for atomic operations
        const pipeline = client.pipeline()

        // Remove old entries outside the window
        pipeline.zremrangebyscore(fullKey, 0, windowStart)

        // Count current requests in window
        pipeline.zcard(fullKey)

        // Add current request
        pipeline.zadd(fullKey, now, `${now}:${Math.random()}`)

        // Set expiration
        pipeline.expire(fullKey, windowSeconds)

        const results = await pipeline.exec()
        const currentCount = results[1][1] // zcard result

        return currentCount < maxRequests
    } catch (error) {
        logger.warn('Sliding window check failed', { error: error.message, key })
        // Fail open - allow request if Redis is unavailable
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
    // Pre-configured limiters
    generalLimiter,
    loginLimiter,
    sensitiveLimiter,
    otpLimiter,
    passwordResetLimiter,
    uploadLimiter,

    // Factory functions
    createRateLimiter,
    createCustomLimiter,

    // Sliding window (more accurate)
    slidingWindowCheck,
    slidingWindowLimiter,

    // Configuration (for admin dashboard)
    CONFIG,
    MESSAGES,
}
