/**
 * 🔗 فایل یکپارچه‌سازی - نحوه اتصال تمام قطعات
 * 
 * این فایل نشان می‌دهد کجا باید چه کد را اضافه/تغییر دهید
 */

// ============================================
// 1️⃣ تغییر در server.js یا app.js
// ============================================

/*
// فوق‌الرأس:
const express = require('express')
const app = express()

// اضافه کنید:
const bestsellersRoutes = require('./routes/bestsellers')
const { startBestsellersJobs } = require('./jobs/bestsellersScheduler')

// در جایی که routes اضافه می‌شوند:
app.use('/api/v1/products', bestsellersRoutes)
app.use('/api/v1/tracking', bestsellersRoutes)  
app.use('/api/v1/bestsellers', bestsellersRoutes)
app.use('/api/v1/internal', bestsellersRoutes)

// پس از اتصال MongoDB:
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected')
    startBestsellersJobs()  // شروع Cron Jobs
  })
  .catch(err => console.error('❌ MongoDB connection failed:', err))
*/

// ============================================
// 2️⃣ تغییر در Order Controller
// ============================================

/*
// برای ثبت SalesEvent پس از خرید:

const SalesEvent = require('../models/SalesEvent')

const orderController = {
  createOrder: async (req, res) => {
    try {
      // ایجاد Order
      const order = new Order({
        user_id: req.user._id,
        items: req.body.items,
        total_amount: req.body.total,
        // ... باقی فیلدها
      })

      await order.save()

      // ✨ نیست: ثبت SalesEvents
      for (const item of order.items) {
        await SalesEvent.create({
          product_id: item.product_id,
          order_id: order._id,
          quantity: item.quantity,
          revenue: item.price * item.quantity,
          margin_pct: calculateMargin(item), // 20% مثلاً
          sold_at: new Date(),
        })
      }

      res.json({ success: true, order })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  },
}

// Helper برای محاسبه حاشیه سود:
function calculateMargin(item) {
  const cost = item.cost_price || item.price * 0.7  // فرض: 30% فروش
  const margin = ((item.price - cost) / item.price) * 100
  return Math.round(margin)
}
*/

// ============================================
// 3️⃣ تغییر در Product Model
// ============================================

/*
// اطمینان حاصل کنید Product model شامل این فیلدها است:

const ProductSchema = new mongoose.Schema({
  // ... فیلدهای دیگر
  
  // اگر نیست، اضافه کنید:
  average_rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  
  review_count: {
    type: Number,
    min: 0,
    default: 0,
  },
  
  created_at: {
    type: Date,
    default: Date.now,
  },
  
  is_active: {
    type: Boolean,
    default: true,
  },
  
  // اگر موجود نیست:
  stock: {
    type: Number,
    min: 0,
    default: 0,
  },
})
*/

// ============================================
// 4️⃣ ادغام در Frontend - صفحه اصلی
// ============================================

/*
// در app/page.tsx یا pages/index.tsx:

import BestSellers from '@/components/home/BestSellers'
import HeroSection from '@/components/home/HeroSection'
import CategoryRail from '@/components/home/CategoryRail'

export default function HomePage() {
  return (
    <main>
      {/* Top Section */}
      <HeroSection />
      
      {/* 🆕 BestSellers Section */}
      <BestSellers
        limit={8}
        showBadge={true}
        showTrendArrow={true}
      />
      
      {/* دیگر sections */}
      <CategoryRail />
      {/* ... */}
    </main>
  )
}
*/

// ============================================
// 5️⃣ متغیرهای محیطی (.env)
// ============================================

/*
# Backend
MONGODB_URI=mongodb://localhost:27017/ekgkala
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=production
NODE_PORT=5000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Cron Jobs
CRON_ENABLED=true

# Authentication
JWT_SECRET=your-secret-key-here
*/

// ============================================
// 6️⃣ Middleware Authentication (اگر نیست)
// ============================================

