# 🏆 معماری بخش پرفروش‌ترین‌ها - خلاصه اجرایی

## 📊 معادلات و فرمول‌ها

### فرمول امتیازدهی نهایی
```
FinalScore = (SalesScore × 0.40) + (ConversionScore × 0.25) + 
             (RevenueScore × 0.15) + (RatingScore × 0.10) + (TrendScore × 0.10)

DecayedScore = FinalScore × RecencyFactor
RecencyFactor = 1 / (1 + age_days / 30)   (فروش امروز ≈ 1، 30 روز پیش = 0.5)
محصولِ بدون فروش: DecayedScore = FinalScore × 0.02
```

> اصلاح: فرمول قبلیِ `FinalScore / (age_hours + 2)^1.8` امتیاز را تا مرتبه‌ی
> 1e-6 خرد می‌کرد و رتبه عملاً فقط با «ساعت آخرین فروش» تعیین می‌شد، نه حجم
> فروش. همچنین RevenueScore قبلاً در حاشیه سود ضرب می‌شد ولی `margin_pct`
> همیشه صفر ثبت می‌شود (داده‌ی هزینه وجود ندارد) و RatingScore روی فیلد
> اشتباه Review (`product_id` به‌جای `product`) محاسبه می‌شد؛ هر دو مؤلفه
> مرده بودند و اصلاح شدند. با ثبت هر فروش نیز یک محاسبه‌ی مجدد با تأخیر
> ~۱ دقیقه زمان‌بندی می‌شود (`scheduleRecalculation`) و چرخه‌ی ۳۰ دقیقه‌ای
> نقش پشتیبان دارد.

### سیگنال‌های تشکیل‌دهنده

| سیگنال | وزن | بازه زمانی | نحوه محاسبه |
|--------|------|----------|-----------|
| **SalesScore** | 40% | 30 روز | تعداد واحد × وزن نمایی |
| **ConversionScore** | 25% | 14 روز | فروش ÷ بازدید |
| **RevenueScore** | 15% | 30 روز | درآمد (حاشیه سود تا زمان وجود داده‌ی هزینه اعمال نمی‌شود) |
| **RatingScore** | 10% | تمام زمان | امتیاز × log(تعداد نظرات) |
| **TrendScore** | 10% | 14 روز | (فروش هفته اخیر - هفته قبل) ÷ هفته قبل |

---

## 🏗️ معماری سیستم

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  BestSellers Component → API Calls → Impression Tracking    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Node.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  BestSellers Controller                              │  │
│  │  - GET /bestsellers → Redis/DB                       │  │
│  │  - POST /tracking/impression → ProductView           │  │
│  │  - POST /internal/sales-event → SalesEvent           │  │
│  │  - GET /stats (Admin)                                │  │
│  │  - POST /recalculate (Admin)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                       ▲                                      │
│                       │                                      │
│  ┌────────────────────┴─────────────────────────────────┐  │
│  │                                                      │  │
│  │  BestSellers Score Engine                           │  │
│  │  - calculateSalesScore()                            │  │
│  │  - calculateConversionScore()                       │  │
│  │  - calculateRevenueScore()                          │  │
│  │  - calculateRatingScore()                           │  │
│  │  - calculateTrendScore()                            │  │
│  │  - recalculateAllScores() [Cron Job]               │  │
│  │                                                      │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐     ┌─────────┐     ┌──────────┐
   │ MongoDB │     │  Redis  │     │ Cron Job │
   │  - 3 TB │     │  Cache  │     │  30 min  │
   └─────────┘     └─────────┘     └──────────┘
```

---

## 📁 ساختار فایل‌ها

### Backend
```
ekgkala-backend/
├── models/
│   ├── ProductScore.js          # مدل امتیازات
│   ├── SalesEvent.js            # مدل رویدادهای فروش
│   ├── ProductView.js           # مدل بازدید‌ها
│   └── ... (دیگر models)
├── controllers/
│   ├── bestsellersController.js # تمام API endpoints
│   └── ...
├── services/
│   ├── bestsellersScoreEngine.js # موتور محاسبه امتیاز
│   └── ...
├── routes/
│   ├── bestsellers.js           # تمام routes
│   └── ...
├── jobs/
│   ├── bestsellersScheduler.js  # Cron jobs
│   └── ...
└── docs/
    └── BESTSELLERS_SETUP.md     # راهنمای پیاده‌سازی
