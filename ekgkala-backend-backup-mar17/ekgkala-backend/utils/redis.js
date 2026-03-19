/**
 * ============================================
 * ENTERPRISE REDIS FAIL-SAFE WRAPPER
 * ============================================
 * 
 * High-Performance, Fail-Safe & Polyglot-Compatible Redis Support
 * 
 * ARCHITECTURAL PRINCIPLES:
 * 1. Redis must NEVER be a Single Point of Failure
 * 2. System degrades gracefully when Redis is unavailable
 * 3. Auth NEVER crashes if Redis is down
 * 4. Background jobs do NOT flood logs
 * 
 * REDIS ROLE CATEGORIES:
 * 🟢 ACCELERATORS (Optional): Product lists, Settings cache
 * 🟡 STATE_HELPERS (Degradable): Rate limiting, View counters
 * 🔴 CRITICAL_PATHS (Fail-Open): Token blacklist, Sessions
 */

const Redis = require('ioredis')
const logger = require('./logger')

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // Connection settings
  connection: {
    maxRetriesPerRequest: 1,         // Prevent retry storms
    retryStrategy: (times) => {
      if (times > 3) return null      // Stop retrying after 3 attempts
      return Math.min(times * 200, 2000) // Max 2 second delay
    },
    enableOfflineQueue: false,        // Don't queue commands when disconnected
    connectTimeout: 5000,             // 5 second connection timeout
    commandTimeout: 1000,             // 1 second command timeout
    lazyConnect: true,                // Don't connect until first command
  },

  // Category-specific timeouts (ms)
  timeouts: {
    ACCELERATOR: 100,      // Fast fail for cache
    STATE_HELPER: 50,      // Very fast for rate limiting
    CRITICAL: 200,         // Slightly longer for auth
  },

  // Log rate limiting (prevent log flooding)
  logging: {
    errorThrottleMs: 60000,  // 1 minute between same errors
    maxErrorsPerMinute: 5,
  }
}

// ============================================
// STATE MANAGEMENT
// ============================================
let client = null
let isConnected = false
let isConnecting = false
let lastErrorLog = 0
let errorCountThisMinute = 0
let lastErrorResetTime = Date.now()

// Connection health metrics
const metrics = {
  commandsExecuted: 0,
  commandsFailed: 0,
  lastSuccessfulCommand: null,
  lastFailedCommand: null,
  connectionAttempts: 0,
  currentStatus: 'disconnected',
}

// ============================================
// REDIS CLIENT INITIALIZATION
// ============================================
const getRedisConfig = () => {
  const baseConfig = {
    ...CONFIG.connection,
    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  }

  if (process.env.REDIS_URL) {
    return {
      ...baseConfig,
      // ioredis parses REDIS_URL automatically
      tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
    }
  }

  return {
    ...baseConfig,
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
  }
}

/**
 * Initialize Redis client with fail-safe configuration
 */
const initRedis = async () => {
  if (client) return client
  if (isConnecting) return null

  isConnecting = true
  metrics.connectionAttempts++

  try {
    const config = getRedisConfig()

    // Create client based on URL or host/port
    if (process.env.REDIS_URL) {
      client = new Redis(process.env.REDIS_URL, config)
    } else {
      client = new Redis(config)
    }

    // Event handlers with rate-limited logging
    client.on('connect', () => {
      logThrottled('info', '[REDIS] Connecting...')
      metrics.currentStatus = 'connecting'
    })

    client.on('ready', () => {
      isConnected = true
      isConnecting = false
      metrics.currentStatus = 'ready'
      logger.info('[REDIS] ✅ Connected and ready')
    })

    client.on('error', (err) => {
      isConnected = false
      metrics.currentStatus = 'error'
      logThrottled('warn', `[REDIS] Connection error: ${err.message}`)
    })

    client.on('close', () => {
      isConnected = false
      metrics.currentStatus = 'closed'
      logThrottled('warn', '[REDIS] Connection closed')
    })

    client.on('reconnecting', () => {
      metrics.currentStatus = 'reconnecting'
      logThrottled('info', '[REDIS] Attempting to reconnect...')
    })

    client.on('end', () => {
      isConnected = false
      isConnecting = false
      metrics.currentStatus = 'ended'
      logThrottled('warn', '[REDIS] Connection ended')
    })

    // Attempt to connect
    await client.connect().catch(() => {
      // Connection failed, but we continue - fail-safe
      isConnecting = false
    })

    return client
  } catch (error) {
    isConnecting = false
    logThrottled('error', `[REDIS] Initialization failed: ${error.message}`)
    return null
  }
}