/*
// middleware/auth.js:

const jwt = require('jsonwebtoken')

exports.authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token required' })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    res.status(403).json({ success: false, message: 'Invalid token' })
  }
}

// middleware/admin.js:

exports.isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' })
  }
  next()
}
*/

// ============================================
// 7️⃣ Redis Configuration (اگر نیست)
// ============================================

/*
// utils/redis.js:

const redis = require('redis')

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
})

client.on('error', (err) => {
  console.error('❌ Redis Error:', err)
})

client.on('connect', () => {
  console.log('✅ Redis connected')
})

// Graceful shutdown
process.on('SIGINT', () => {
  client.quit(() => {
    console.log('Redis connection closed')
    process.exit(0)
  })
})

module.exports = client
*/

// ============================================
// 8️⃣ Logger Configuration (اگر نیست)
// ============================================

/*
// utils/logger.js:

const fs = require('fs')
const path = require('path')

const logsDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir)
}

const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ℹ️  ${message}`)
    // Optionally log to file
  },
  
  error: (message) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ ${message}`)
  },
  
  warn: (message) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] ⚠️  ${message}`)
  },
}

module.exports = logger
*/

// ============================================
// 9️⃣ Review Model (اگر نیست)
// ============================================

/*
// models/Review.js:

const ReviewSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
  },
  
  text: String,
  
  created_at: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model('Review', ReviewSchema)
*/

// ============================================
// 🔟 اجرای Command Line برای تست
// ============================================

/*
1. شروع Backend:
   npm start

2. بررسی Models:
   db.productscores.findOne({})
   db.salesevents.findOne({})
   db.productviews.findOne({})

3. تست API:
   curl 'http://localhost:5000/api/v1/products/bestsellers?limit=5'

4. بررسی Cron:
   tail -f logs/bestsellers.log
   # باید ببینید "[BestSellers Cron] شروع محاسبه امتیازات"

5. تست Frontend:
   npm run dev
   # بازید http://localhost:3000
   # باید بخش پرفروش‌ترین‌ها مرئی باشد

6. تست Impression:
   curl -X POST 'http://localhost:5000/api/v1/tracking/impression' \
     -H 'Content-Type: application/json' \
     -d '{"product_id":"<ID>","section":"bestsellers","position":1}'

7. تست Admin:
   curl 'http://localhost:5000/api/v1/bestsellers/stats' \
     -H "Authorization: Bearer <TOKEN>"
*/

// ============================================
// ❗️ نکات مهم
// ============================================

/*
1. ✅ Indexes: MongoDB indexes باید ایجاد شود (خودکار)

2. ✅ CORS: اگر Frontend و Backend جداپایه هستند:
   const cors = require('cors')
   app.use(cors({
     origin: process.env.FRONTEND_URL,
     credentials: true,
   }))

3. ✅ Rate Limiting:
   const rateLimit = require('express-rate-limit')
   const limiter = rateLimit({
     windowMs: 1000,
     max: 100,
   })
   router.post('/tracking/impression', limiter, controller)

4. ✅ Error Handling:
   app.use((err, req, res, next) => {
     console.error('Unhandled error:', err)
     res.status(500).json({ success: false, error: 'Server error' })
   })

5. ✅ Health Check:
   app.get('/health', (req, res) => {
     res.json({ status: 'ok', timestamp: new Date() })
   })
*/

module.exports = {
  integrationSteps: [
    '1. اضافه کردن routes به server.js',
    '2. شروع Cron jobs',
    '3. ثبت SalesEvents در OrderController',
    '4. بررسی Product model fields',
    '5. ادغام BestSellers component',
    '6. تنظیم متغیرهای محیطی',
    '7. راه‌اندازی Redis',
    '8. تست تمام endpoints',
    '9. بررسی Frontend integration',
    '10. نگاهداری و monitoring',
  ],
}
