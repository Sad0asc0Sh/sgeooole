/**
 * ============================================
 * Performance Optimizer Middleware
 * Comprehensive performance optimizations
 * ============================================
 */

const NodeCache = require('node-cache')
const crypto = require('crypto')

// ============================================
// In-Memory Cache with Multiple TTLs
// ============================================
const CACHE_TTL = {
  SHORT: 60,        // 1 minute - for dynamic data
  MEDIUM: 300,      // 5 minutes - for semi-static data
  LONG: 1800,       // 30 minutes - for static data
  VERY_LONG: 3600,  // 1 hour - for rarely changing data
}

const cache = new NodeCache({
  stdTTL: CACHE_TTL.MEDIUM,
  checkperiod: 60,
  useClones: false, // Better performance - don't clone on get
  deleteOnExpire: true,
})

// ============================================
// Cache Key Builder
// ============================================
const buildCacheKey = (req) => {
  const baseKey = req.originalUrl || req.url
  // Include user role for personalized caching
  const role = req.user?.role || 'guest'
  return `${role}:${baseKey}`
}

// ============================================
// Set Optimal Cache Headers
// ============================================
const setCacheHeaders = (res, ttl, etag, isPrivate = false) => {
  const cacheType = isPrivate ? 'private' : 'public'
  res.setHeader('Cache-Control', `${cacheType}, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`)
  if (etag) {
    res.setHeader('ETag', `"${etag}"`)
  }
  res.setHeader('Vary', 'Accept-Encoding, Authorization')
}

// ============================================
// Main Cache Middleware
// ============================================
const cacheMiddleware = (ttlSeconds = CACHE_TTL.MEDIUM, options = {}) => {
  const { bypassAuth = false, varyByUser = false } = options

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // Skip cache for admin panel requests
    if (req.query.skipDiscount === 'true' || req.query.nocache === 'true') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      res.setHeader('Pragma', 'no-cache')
      return next()
    }

    // Skip cache if authenticated and bypassAuth is true
    if (bypassAuth && req.user) {
      return next()
    }

    const key = varyByUser ? buildCacheKey(req) : (req.originalUrl || req.url)
    const cached = cache.get(key)

    if (cached) {
      // Set cache headers
      setCacheHeaders(res, ttlSeconds, cached.etag, !!req.user)
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('X-Cache-TTL', ttlSeconds)

      // Handle conditional requests (304 Not Modified)
      const clientEtag = req.headers['if-none-match']
      if (clientEtag && (clientEtag === `"${cached.etag}"` || clientEtag === cached.etag)) {
        return res.status(304).end()
      }

      return res.status(cached.status).json(cached.body)
    }

    // Cache MISS
    res.setHeader('X-Cache', 'MISS')

    // Override res.json to cache the response
    const originalJson = res.json.bind(res)
    res.json = (payload) => {
      try {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const bodyString = JSON.stringify(payload)
          const etag = crypto.createHash('md5').update(bodyString).digest('hex').substring(0, 16)

          setCacheHeaders(res, ttlSeconds, etag, !!req.user)
          cache.set(key, {
            body: payload,
            status: res.statusCode || 200,
            etag,
          }, ttlSeconds)
        }
      } catch (err) {
        console.error('[CACHE] Error caching response:', err.message)
      }

      return originalJson(payload)
    }

    return next()
  }
}

// ============================================
// Cache Utilities
// ============================================
const clearCacheByKey = (key) => cache.del(key)

const clearCacheByPrefix = (prefix) => {
  const keys = cache.keys()
  let cleared = 0
  keys.forEach((k) => {
    if (k.includes(prefix)) {
      cache.del(k)
      cleared++
    }
  })
  return cleared
}

const clearAllCache = () => {
  const stats = cache.getStats()
  cache.flushAll()
  return stats.keys
}

const getCacheStats = () => cache.getStats()

// ============================================
// Response Optimizer Middleware
// Adds performance headers to all responses
// ============================================
const responseOptimizer = (req, res, next) => {
  // Start time for response time header
  const startTime = Date.now()

  // Override res.json for timing
  const originalJson = res.json.bind(res)
  res.json = (payload) => {
    const responseTime = Date.now() - startTime
    res.setHeader('X-Response-Time', `${responseTime}ms`)
    return originalJson(payload)
  }

  // Security headers that also help with performance
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-DNS-Prefetch-Control', 'on')

  next()
}

// ============================================
// Query Optimizer for MongoDB
// ============================================
const optimizeQuery = {
  // Limit fields to reduce data transfer
  selectMinimal: '-__v -createdAt -updatedAt',
  selectList: '-__v -description -specifications',

  // Default pagination
  pagination: (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit
    return { page, limit, skip }
  },
}

// ============================================
// Exports
// ============================================
module.exports = {
  cacheMiddleware,
  clearCacheByKey,
  clearCacheByPrefix,
  clearAllCache,
  getCacheStats,
  responseOptimizer,
  optimizeQuery,
  CACHE_TTL,
  cache, // Export for direct access if needed
}
