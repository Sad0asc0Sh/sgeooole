const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
const compression = require('compression')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoSanitize = require('express-mongo-sanitize')
// SECURITY: xss-clean removed - using express-validator for input validation instead
// const xss = require('xss-clean') // DEPRECATED - removed for security
const hpp = require('hpp')
require('dotenv').config()

// ============================================
// SECURITY: Enhanced Security Middlewares
// ============================================
const { noSqlInjectionPrevention } = require('./middleware/noSqlInjection')
const { securityLogger, accessLogger } = require('./middleware/securityLogger')
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler')
const { checkProductAccess } = require('./middleware/accessControl')

// SECURITY: Silence console.log/info/debug in production
// Must be loaded AFTER dotenv to read NODE_ENV
require('./utils/productionConsole')

const app = express()

// ============================================
// SECURITY: Trust Proxy Configuration
// Required for rate limiting behind reverse proxies (Nginx, Cloudflare, AWS ELB)
// Without this, all requests appear from proxy IP, causing false rate limits
// ============================================
app.set('trust proxy', 1)

if (process.env.NODE_ENV === 'production') {
  console.log('Security mode: Production (stack traces hidden)')
}

// ============================================
// Helper: Parse and validate URLs from environment variable
// ============================================
const parseAllowedUrls = (envValue) => {
  if (!envValue) return []

  try {
    return envValue
      .split(',')
      .map(url => url.trim())
      .filter(url => {
        // Skip empty strings and wildcards
        if (!url || url === '*') return false

        // Validate URL format
        try {
          new URL(url)
          return true
        } catch (e) {
          console.error(`⚠️ Invalid URL in CLIENT_URL: "${url}" - skipping`)
          return false
        }
      })
  } catch (e) {
    console.error('⚠️ Error parsing CLIENT_URL:', e.message)
    return []
  }
}

// Parse CLIENT_URL once at startup (with error handling)
let clientUrls = []
try {
  clientUrls = parseAllowedUrls(process.env.CLIENT_URL)
  console.log('📋 Parsed CLIENT_URLs for CSP:', clientUrls.length > 0 ? clientUrls : ['(none - using localhost)'])
} catch (e) {
  console.error('⚠️ Failed to parse CLIENT_URL, using defaults:', e.message)
}

// CSP can be disabled via environment variable for debugging
const disableCSP = process.env.DISABLE_CSP === 'true'
if (disableCSP) {
  console.warn('⚠️ CSP is DISABLED via DISABLE_CSP=true - this is insecure!')
}

const helmetConfig = {
  crossOriginResourcePolicy: false, // allow loading images/assets from other origins
  contentSecurityPolicy: (process.env.NODE_ENV === 'production' && !disableCSP) ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for some CSS
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        // Use parsed and validated URLs, fallback to allowing all HTTPS if none specified
        ...(clientUrls.length > 0 ? clientUrls : ['https:', 'http://localhost:3000']),
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false, // Disable CSP in development or when DISABLE_CSP=true
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true, // X-Content-Type-Options: nosniff
  xssFilter: true,
  hidePoweredBy: true,
}
app.use(helmet(helmetConfig))

// ============================================
// 2. Rate Limiting
// ============================================

// Generous limiter for product browsing (public read-only endpoints)
// These endpoints are hit frequently during normal browsing
// SECURITY: user-agent bypass removed - it's forgeable by attackers
// If you need SSR bypass, use a secret internal header from Next.js
const productLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP for products
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'لطفاً چند ثانیه صبر کنید و دوباره تلاش کنید.' },
})
// Apply to product endpoints before general limiter
app.use('/api/products', productLimiter)

// General API limiter
// SECURITY: user-agent bypass removed - it's forgeable
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // increased limit to handle more requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for product endpoints (already handled by productLimiter)
    if (req.path.startsWith('/products')) return true;
    return false;
  },
  message: { success: false, message: 'تعداد درخواست‌های شما بیش از حد مجاز است، لطفاً ۱۵ دقیقه دیگر تلاش کنید.' },
})
app.use('/api', limiter)

// Strict limiter for login endpoints (5 requests per hour)
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Allow CORS preflight requests
  message: { success: false, message: 'تلاش‌های ورود بیش از حد مجاز است. لطفاً یک ساعت دیگر تلاش کنید.' },
})
app.use('/api/auth/login', loginLimiter)
app.use('/api/auth/admin/login', loginLimiter)
app.use('/api/auth/login-password', loginLimiter)

