const Product = require('../models/Product')
const redis = require('../utils/redis')
const { flattenProduct } = require('../utils/torobMapper')
const { getActiveSalesCampaignContext } = require('../services/pricingService')

// ثبت صریح مدل‌های Mongoose برای جلوگیری از خطای MissingSchemaError
require('../models/Category')
require('../models/Brand')
require('../models/Sale')

const CACHE_KEY = 'torob:feed:v4'
const ttlSeconds = () => Math.max(1, Number.parseInt(process.env.TOROB_FEED_CACHE_TTL_SECONDS, 10) || 600)

const rebuildTorobFeed = async () => {
  const [products, campaignContext] = await Promise.all([
    Product.find({ isActive: true, excludeFromTorob: { $ne: true } })
      .populate('category', 'name')
      .populate('brand', 'name')
      .lean(),
    getActiveSalesCampaignContext(new Date()),
  ])
  const feed = products.flatMap((p) => flattenProduct(p, campaignContext))
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
      // در صورت خرابی محتوای کش، فید مجدداً ساخته می‌شود
    }
  }
  return rebuildTorobFeed()
}

module.exports = { CACHE_KEY, getTorobFeed, rebuildTorobFeed }