// ============================================
// RATE-LIMITED LOGGING (Prevent Log Flooding)
// ============================================
const logThrottled = (level, message) => {
  const now = Date.now()

  // Reset counter every minute
  if (now - lastErrorResetTime > 60000) {
    errorCountThisMinute = 0
    lastErrorResetTime = now
  }

  // Check throttle
  if (level === 'error' || level === 'warn') {
    if (errorCountThisMinute >= CONFIG.logging.maxErrorsPerMinute) {
      return // Skip logging, too many errors
    }
    if (now - lastErrorLog < CONFIG.logging.errorThrottleMs) {
      return // Skip, too soon since last error
    }
    lastErrorLog = now
    errorCountThisMinute++
  }

  logger[level](message)
}

// ============================================
// FAIL-SAFE COMMAND WRAPPER
// ============================================

/**
 * Execute Redis command with timeout and fallback
 * @param {string} category - 'ACCELERATOR' | 'STATE_HELPER' | 'CRITICAL'
 * @param {Function} command - Async function that executes Redis command
 * @param {*} fallbackValue - Value to return if Redis fails
 * @returns {Promise<*>} Result or fallback value
 */
const safeExecute = async (category, command, fallbackValue = null) => {
  // If no client or not connected, return fallback immediately
  if (!client || !isConnected) {
    return fallbackValue
  }

  const timeout = CONFIG.timeouts[category] || CONFIG.timeouts.ACCELERATOR

  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis timeout')), timeout)
    })

    // Race between command and timeout
    const result = await Promise.race([
      command(),
      timeoutPromise
    ])

    metrics.commandsExecuted++
    metrics.lastSuccessfulCommand = Date.now()

    return result
  } catch (error) {
    metrics.commandsFailed++
    metrics.lastFailedCommand = Date.now()

    // Only log non-timeout errors (timeouts are expected under load)
    if (error.message !== 'Redis timeout') {
      logThrottled('warn', `[REDIS] Command failed: ${error.message}`)
    }

    return fallbackValue
  }
}

// ============================================
// PUBLIC API - SAFE REDIS OPERATIONS
// ============================================

/**
 * 🟢 ACCELERATOR: Get cached value (optional, fast-fail)
 * Use for: Product lists, Settings, Homepage data
 */
const getCache = async (key) => {
  return safeExecute('ACCELERATOR', () => client.get(key), null)
}

/**
 * 🟢 ACCELERATOR: Set cached value with TTL
 */
const setCache = async (key, value, ttlSeconds = 300) => {
  return safeExecute('ACCELERATOR', () =>
    client.setex(key, ttlSeconds, typeof value === 'string' ? value : JSON.stringify(value)),
    false
  )
}

/**
 * 🟢 ACCELERATOR: Delete cached value
 */
const deleteCache = async (key) => {
  return safeExecute('ACCELERATOR', () => client.del(key), false)
}

/**
 * 🟢 ACCELERATOR: Delete multiple keys by pattern
 */
const deleteCachePattern = async (pattern) => {
  return safeExecute('ACCELERATOR', async () => {
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(...keys)
    }
    return keys.length
  }, 0)
}

/**
 * 🟡 STATE_HELPER: Increment counter (rate limiting, view counts)
 * Fallback: Allow request (fail-open for rate limiting)
 */
const increment = async (key, ttlSeconds = 60) => {
  return safeExecute('STATE_HELPER', async () => {
    const result = await client.incr(key)
    if (result === 1) {
      await client.expire(key, ttlSeconds)
    }
    return result
  }, 0) // Return 0 on failure = allow the request
}

