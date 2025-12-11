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
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  }
}))

// Cache static assets
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
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
// Settings Routes
const settingsRoutes = require('./routes/settings')
app.use('/api/settings', settingsRoutes)

// Audit Logs Routes
const auditLogRoutes = require('./routes/auditLogs')
app.use('/api/audit-logs', auditLogRoutes)

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
  try {
    console.log('Connecting to MongoDB...')
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    })

    console.log(`MongoDB Connected: ${conn.connection.host}`)
    console.log('Database:', mongoose.connection.name)

    // Start Server only after DB connection
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
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

  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message)
    process.exit(1)
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
