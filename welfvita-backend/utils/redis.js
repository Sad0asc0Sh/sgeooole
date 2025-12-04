const Redis = require('ioredis')
const logger = require('./logger')

let client

const getRedisConfig = () => {
  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    }
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  }
}

const initRedis = () => {
  if (client) return client

  const config = getRedisConfig()
  client = new Redis(config)

  client.on('connect', () => logger.info('Redis connecting...'))
  client.on('ready', () => logger.info('Redis ready'))
  client.on('error', (err) => logger.error('Redis error', { error: err.message }))
  client.on('end', () => logger.warn('Redis connection closed'))

  return client
}

const getClient = () => {
  if (!client) {
    initRedis()
  }
  return client
}

const getStatus = () => {
  const c = getClient()
  return c && c.status
}

module.exports = {
  getClient,
  getStatus,
}