/**
 * 🟡 STATE_HELPER: Get counter value
 */
const getCounter = async (key) => {
  return safeExecute('STATE_HELPER', async () => {
    const value = await client.get(key)
    return parseInt(value) || 0
  }, 0)
}

/**
 * 🔴 CRITICAL: Check token blacklist (Auth path)
 * IMPORTANT: Returns FALSE on failure (fail-open = allow auth)
 * This prevents Redis failure from blocking all users
 */
const isTokenBlacklisted = async (token) => {
  return safeExecute('CRITICAL', async () => {
    const result = await client.get(`blacklist:${token}`)
    return !!result
  }, false) // Fail-open: if Redis is down, don't block auth
}

/**
 * 🔴 CRITICAL: Add token to blacklist (Logout/Password change)
 */
const blacklistToken = async (token, ttlSeconds = 86400) => {
  return safeExecute('CRITICAL', () =>
    client.setex(`blacklist:${token}`, ttlSeconds, '1'),
    false
  )
}

/**
 * 🔴 CRITICAL: Session storage
 */
const setSession = async (sessionId, data, ttlSeconds = 3600) => {
  return safeExecute('CRITICAL', () =>
    client.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data)),
    false
  )
}

const getSession = async (sessionId) => {
  return safeExecute('CRITICAL', async () => {
    const data = await client.get(`session:${sessionId}`)
    return data ? JSON.parse(data) : null
  }, null)
}

const deleteSession = async (sessionId) => {
  return safeExecute('CRITICAL', () => client.del(`session:${sessionId}`), false)
}

// ============================================
// HEALTH & DIAGNOSTICS
// ============================================

/**
 * Get Redis connection status and metrics
 */
const getHealthStatus = () => {
  return {
    isConnected,
    status: metrics.currentStatus,
    metrics: {
      commandsExecuted: metrics.commandsExecuted,
      commandsFailed: metrics.commandsFailed,
      successRate: metrics.commandsExecuted > 0
        ? ((metrics.commandsExecuted - metrics.commandsFailed) / metrics.commandsExecuted * 100).toFixed(2) + '%'
        : 'N/A',
      lastSuccessfulCommand: metrics.lastSuccessfulCommand
        ? new Date(metrics.lastSuccessfulCommand).toISOString()
        : null,
      lastFailedCommand: metrics.lastFailedCommand
        ? new Date(metrics.lastFailedCommand).toISOString()
        : null,
      connectionAttempts: metrics.connectionAttempts,
    }
  }
}

/**
 * Check if Redis is available (for health endpoints)
 */
const ping = async () => {
  if (!client || !isConnected) return false

  try {
    const result = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(), 500))
    ])
    return result === 'PONG'
  } catch {
    return false
  }
}

/**
 * Graceful shutdown
 */
const disconnect = async () => {
  if (client) {
    try {
      await client.quit()
      client = null
      isConnected = false
      logger.info('[REDIS] Disconnected gracefully')
    } catch (error) {
      logger.error('[REDIS] Error during disconnect:', error.message)
    }
  }
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

/**
 * Get raw client (for advanced use cases)
 * ⚠️ WARNING: Direct client access bypasses fail-safe wrapper
 * Use only when absolutely necessary
 */
const getClient = () => {
  if (!client) {
    initRedis()
  }
  return client
}

/**
 * Get connection status (legacy)
 */
const getStatus = () => {
  return client ? client.status : 'disconnected'
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  // Initialization
  initRedis,
  disconnect,

  // 🟢 Accelerators (Cache operations)
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,

  // 🟡 State Helpers (Counters, Rate limiting)
  increment,
  getCounter,

  // 🔴 Critical Paths (Auth, Sessions)
  isTokenBlacklisted,
  blacklistToken,
  setSession,
  getSession,
  deleteSession,

  // Health & Diagnostics
  getHealthStatus,
  ping,
  isConnected: () => isConnected,

  // Legacy compatibility (deprecated, use safe methods instead)
  getClient,
  getStatus,
}
