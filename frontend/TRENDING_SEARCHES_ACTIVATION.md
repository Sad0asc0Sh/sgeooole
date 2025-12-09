# راهنمای فعال‌سازی بخش محبوب‌ترین جستجوها

## وضعیت فعلی ✅
بخش "محبوب‌ترین جستجوها" در صفحه جستجو موقتاً غیرفعال شده است زیرا سایت تازه راه‌اندازی شده و داده‌های کافی برای نمایش جستجوهای محبوب وجود ندارد.

**معماری کامل پیاده‌سازی شده است** و شامل:
- ✅ Frontend component با state management
- ✅ API endpoints برای دریافت trending searches
- ✅ سیستم tracking جستجوها برای analytics
- ✅ MongoDB aggregation برای محاسبه محبوب‌ترین‌ها
- ✅ Cache و optimization

## معماری سیستم

### Backend API
فایل: `welfvita-backend/routes/search.js`

**Endpoints:**
1. `GET /api/search/trending` - دریافت محبوب‌ترین جستجوها
2. `POST /api/search/track` - ثبت جستجو برای analytics
3. `GET /api/search/suggestions` - پیشنهادات جستجو

### Frontend Service
فایل: `frontend/src/services/searchService.ts`

**توابع:**
- `getTrendingSearches(limit)` - دریافت لیست محبوب‌ترین‌ها
- `trackSearch(term)` - ثبت جستجو
- `getSearchSuggestions(query)` - دریافت پیشنهادات

### Component
فایل: `frontend/src/components/features/search/MobileSearchOverlay.tsx`

## نحوه فعال‌سازی

### مرحله 1: فعال‌سازی Feature Flag
در فایل `frontend/src/components/features/search/MobileSearchOverlay.tsx`، خط 11 را تغییر دهید:

```typescript
// قبل:
const ENABLE_TRENDING_SEARCHES = false;

// بعد:
const ENABLE_TRENDING_SEARCHES = true;
```

### مرحله 2: بررسی Database
مطمئن شوید که collection `search_history` در MongoDB ایجاد شده است.

```javascript
// در MongoDB shell یا Compass:
use welfvita

// بررسی تعداد جستجوها
db.search_history.countDocuments()

// مشاهده نمونه داده‌ها
db.search_history.find().limit(10)
```

### مرحله 3: Index برای Performance (اختیاری اما توصیه می‌شود)
برای بهینه‌سازی کوئری‌ها، index اضافه کنید:

```javascript
// در MongoDB
db.search_history.createIndex({ createdAt: -1 })
db.search_history.createIndex({ searchTerm: 1, createdAt: -1 })
```

## چگونه کار می‌کند؟

### 1. ثبت جستجوها
هر بار که کاربر جستجو می‌کند:
```typescript
// خودکار فراخوانی می‌شود
searchService.trackSearch(searchTerm)
```

این یک رکورد در `search_history` ایجاد می‌کند:
```javascript
{
  searchTerm: "آیفون 14",
  userId: "...", // اگر کاربر لاگین باشد
  createdAt: ISODate("2025-12-09T...")
}
```

### 2. محاسبه محبوب‌ترین‌ها
API endpoint با MongoDB aggregation محبوب‌ترین‌ها را محاسبه می‌کند:
```javascript
// از 30 روز اخیر
// Group by searchTerm
// Sort by count
// Top 8 نتیجه
```

### 3. نمایش در UI
Component از API دریافت کرده و نمایش می‌دهد:
```typescript
const trending = await searchService.getTrendingSearches(8);
setTrendingSearches(trending);
```

## توصیه‌ها برای Production

### 1. Cache Strategy
برای کاهش load روی database، از caching استفاده کنید:

```javascript
// در search.js
const CACHE_DURATION = 30 * 60 * 1000; // 30 دقیقه
let trendingCache = { data: [], timestamp: 0 };

router.get('/trending', async (req, res) => {
    const now = Date.now();
    
    // استفاده از cache اگر fresh باشد
    if (now - trendingCache.timestamp < CACHE_DURATION) {
        return res.json({
            success: true,
            trending: trendingCache.data,
            cached: true
        });
    }
    
    // ... دریافت از database
    trendingCache = { data: trending, timestamp: now };
});
```

### 2. زمان‌بندی مناسب برای فعال‌سازی
قبل از فعال‌سازی:
- ✅ حداقل **100+ کاربر فعال** داشته باشید
- ✅ داده‌های جستجو را برای **2-4 هفته** جمع‌آوری کنید
- ✅ حداقل **500+ جستجو** در database داشته باشید

### 3. Cleanup قدیمی‌ها (اختیاری)
برای مدیریت حجم database:

```javascript
// یک cron job برای پاک‌سازی جستجوهای قدیمی‌تر از 90 روز
db.search_history.deleteMany({
    createdAt: {
        $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
})
```

### 4. Rate Limiting
برای جلوگیری از abuse:

```javascript
// در routes/search.js
const rateLimit = require('express-rate-limit');

const trackLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 دقیقه
    max: 10, // حداکثر 10 track در دقیقه
    message: 'تعداد درخواست‌ها زیاد است'
});

router.post('/track', trackLimiter, async (req, res) => {
    // ...
});
```

## مانیتورینگ و Analytics

### بررسی عملکرد
```javascript
// تعداد کل جستجوها
db.search_history.countDocuments()

// محبوب‌ترین جستجوها در 7 روز اخیر
db.search_history.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) }}},
    { $group: { _id: '$searchTerm', count: { $sum: 1 }}},
    { $sort: { count: -1 }},
    { $limit: 20 }
])
```

## Troubleshooting

### مشکل: هیچ trending نمایش داده نمی‌شود
```bash
# بررسی کنید:
1. ENABLE_TRENDING_SEARCHES = true است؟
2. Backend روی http://localhost:5000 در حال اجرا است؟
3. Collection search_history داده دارد؟
4. Console errors وجود دارد؟
```

### مشکل: APi خطا می‌دهد
```bash
# لاگ backend را بررسی کنید
# مطمئن شوید MongoDB متصل است
# Index های لازم را ایجاد کنید
```

---
*آخرین به‌روزرسانی: 2025-12-09*  
*توسط: Antigravity AI*  
*وضعیت: ✅ Production Ready - منتظر داده کافی*

