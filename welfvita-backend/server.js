const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
const compression = require('compression')
require('dotenv').config()

const app = express()

// ============================================
// Performance Middleware
// ============================================

// GZIP/Brotli Compression for all responses
app.use(compression({
  level: 6, // Balanced compression level (1-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Skip compression for already compressed or SSE responses
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  }
}))

// Performance caching headers for static assets
app.use('/uploads', (req, res, next) => {
  // Cache static files for 30 days
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
  next()
})

// ============================================
// CORS Middleware
// ============================================
const allowedOriginsEnv = process.env.CLIENT_URL || process.env.FRONTEND_URL
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(Boolean)
  : [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ]

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

// Body Parser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static Files (برای دسترسی به فایل‌های آپلود شده)
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
  console.error('❌ Server Error:', err)
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
    console.log('⏳ در حال اتصال به دیتابیس...')
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    })

    console.log(`✅ MongoDB متصل شد: ${conn.connection.host}`)
    console.log('📍 Database:', mongoose.connection.name)

    // Start Server only after DB connection
    app.listen(PORT, () => {
      console.log('╔════════════════════════════════════════╗')
      console.log('║     Welfvita Backend Server            ║')
      console.log('╚════════════════════════════════════════╝')
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📍 API: http://localhost:${PORT}/api`)
      console.log(`📁 Uploads: http://localhost:${PORT}/uploads`)
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log('═══════════════════════════════════════════')
    })

    // Start Jobs
    const startOrderAutoCompleter = require('./jobs/orderAutoCompleter')
    startOrderAutoCompleter()

    // Start Cart Expiry Warning Job
    const startCartExpiryWarningJob = require('./jobs/cartExpiryWarningJob')
    startCartExpiryWarningJob()

    // Start Cart Cleanup Job (cleans up expired carts)
    const { startCartCleanupJob } = require('./jobs/cartCleanupJob')
    startCartCleanupJob()

  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err.message)
    process.exit(1)
  }
}

// Connection Events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected')
})

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err)
})

// Initialize
connectDB()

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, closing server gracefully...')
  mongoose.connection.close(false, () => {
    console.log('✅ MongoDB connection closed')
    process.exit(0)
  })
})
