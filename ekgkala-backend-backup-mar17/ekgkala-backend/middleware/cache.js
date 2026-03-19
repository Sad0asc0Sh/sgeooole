/**
 * ============================================
 * Performance Optimizer Middleware
 * Comprehensive performance optimizations
 * ============================================
 */

const NodeCache = require('node-cache')
const crypto = require('crypto')
const redisModule = require('../utils/redis')

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
// PM2 Cluster Cache Invalidation via IPC
// When running in PM2 cluster mode, each worker has its own in-memory
// NodeCache. Cache invalidation must be broadcast to ALL workers so
// stale data is not served by other processes.
//
// Strategy:
// 1. If Redis is available, use Redis Pub/Sub for reliable cross-process
//    cache invalidation (works across any number of cluster workers).
// 2. As a fallback, use PM2 IPC via process.send().
// ============================================

const CACHE_INVALIDATION_CHANNEL = 'cache:invalidate'

// Unique process identifier to avoid re-processing own messages
const PROCESS_ID = `${process.pid}-${Date.now()}`

/**
 * Apply a cache invalidation action locally (without broadcasting).
 */
const applyLocalInvalidation = (action) => {
  try {
    if (action.method === 'clearAll') {
      cache.flushAll()
    } else if (action.method === 'clearByKey' && action.key) {
      cache.del(action.key)
    } else if (action.method === 'clearByPrefix' && action.prefix) {
      const keys = cache.keys()
      keys.forEach((k) => {
        if (k.includes(action.prefix)) {
          cache.del(k)
        }
      })
    }
  } catch (err) {
    // Silently ignore errors during local invalidation
  }
}

/**
 * Broadcast cache invalidation to other processes.
 * Uses Redis Pub/Sub when available, PM2 IPC as fallback.
 */
const broadcastCacheInvalidation = async (action) => {
  const message = JSON.stringify({ ...action, senderId: PROCESS_ID })

  // Try Redis Pub/Sub first (reliable cross-process communication)
  if (redisModule.isConnected()) {
    try {
      const client = redisModule.getClient()
      if (client) {
        await client.publish(CACHE_INVALIDATION_CHANNEL, message)
        return
      }
    } catch (err) {
      // Redis publish failed, fall through to PM2 IPC
    }
  }

  // Fallback: PM2 IPC (message goes to master, but may not reach other workers
  // without explicit forwarding — this is a best-effort fallback)
  if (typeof process.send === 'function') {
    try {
      process.send({
        type: CACHE_INVALIDATION_CHANNEL,
        data: { ...action, senderId: PROCESS_ID },
      })
    } catch (err) { /* ignore */ }
  }
}

/**
 * Subscribe to Redis Pub/Sub for cache invalidation messages from other workers.
 * Uses a dedicated subscriber connection (ioredis requirement).
 */
const initCacheSubscriber = async () => {
  if (!redisModule.isConnected()) return

  try {
    const client = redisModule.getClient()
    if (!client) return

    // Create a duplicate connection for subscribing (ioredis requirement:
    // a client in subscriber mode cannot issue other commands)
    const subscriber = client.duplicate()

    subscriber.on('error', (err) => {
      // Silently ignore subscriber errors — system degrades gracefully
    })

    await subscriber.subscribe(CACHE_INVALIDATION_CHANNEL)

    subscriber.on('message', (channel, message) => {
      if (channel !== CACHE_INVALIDATION_CHANNEL) return
      try {
        const action = JSON.parse(message)
        // Ignore messages from this process (we already applied locally)
        if (action.senderId === PROCESS_ID) return
        applyLocalInvalidation(action)
      } catch (err) {
        // Silently ignore parse errors
      }
    })
  } catch (err) {
    // Redis subscriber setup failed — system continues without cross-process sync
  }
}

// Listen for cache invalidation messages via PM2 IPC (fallback path)
process.on('message', (msg) => {
  if (msg && msg.type === CACHE_INVALIDATION_CHANNEL && msg.data) {
    // Ignore messages from this process
    if (msg.data.senderId === PROCESS_ID) return
    applyLocalInvalidation(msg.data)
  }
})

// Initialize Redis subscriber after a short delay to allow Redis connection to establish
setTimeout(() => {
  initCacheSubscriber().catch(() => {
    // Silently ignore — system works without Redis
  })
}, 5000)

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
  // IMPORTANT: Don't send max-age to browser for dynamic APIs
  // This ensures changes are visible immediately after server cache is cleared
  // Server-side caching still works, but browser always requests fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
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
    if (req.query.skipDiscount === 'true' || req.query.nocache === 'true' || req.query._t) {
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
const clearCacheByKey = (key) => {
  cache.del(key)
  broadcastCacheInvalidation({ method: 'clearByKey', key })
}

const clearCacheByPrefix = (prefix) => {
  const keys = cache.keys()
  let cleared = 0
  keys.forEach((k) => {
    if (k.includes(prefix)) {
      cache.del(k)
      cleared++
    }
  })
  if (cleared > 0) {
    console.log(`[CACHE] Cleared ${cleared} cache entries matching prefix: ${prefix}`)
  }
  broadcastCacheInvalidation({ method: 'clearByPrefix', prefix })
  return cleared
}

const clearAllCache = () => {
  const stats = cache.getStats()
  cache.flushAll()
  broadcastCacheInvalidation({ method: 'clearAll' })
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
