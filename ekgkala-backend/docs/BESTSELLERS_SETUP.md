/**
 * 📝 دستور کامل پیاده‌سازی بخش پرفروش‌ترین‌ها
 * 
 * این فایل راهنمایی کامل برای پیاده‌سازی چک‌لیستی است.
 */

// ============================================
// مرحله 1: راه‌اندازی دیتابیس
// ============================================

/*
از طریق MongoDB، جداول زیر ایجاد شده‌اند:

1. ProductScore - امتیازات محصولات
2. SalesEvent - رویدادهای فروش
3. ProductView - رویدادهای بازدید

برای راه‌اندازی:

// Connect to MongoDB
const mongoose = require('mongoose')
await mongoose.connect(process.env.MONGODB_URI)

// Import models
const ProductScore = require('./models/ProductScore')
const SalesEvent = require('./models/SalesEvent')
const ProductView = require('./models/ProductView')

// آنها به صورت خودکار ایجاد می‌شوند
*/

// ============================================
// مرحله 2: ادغام Routes
// ============================================

/*
در فایل server.js یا app.js:

const bestsellersRoutes = require('./routes/bestsellers')
app.use('/api/v1/products', bestsellersRoutes)
app.use('/api/v1/tracking', bestsellersRoutes)
app.use('/api/v1/bestsellers', bestsellersRoutes)
app.use('/api/v1/internal', bestsellersRoutes)
*/

// ============================================
// مرحله 3: شروع Cron Jobs
// ============================================

/*
در فایل server.js:

const { startBestsellersJobs } = require('./jobs/bestsellersScheduler')

// پس از اتصال دیتابیس
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('MongoDB connected')
  startBestsellersJobs()
})
*/

// ============================================
// مرحله 4: ادغام در Frontend
// ============================================

/*
در صفحه اصلی (pages/index.tsx یا app/page.tsx):

import BestSellers from '@/components/home/BestSellers'

export default function HomePage() {
  return (
    <>
      {/* Components دیگر ... */}
      <BestSellers 
        limit={8}
        showBadge={true}
        showTrendArrow={true}
      />
      {/* Components دیگر ... */}
    </>
  )
}
*/

// ============================================
// مرحله 5: ثبت رویدادهای فروش
// ============================================

/*
در OrderController یا کجای سفارش ثبت می‌شود:

const orderController = {
  createOrder: async (req, res) => {
    try {
      // ایجاد سفارش
      const order = new Order({...})
      await order.save()

      // ثبت رویدادهای فروش برای هر item
      for (const item of order.items) {
        await SalesEvent.create({
          product_id: item.product_id,
          order_id: order._id,
          quantity: item.quantity,
          revenue: item.price * item.quantity,
          margin_pct: item.margin || 0,
          sold_at: new Date(),
        })
      }

      res.json({ success: true, order })
    } catch (error) {
      res.status(500).json({ success: false, error })
    }
  }
}
*/

// ============================================
// مرحله 6: بروزرسانی آمار محصول
// ============================================

/*
اطمینان حاصل کنید که:

1. Product.model شامل avg_rating و review_count است ✓
2. Product.model شامل created_at است ✓
3. Product.model شامل is_active است ✓

اگر نیست، از زیر استفاده کنید:

const productSchema = new mongoose.Schema({
  // ...
  average_rating: { type: Number, min: 0, max: 5, default: 0 },
  review_count: { type: Number, min: 0, default: 0 },
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
})
*/

// ============================================
// مرحله 7: تنظیمات Redis (اختیاری)
// ============================================

/*
برای بهترین کارایی، Redis راه‌اندازی کنید:

// در utils/redis.js
const redis = require('redis')
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
})

client.on('error', (err) => console.log('Redis error:', err))
client.on('connect', () => console.log('Redis connected'))

module.exports = client

// اگر Redis نباشد، سیستم بدون کش هم کار می‌کند (کند‌تر)
*/

// ============================================
// مرحله 8: متغیرهای محیطی
// ============================================

/*
در .env یا .env.local اضافه کنید:

# Backend
MONGODB_URI=mongodb://localhost:27017/ekgkala
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=production

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Jobs
CRON_ENABLED=true
CRON_INTERVAL=30 # دقیقه
*/

// ============================================
// مرحله 9: تست بخش
// ============================================

/*
برای تست صحیح‌کاری:

1. شروع Backend:
   npm start

2. بررسی Database:
   db.productscore.find({}).limit(1) // باید رکوردی وجود داشته باشد

3. تست API:
   curl http://localhost:5000/api/v1/products/bestsellers

4. بررسی Frontend:
   http://localhost:3000/
   # باید بخش پرفروش‌ترین‌ها مرئی باشد

5. بررسی Cron:
   # در لاگ‌های Backend باید هر 30 دقیقه:
   # "[BestSellers Cron] شروع محاسبه امتیازات"
   # "[BestSellers Cron] ✅ محاسبه تمام شد"
*/

// ============================================
// مرحله 10: نگاهداری و بهینه‌سازی
// ============================================

/*
KPI هایی که باید مراقبت شوند:

1. CTR بخش (Click Through Rate)
   - هدف: > 8%
   - ابزار: Google Analytics

2. نرخ تبدیل
   - هدف: > 3%
   - ابزار: Backend logs

3. تنوع دسته‌بندی
   - هدف: حداقل 3 دسته
   - ابزار: Dashboard ادمین

4. موجودی محصولات
   - هدف: 100%
   - ابزار: Inventory system

5. بروزرسانی بخش
   - هدف: هر ۲ ساعت
   - ابزار: Cron logs

اگر KPI ها خراب شد:
- تنظیمات وزن‌های فرمول را تغییر دهید
- TimeDecay ضریب را تنظیم کنید
- نطاق زمانی را بررسی کنید
*/

module.exports = {
  setupSteps: [
    '1. ایجاد Models (ProductScore, SalesEvent, ProductView)',
    '2. ادغام Routes',
    '3. شروع Cron Jobs',
    '4. ادغام BestSellers Component',
    '5. ثبت SalesEvents از OrderController',
    '6. تنظیم محیط (ENV variables)',
    '7. تست و Debugging',
    '8. نگاهداری مداوم',
  ],
}
