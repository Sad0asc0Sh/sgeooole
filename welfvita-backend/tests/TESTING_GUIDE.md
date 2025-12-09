# راهنمای تست سیستم جستجوهای محبوب

## پیش‌نیازها

1. Backend باید در حال اجرا باشد:
```bash
cd welfvita-backend
npm start
```

2. MongoDB باید متصل باشد

## اجرای تست‌ها

### روش 1: اجرای تست کامل
```bash
cd welfvita-backend
node tests/search-system.test.js
```

### روش 2: تست دستی با curl

#### 1. ثبت یک جستجو:
```bash
curl -X POST http://localhost:5000/api/search/track \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "آیفون 14"}'
```

#### 2. دریافت محبوب‌ترین‌ها:
```bash
curl http://localhost:5000/api/search/trending?limit=5
```

#### 3. دریافت تنظیمات:
```bash
curl http://localhost:5000/api/settings/public
```

#### 4. پیشنهادات جستجو:
```bash
curl "http://localhost:5000/api/search/suggestions?q=آیفون&limit=5"
```

### روش 3: تست با Postman

Import این collection به Postman:

**Collection: Trending Searches API**

1. **POST** `/api/search/track`
   - Body (JSON): `{ "searchTerm": "test" }`

2. **GET** `/api/search/trending?limit=8`

3. **GET** `/api/search/suggestions?q=test`

4. **GET** `/api/settings/public`

## بررسی MongoDB

برای مشاهده داده‌های ثبت شده:

```javascript
// در MongoDB Compass یا mongo shell:
use welfvita

// مشاهده تمام جستجوها
db.search_history.find().sort({createdAt: -1}).limit(20)

// تعداد کل جستجوها
db.search_history.countDocuments()

// محبوب‌ترین جستجوها
db.search_history.aggregate([
  { $group: { _id: '$searchTerm', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
])
```

## چک لیست تست

- [ ] Backend روی port 5000 در حال اجرا است
- [ ] MongoDB متصل است
- [ ] Route `/api/search` در server.js  register شده
- [ ] Collection `search_history` در MongoDB موجود است (خودکار ایجاد می‌شود)
- [ ] Settings model شامل `searchSettings` است
- [ ] Frontend می‌تواند به `/api/settings/public` دسترسی داشته باشد

## نتایج مورد انتظار

### تست موفق:
```
═══ تست 1: Health Check ═══
✓ API در حال اجرا است

═══ تست 2: ثبت جستجوها ═══
✓ ثبت جستجو: "آیفون 14"
✓ ثبت جستجو: "سامسونگ"
...

═══ تست 3: دریافت محبوب‌ترین‌ها ═══
✓ دریافت لیست محبوب‌ترین‌ها
ℹ تعداد محبوب‌ترین‌ها: 5
ℹ محبوب‌ترین: آیفون 14, سامسونگ, ...

✓✓✓ همه تست‌ها با موفقیت انجام شد! ✓✓✓
```

## عیب‌یابی

### خطا: `ECONNREFUSED`
- Backend در حال اجرا نیست
- راه‌حل: `cd welfvita-backend && npm start`

### خطا: `MongoError`
- MongoDB disconnect شده
- راه‌حل: MongoDB را restart کنید

### خطا: `Cannot find module`
- axios نصب نیست
- راه‌حل: `npm install axios`

### خطا: `Route not found`
- Search routes register نشده
- راه‌حل: در `server.js` بررسی کنید که این خط وجود دارد:
```javascript
const searchRoutes = require('./routes/search')
app.use('/api/search', searchRoutes)
```

## تست Frontend

1. Frontend را اجرا کنید:
```bash
cd frontend
npm run dev
```

2. صفحه را باز کنید: `http://localhost:3000`

3. دکمه جستجو را کلیک کنید

4. چیزی تایپ کنید و Enter بزنید

5. در MongoDB بررسی کنید که جستجو ثبت شده:
```javascript
db.search_history.find().sort({createdAt: -1}).limit(1)
```

6. در پنل ادمین:
   - به تنظیمات → تنظیمات جستجو بروید
   - "نمایش محبوب‌ترین‌ها" را فعال کنید
   - ذخیره کنید

7. در صفحه جستجو مجدداً بروید
   - باید محبوب‌ترین جستجوها نمایش داده شوند

## مستندات API

مستندات کامل در فایل `TRENDING_SEARCHES_ACTIVATION.md`
