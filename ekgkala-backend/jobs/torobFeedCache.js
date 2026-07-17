const Product = require('../models/Product')
const redis = require('../utils/redis')
const { flattenProduct } = require('../utils/torobMapper')

const CACHE_KEY = 'torob:feed:v3'
const ttlSeconds = () => Math.max(1, Number.parseInt(process.env.TOROB_FEED_CACHE_TTL_SECONDS, 10) || 600)

const rebuildTorobFeed = async () => {
  const products = await Product.find({ isActive: true, excludeFromTorob: { $ne: true } })
    .populate('category', 'name')
    .lean()
  const feed = products.flatMap(flattenProduct)
  await redis.setCache(CACHE_KEY, feed, ttlSeconds())
  return feed
}

const getTorobFeed = async () => {
  const cached = await redis.getCache(CACHE_KEY)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) return parsed
    } catch (_) {
      // Rebuild malformed cache contents rather than serving them.
    }
  }
  return rebuildTorobFeed()
}

module.exports = { CACHE_KEY, getTorobFeed, rebuildTorobFeed }
