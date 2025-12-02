const NodeCache = require('node-cache')
const crypto = require('crypto')

const DEFAULT_TTL = 300 // 5 minutes
const cache = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: 120 })

const buildKey = (req) => req.originalUrl || req.url

const setCacheHeaders = (res, ttl, etag) => {
  res.setHeader('Cache-Control', `public, max-age=${ttl}`)
  if (etag) {
    res.setHeader('ETag', etag)
  }
}

const cacheMiddleware = (ttlSeconds = DEFAULT_TTL) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next()
    }

    // ✅ FIX: Disable caching for admin requests (skipDiscount=true)
    // This prevents browser from caching admin panel data
    if (req.query.skipDiscount === 'true') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      return next()
    }

    const key = buildKey(req)
    const cached = cache.get(key)

    if (cached) {
      setCacheHeaders(res, ttlSeconds, cached.etag)
      res.setHeader('X-Cache', 'HIT')

      // Handle conditional requests
      if (req.headers['if-none-match'] && req.headers['if-none-match'] === cached.etag) {
        return res.status(304).end()
      }

      return res.status(cached.status).send(cached.body)
    }

    res.setHeader('X-Cache', 'MISS')

    const originalJson = res.json.bind(res)
    const originalSend = res.send.bind(res)

    const writeResponse = (payload, writer) => {
      try {
        const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload)
        const etag = crypto.createHash('md5').update(bodyString).digest('hex')

        setCacheHeaders(res, ttlSeconds, etag)
        cache.set(key, { body: payload, status: res.statusCode || 200, etag }, ttlSeconds)
      } catch (err) {
        console.error('[cache] Error caching response:', err.message)
      }

      return writer(payload)
    }

    res.json = (payload) => writeResponse(payload, originalJson)
    res.send = (payload) => writeResponse(payload, originalSend)

    return next()
  }
}

const clearCacheByKey = (key) => cache.del(key)
const clearCacheByPrefix = (prefix) => {
  const keys = cache.keys()
  keys.forEach((k) => {
    if (k.startsWith(prefix)) {
      cache.del(k)
    }
  })
}
const clearAllCache = () => cache.flushAll()

module.exports = {
  cacheMiddleware,
  clearCacheByKey,
  clearCacheByPrefix,
  clearAllCache,
  DEFAULT_TTL,
}