// Very strict limiter for OTP endpoints (10 requests per hour)
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Allow CORS preflight requests
  message: { success: false, message: 'تعداد درخواست‌های OTP بیش از حد مجاز است. لطفاً یک ساعت دیگر تلاش کنید.' },
})
app.use('/api/auth/send-otp', otpLimiter)
app.use('/api/auth/verify-otp', otpLimiter)
app.use('/api/auth/bind-mobile/send-otp', otpLimiter)
app.use('/api/auth/change-email/send-otp', otpLimiter)

// Password reset limiter (3 requests per hour)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Allow CORS preflight requests
  message: { success: false, message: 'تعداد درخواست‌های بازنشانی رمز عبور بیش از حد مجاز است.' },
})
app.use('/api/auth/forgot-password', passwordResetLimiter)
app.use('/api/auth/admin/forgot-password', passwordResetLimiter)


// ============================================
// 3. Performance Middleware
// ============================================

// Response optimizer - adds timing headers
const { responseOptimizer } = require('./middleware/cache')
app.use(responseOptimizer)

// Compression for all responses
app.use(compression({
  level: 6, // Good balance between speed and compression
  threshold: 512, // Compress anything above 512 bytes
  filter: (req, res) => {
    // Don't compress if client doesn't want it
    if (req.headers['x-no-compression']) return false
    // Always compress API responses
    if (req.path.startsWith('/api')) return true
    return compression.filter(req, res)
  }
}))

// Cache static assets with aggressive caching
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // 1 year
  res.setHeader('Vary', 'Accept-Encoding')
  next()
})

// ============================================
// 4. CORS Middleware
// ============================================
// استفاده از clientUrls که قبلاً parse شده (با اعتبارسنجی URL)
// به علاوه localhost ها برای development
const allowedOrigins = [
  ...clientUrls,
  // Localhost for development (ignored in production if clientUrls exist)
  ...(clientUrls.length === 0 ? [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
  ] : []),
]

// اگر CLIENT_URL شامل * باشد، همه مجاز هستند
const allowAllOrigins = (process.env.CLIENT_URL || '').includes('*')

// Vercel و Netlify Preview URL patterns
// این اجازه می‌دهد Preview deployments بدون اضافه کردن هر URL کار کنند
const vercelProjectName = process.env.VERCEL_PROJECT_NAME || ''
const netlifyProjectName = process.env.NETLIFY_PROJECT_NAME || ''

