const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
const compression = require('compression')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean')
const hpp = require('hpp')
require('dotenv').config()

const app = express()

if (process.env.NODE_ENV === 'production') {
  console.log('Security mode: Production (stack traces hidden)')
}

// ============================================
// 1. Security Headers (Helmet)
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: false, // allow loading images/assets from other origins
}))

// ============================================
// 2. Rate Limiting
// ============================================

// General API limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تعداد درخواست‌های شما بیش از حد مجاز است، لطفاً ۱۵ دقیقه دیگر تلاش کنید.' },
})
app.use('/api', limiter)

// Strict limiter for login endpoints (5 requests per hour)
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
const allowedOriginsEnv = process.env.CLIENT_URL || process.env.FRONTEND_URL
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(Boolean)
  : [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    // remove localhost entries in production
  ]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

// Body Parser with Limits
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// ============================================
// 5. Data Sanitization
// ============================================
app.use(mongoSanitize()) // NoSQL injection
app.use(xss()) // XSS protection
app.use(hpp()) // HTTP Parameter Pollution

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

// Health Check with Performance Stats
const { getCacheStats } = require('./middleware/cache')
app.get('/api/health', (req, res) => {
  const cacheStats = getCacheStats()
  const memUsage = process.memoryUsage()

  res.json({
    success: true,
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + ' seconds',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
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
const productsRoutes = require('./routes/products')
app.use('/api/products', productsRoutes)
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

// Audit Logs Routes
const auditLogRoutes = require('./routes/auditLogs')
app.use('/api/audit-logs', auditLogRoutes)

// Uploads Routes (Immediate Image Upload)
const uploadRoutes = require('./routes/uploads')
app.use('/api/uploads', uploadRoutes)

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'Welfvita Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      categories: '/api/categories',
      products: '/api/products'
    }
  })
})

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.path}`
  })
})

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
})

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

      const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita', {
        serverSelectionTimeoutMS: 30000, // 30 seconds for Atlas
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority',
      })

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
      console.log('Database:', mongoose.connection.name)

      // Start Server only after DB connection
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`)
        console.log(`API: http://localhost:${PORT}/api`)
        console.log(`Uploads: http://localhost:${PORT}/uploads`)
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
      })

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
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...')
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed')
    process.exit(0)
  })
})