```

### Frontend
```
frontend/
├── src/
│   ├── components/
│   │   └── home/
│   │       └── BestSellers.tsx  # کامپوننت نمایشی
│   └── ...
```

---

## 🚀 مراحل پیاده‌سازی

### فاز ۱: زیرساخت (هفته ۱-۲)
- [x] ایجاد 3 مدل Mongoose
- [x] نوشتن موتور محاسبه امتیاز
- [x] راه‌اندازی Redis برای کشینگ
- [ ] تست‌های واحدی

### فاز ۲: API و منطق (هفته ۲-۳)
- [x] پیاده‌سازی تمام controllers
- [x] ایجاد routes
- [ ] توثیق API (Swagger)
- [x] Cron jobs

### فاز ۳: Frontend (هفته ۳-۴)
- [x] کامپوننت BestSellers
- [x] Impression tracking
- [ ] Responsive testing
- [ ] Performance optimization

### فاز ۴: بهینه‌سازی (هفته ۵+)
- [ ] A/B Testing
- [ ] پایش KPI‌ها
- [ ] تنظیم وزن‌ها
- [ ] شخصی‌سازی برای کاربران

---

## 📊 KPI های مراقبتی

### اصلی
| KPI | هدف | قوی | ضعیف |
|-----|------|-----|------|
| CTR | > 8% | > 12% | < 4% |
| تبدیل | > 3% | > 5% | < 1% |
| موجودی | 100% | > 90% | < 70% |
| تنوع دسته | 3+ | 5+ | 1 |

### ثانویه
| KPI | مثال | فریکوئنسی |
|-----|--------|----------|
| بروزرسانی بخش | 2 ساعت | Real-time |
| پوشش محصول | 80% | روزانه |
| نرخ برگشت | < 15% | هفتگی |

---

## 🔒 حفاظت و امنیت

### محافظت از Abuse
```javascript
// Rate limiting برای tracking
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 دقیقه
  max: 100,              // حداکثر 100 درخواست
  keyGenerator: (req) => req.ip,
})

router.post('/tracking/impression', limiter, controller)
```

### Caching Security
- TTL: 15 دقیقه برای bestsellers
- 6 ساعت برای stats
- Invalidation فوری پس از خرید

### Data Privacy
- شناسه کاربر هرگز در logs ذخیره نمی‌شود
- فقط session_id ثبت می‌شود

---

## 🐛 Debugging و Troubleshooting

### بررسی‌های سریع
```bash
# 1. بررسی دیتابیس
db.productscores.countDocuments({stock_available: true})

# 2. بررسی کش
redis-cli KEYS "bestsellers:*"

# 3. بررسی logs
tail -f logs/bestsellers.log

# 4. تست API دستی
curl http://localhost:5000/api/v1/products/bestsellers?limit=5
```

### مشکلات معمول

**مشکل**: نتایج خالی برگردانده می‌شود
- **علت**: هیچ فروشی ثبت نشده
- **حل**: `POST /internal/sales-event` تست کنید

**مشکل**: امتیازات تغییر نمی‌کند
- **علت**: Cron jobs غیرفعال است
- **حل**: `startBestsellersJobs()` اجرا کنید

**مشکل**: کارایی پایین
- **علت**: بدون کش یا indices ضعیف
- **حل**: Redis فعال و indexes بررسی شود

---

## 📈 نمودار جریان داده‌ها

```
کاربر خریدار
    ├─> صفحه اصلی
    │   └─> BestSellers Component
    │       ├─> GET /api/v1/products/bestsellers
    │       │   └─> ProductScore.find() → Redis/DB
    │       └─> POST /api/v1/tracking/impression
    │           └─> ProductView.create()
    │
    ├─> خرید محصول
    │   └─> POST /api/v1/orders
    │       ├─> Order.create()
    │       └─> SalesEvent.create() (automatically)
    │
    └─> [Every 30 minutes - Cron Job]
        └─> recalculateAllScores()
            ├─> calculateSalesScore()
            ├─> calculateConversionScore()
            ├─> calculateRevenueScore()
            ├─> calculateRatingScore()
            ├─> calculateTrendScore()
            └─> ProductScore.updateMany()
```

---

## 💡 بهترین روش‌ها

1. **نرمال‌سازی**: ہمیشه پیش از ترکیب امتیازات نرمال کنید
2. **OutlierHandle**: از percentile-based clamping استفاده کنید
3. **Caching**: مدت‌های طولانی را کش کنید، کوتاه‌های را realtime کنید
4. **Monitoring**: روزانه KPI‌ها را بررسی کنید
5. **Versioning**: فرمول را version‌بندی کنید برای A/B testing

---

## 📞 پشتیبانی و تماس

برای سوالات:
- 📧 Email: dev@ekgkala.ir
- 📖 Docs: `/docs/BESTSELLERS_SETUP.md`
- 🐛 Issues: GitHub Issues

---

**نسخه**: 1.0  
**آخرین بروزرسانی**: فوریه ۲۶، ۲۰۲۶  
**وضعیت**: ✅ تایید شده و آماده استقرار