// ساخت regex pattern برای پروژه‌های خاص
const createProjectPattern = (projectName, domain) => {
  if (!projectName) return null
  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^https:\\/\\/${escaped}[\\w-]*\\.${domain}$`, 'i')
}

const vercelPattern = vercelProjectName ? createProjectPattern(vercelProjectName, 'vercel\\.app') : null
const netlifyPattern = netlifyProjectName ? createProjectPattern(netlifyProjectName, 'netlify\\.app') : null

console.log('🌐 CORS Config:', {
  allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : '(none)',
  allowAllOrigins,
  vercelProject: vercelProjectName || '(not set)',
  netlifyProject: netlifyProjectName || '(not set)',
})

app.use(cors({
  origin: (origin, callback) => {
    // ۱. اجازه به درخواست‌های داخلی یا ابزارهای تست (بدون origin)
    if (!origin) {
      return callback(null, true);
    }

    // ۲. اجازه اگر CLIENT_URL برابر '*' تنظیم شده باشد
    if (allowAllOrigins) {
      return callback(null, true);
    }

    // ۳. اجازه اگر دامنه در لیست مجاز باشد (exact match)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // ۴. اجازه به Vercel preview URLs (فقط پروژه مشخص شده)
    if (vercelPattern && vercelPattern.test(origin)) {
      return callback(null, true);
    }

    // ۵. اجازه به Netlify preview URLs (فقط پروژه مشخص شده)
    if (netlifyPattern && netlifyPattern.test(origin)) {
      return callback(null, true);
    }

    // مسدود شد - لاگ می‌گیریم که چه آدرسی مسدود شده
    console.error('🔴 CORS Blocked for Origin:', origin);
    callback(null, false);
  },
  credentials: true,
}))

// Body Parser with Limits
// Keep this slightly above typical payloads to avoid false 413s on metadata-heavy requests.
app.use(express.json({ limit: '15mb' }))
app.use(express.urlencoded({ extended: true, limit: '15mb' }))

// ============================================
// 5. Data Sanitization & Security Middleware
// ============================================
app.use(mongoSanitize()) // NoSQL injection prevention (basic)
app.use(noSqlInjectionPrevention()) // Enhanced NoSQL injection prevention
// SECURITY NOTE: xss-clean removed - use express-validator for input sanitization
// XSS protection is handled by:
// 1. Helmet CSP headers (prevents inline script execution)
// 2. express-validator sanitization in route handlers
// 3. React/Next.js automatic output escaping on frontend
app.use(hpp()) // HTTP Parameter Pollution protection

// ============================================
// 6. Security Logging
// ============================================
// Log all requests in production for audit trail
if (process.env.NODE_ENV === 'production') {
  app.use(accessLogger)
}
// Security logging for sensitive endpoints
app.use('/api/auth', securityLogger('auth'))
app.use('/api/admin', securityLogger('admin'))
app.use('/api/users', securityLogger('user'))
app.use('/api/orders', securityLogger('order'))

// Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Request Logger (Development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

// ============================================
// Routes
// ============================================

// ============================================
// Health Check Endpoints (Secured)
// Public: Basic status only
// Admin: Detailed stats with authentication
// ============================================
const { getCacheStats } = require('./middleware/cache')

// Public health check - minimal info to prevent fingerprinting
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'UP',
    timestamp: new Date().toISOString(),
  })
})

// Detailed health check - Admin only (requires auth token)
const { protect, checkPermission, PERMISSIONS } = require('./middleware/auth')
const redis = require('./utils/redis')

app.get('/api/health/details', protect, checkPermission(PERMISSIONS.SETTINGS_READ), async (req, res) => {
  const cacheStats = getCacheStats()
  const memUsage = process.memoryUsage()
  const redisHealth = redis.getHealthStatus()
  const redisPing = await redis.ping()

  res.json({
    success: true,
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + ' seconds',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: {
      status: redisHealth.status,
      isConnected: redisHealth.isConnected,
      ping: redisPing ? 'PONG' : 'FAILED',
      metrics: redisHealth.metrics,
    },
    cache: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      keys: cacheStats.keys,
      hitRate: cacheStats.hits > 0
        ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1) + '%'
        : '0%',
    },
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    },
  })
})

// Auth Routes
const authRoutes = require('./routes/auth')
app.use('/api/auth', authRoutes)

// Categories Routes
const categoriesRoutes = require('./routes/categories')
app.use('/api/categories', categoriesRoutes)

// Brands Routes
const brandsRoutes = require('./routes/brands')
app.use('/api/brands', brandsRoutes)

// Products Routes
// SECURITY: checkProductAccess blocks non-admin access to admin-only filters
const productsRoutes = require('./routes/products')
app.use('/api/products', checkProductAccess, productsRoutes)
// Admin panel create endpoint: /api/v1/admin/products -> same router
app.use('/api/v1/admin/products', productsRoutes)

// Search Routes (Trending, Tracking, Suggestions)
const searchRoutes = require('./routes/search')
app.use('/api/search', searchRoutes)

// Category Views Routes (Popular Categories Analytics)
const categoryViewsRoutes = require('./routes/categoryViews')
app.use('/api/category-views', categoryViewsRoutes)

// Orders Routes
const ordersRoutes = require('./routes/orders')
app.use('/api/orders', ordersRoutes)

// Shipping Routes
const shippingRoutes = require('./routes/shipping')
app.use('/api/shipping', shippingRoutes)

// RMA Routes
const rmaRoutes = require('./routes/rma')
app.use('/api/rma', rmaRoutes)

// Cart Routes
const cartRoutes = require('./routes/carts')
app.use('/api/carts', cartRoutes)

// Wishlist Routes
const wishlistRoutes = require('./routes/wishlist')
app.use('/api/wishlist', wishlistRoutes)

// Address Routes
const addressRoutes = require('./routes/addresses')
app.use('/api/addresses', addressRoutes)

// User Routes
const userRoutes = require('./routes/users')
app.use('/api/users', userRoutes)

// Coupon Routes
const couponRoutes = require('./routes/coupons')
app.use('/api/coupons', couponRoutes)

// Tickets Routes
const ticketRoutes = require('./routes/tickets')
app.use('/api/tickets', ticketRoutes)

// Reviews Routes
const reviewRoutes = require('./routes/reviews')
app.use('/api/reviews', reviewRoutes)

// Sales Routes
const saleRoutes = require('./routes/sales')
app.use('/api/sales', saleRoutes)

// Blog & CMS Routes
const blogRoutes = require('./routes/blog')
app.use('/api/blog', blogRoutes)
const blogCategoryRoutes = require('./routes/blogCategories')
app.use('/api/blog/categories', blogCategoryRoutes)
const pageRoutes = require('./routes/pages')
app.use('/api/pages', pageRoutes)
const bannerRoutes = require('./routes/banners')
app.use('/api/banners', bannerRoutes)

// Announcements Routes
const announcementRoutes = require('./routes/announcements')
app.use('/api/announcements', announcementRoutes)

// Cache routes
const cacheRoutes = require('./routes/cache')
app.use('/api/cache', cacheRoutes)

// Dashboard Routes
const dashboardRoutes = require('./routes/dashboard')
app.use('/api/dashboard', dashboardRoutes)

// Reports Routes
const reportRoutes = require('./routes/reports')
app.use('/api/reports', reportRoutes)

// Chat AI Routes
const chatRoutes = require('./routes/chatRoutes')
app.use('/api/chat', chatRoutes)

// Notification Routes
const notificationRoutes = require('./routes/notifications')
app.use('/api/notifications', notificationRoutes)

// Admin Management Routes
const adminManagementRoutes = require('./routes/adminManagement')
app.use('/api/admin/management', adminManagementRoutes)

// Admin Setup Routes (One-Time Setup)
const adminSetupRoutes = require('./routes/adminSetup')
app.use('/api/admin/setup', adminSetupRoutes)

// Settings Routes
const settingsRoutes = require('./routes/settings')
app.use('/api/settings', settingsRoutes)

// Admin Test Routes (با احراز هویت - برای تست پیامک در production)
const adminTestRoutes = require('./routes/admin/test')
app.use('/api/admin/test', adminTestRoutes)

// Audit Logs Routes
const auditLogRoutes = require('./routes/auditLogs')
app.use('/api/audit-logs', auditLogRoutes)

// Uploads Routes (Immediate Image Upload)
const uploadRoutes = require('./routes/uploads')
app.use('/api/uploads', uploadRoutes)

// Newsletter Routes
const newsletterRoutes = require('./routes/newsletter')
app.use('/api/newsletter', newsletterRoutes)

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'EkgKala Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      categories: '/api/categories',
      products: '/api/products'
    }
  })
})

// ============================================
// SECURITY: Enhanced Error Handling
// ============================================
// 404 Handler - Using secure notFoundHandler
app.use(notFoundHandler)

// Global Error Handler - Prevents information disclosure
// Masks MongoDB errors, hides stack traces in production
app.use(errorHandler)

// ============================================
// Database Connection & Server Start
// ============================================
const PORT = process.env.PORT || 5000

const connectDB = async () => {
  const maxRetries = 3
  let retries = 0

  while (retries < maxRetries) {
    try {
      console.log(`Connecting to MongoDB... (attempt ${retries + 1}/${maxRetries})`)

      const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala', {
        serverSelectionTimeoutMS: 30000, // 30 seconds for Atlas
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority',
      })

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
      console.log('Database:', mongoose.connection.name)

      // Start Server only after DB connection
      // Initialize Redis (fail-safe, won't block if Redis is down)
      const redisModule = require('./utils/redis')
      redisModule.initRedis().then(() => {
        console.log('🔴 Redis initialization attempted')
      }).catch(() => {
        console.log('⚠️ Redis not available - system will operate without caching')
      })

      const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`)
        console.log(`API: http://localhost:${PORT}/api`)
        console.log(`Uploads: http://localhost:${PORT}/uploads`)
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)

        // PM2 readiness signal (works with wait_ready: true in ecosystem.config.js)
        if (process.send) {
          process.send('ready')
          console.log('📡 PM2 ready signal sent')
        }
      })

      // Increase Timeouts for Long Operations (e.g. CSV Import)
      // Default is 120000 (2 minutes)
      // Set to 10 minutes (600000 ms)
      server.keepAliveTimeout = 600000
      server.headersTimeout = 610000 // Must be greater than keepAliveTimeout

      // Start Jobs
      const startOrderAutoCompleter = require('./jobs/orderAutoCompleter')
      startOrderAutoCompleter()

      const startCartExpiryWarningJob = require('./jobs/cartExpiryWarningJob')
      startCartExpiryWarningJob()

      const { startCartCleanupJob } = require('./jobs/cartCleanupJob')
      startCartCleanupJob()

      return // Success - exit function

    } catch (err) {
      retries++
      console.error(`❌ MongoDB connection attempt ${retries} failed:`, err.message)

      if (retries < maxRetries) {
        console.log(`⏳ Retrying in 5 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else {
        console.error('❌ All MongoDB connection attempts failed. Exiting...')
        process.exit(1)
      }
    }
  }
}

// Connection Events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected')
})

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err)
})

// Initialize
connectDB()

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully...')

  // Disconnect Redis first
  try {
    const redisModule = require('./utils/redis')
    await redisModule.disconnect()
    console.log('Redis connection closed')
  } catch (e) {
    // Ignore Redis disconnect errors
  }

  // Then close MongoDB
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed')
    process.exit(0)
  })
})
