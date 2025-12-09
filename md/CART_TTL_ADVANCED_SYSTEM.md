# سیستم پیشرفته مدیریت سبد خرید (Advanced Cart TTL System)

## نمای کلی

این سند توضیحات کاملی از سیستم پیشرفته مدیریت سبد خرید ارائه می‌دهد که شامل انقضای خودکار، سبدهای ماندگار، و سیستم هوشمند هشدار قبل از انقضاست.

## ویژگی‌های اصلی

### 1. مدیریت انعطاف‌پذیر مهلت زمانی
- **مهلت قابل تنظیم**: از 30 دقیقه تا 7 روز
- **سبدهای ماندگار**: امکان غیرفعال کردن کامل انقضا
- **فعال/غیرفعال کردن**: کنترل کامل بر روی انقضای خودکار

### 2. سیستم هشدار هوشمند قبل از انقضا
- **اعلان خودکار**: ارسال هشدار به کاربران قبل از انقضای سبد
- **زمان قابل تنظیم**: تعیین دقیق زمان ارسال هشدار (5-120 دقیقه)
- **چند کاناله**: ارسال همزمان ایمیل و پیامک
- **ارسال دستی**: امکان ارسال فوری توسط ادمین

### 3. ابزارهای مدیریتی پیشرفته
- **حذف دستی سبدها**: امکان حذف تک‌تک سبدها توسط ادمین
- **پاکسازی انبوه**: حذف دسته‌جمعی سبدهای منقضی شده
- **آمار و گزارش**: نمایش وضعیت سبدهای رها شده

## ساختار دیتابیس

### مدل Cart (به‌روزرسانی شده)

```javascript
{
  // فیلدهای اصلی
  user: ObjectId,
  items: [CartItem],
  totalPrice: Number,
  status: String, // 'active', 'converted', 'abandoned'

  // فیلدهای مدیریت انقضا
  expiresAt: {
    type: Date,
    index: true,
  },
  isExpired: {
    type: Boolean,
    default: false,
    index: true,
  },

  // فیلد جدید: ردیابی هشدار
  expiryWarningSent: {
    type: Boolean,
    default: false,
    index: true,
  },
}
```

**متدهای مدل:**

```javascript
// تنظیم زمان انقضا
cart.setExpiry(hours)

// بررسی وضعیت انقضا
cart.checkExpiry()

// محاسبه مجموع قیمت
cart.calculateTotal()
```

### مدل Settings (به‌روزرسانی شده)

```javascript
{
  cartSettings: {
    // تنظیمات اصلی
    cartTTLHours: {
      type: Number,
      default: 1,
      min: 0.5,
      max: 168,
    },
    autoExpireEnabled: {
      type: Boolean,
      default: true,
    },
    autoDeleteExpired: {
      type: Boolean,
      default: false,
    },

    // تنظیمات جدید
    permanentCart: {
      type: Boolean,
      default: false,
    },
    expiryWarningEnabled: {
      type: Boolean,
      default: false,
    },
    expiryWarningMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 120,
    },
  }
}
```

## API Endpoints

### 1. حذف سبد خرید

```http
DELETE /api/carts/admin/:cartId
Authorization: Bearer <admin_token>
```

**پاسخ:**
```json
{
  "success": true,
  "message": "سبد خرید با موفقیت حذف شد",
  "data": {
    "deletedCartId": "...",
    "user": "..."
  }
}
```

**تغییرات از نسخه قبل:**
- استفاده از `findByIdAndDelete` به جای `deleteOne` برای حذف مطمئن‌تر
- بازگشت اطلاعات سبد حذف شده

### 2. پاکسازی سبدهای منقضی

```http
POST /api/carts/admin/cleanup
Authorization: Bearer <admin_token>
```

**پاسخ:**
```json
{
  "success": true,
  "message": "15 سبد خرید منقضی شده پاکسازی شد",
  "count": 15
}
```

### 3. ارسال هشدارهای انقضا (جدید)

```http
POST /api/carts/admin/send-warnings
Authorization: Bearer <admin_token>
```

**عملکرد:**
1. بررسی فعال بودن سیستم هشدار در تنظیمات
2. جستجوی سبدهایی که در آستانه انقضا هستند
3. ارسال ایمیل و پیامک به کاربران
4. علامت‌گذاری سبدها به عنوان "هشدار ارسال شده"

**پاسخ:**
```json
{
  "success": true,
  "message": "هشدار انقضا برای 8 سبد خرید ارسال شد",
  "count": 8,
  "totalFound": 10,
  "errors": []
}
```

## منطق عملکرد سیستم

### 1. زمان ایجاد/به‌روزرسانی سبد

```javascript
// در addOrUpdateItem controller
cart.calculateTotal()

const cartSettings = await getCartSettings()

if (cartSettings.permanentCart) {
  // حالت ماندگار: بدون انقضا
  cart.expiresAt = null
  cart.isExpired = false
  cart.expiryWarningSent = false

} else if (cartSettings.autoExpireEnabled) {
  // حالت عادی: با مهلت زمانی
  cart.setExpiry(cartSettings.ttlHours)
  cart.expiryWarningSent = false // ریست کردن flag هشدار
}

await cart.save()
```

**نکات مهم:**
- هر بار که سبد به‌روزرسانی می‌شود، زمان انقضا تمدید می‌شود
- Flag هشدار (`expiryWarningSent`) ریست می‌شود
- اگر حالت ماندگار فعال باشد، `expiresAt` به `null` تنظیم می‌شود

### 2. سیستم ارسال هشدار

```javascript
// در sendExpiryWarnings controller
const cartSettings = await getCartSettings()

// محاسبه زمان هشدار
const now = new Date()
const warningTime = new Date(
  now.getTime() + cartSettings.expiryWarningMinutes * 60 * 1000
)

// پیدا کردن سبدهای نیازمند هشدار
const cartsNearExpiry = await Cart.find({
  status: 'active',
  isExpired: false,
  expiryWarningSent: false, // فقط سبدهایی که هشدار ندیده‌اند
  expiresAt: {
    $lte: warningTime, // کمتر از یا مساوی زمان هشدار
    $gt: now,          // اما هنوز منقضی نشده
  },
})

// ارسال هشدار به هر کاربر
for (const cart of cartsNearExpiry) {
  const minutesRemaining = Math.floor(
    (new Date(cart.expiresAt) - now) / (60 * 1000)
  )

  // ارسال ایمیل
  await sendReminderEmail(user.email, {
    userName: user.name,
    itemCount: cart.items.length,
    totalPrice: cart.totalPrice,
    expiryMinutes: minutesRemaining,
    isWarning: true, // نشان‌دهنده هشدار انقضا
  })

  // ارسال پیامک
  await sendReminderSMS(user.phone, {
    userName: user.name,
    itemCount: cart.items.length,
    expiryMinutes: minutesRemaining,
    isWarning: true,
  })

  // علامت‌گذاری
  await Cart.findByIdAndUpdate(cart._id, {
    expiryWarningSent: true,
  })
}
```

**نکات کلیدی:**
- هر سبد فقط یک بار هشدار دریافت می‌کند
- هشدار فقط برای سبدهایی ارسال می‌شود که هنوز منقضی نشده‌اند
- محاسبه دقیق دقایق باقی‌مانده برای نمایش به کاربر

### 3. کوئری‌های بهینه

```javascript
// برای یافتن سبدهای نزدیک به انقضا
db.carts.find({
  status: 'active',
  isExpired: false,
  expiryWarningSent: false,
  expiresAt: {
    $lte: warningTime,
    $gt: now,
  },
}).hint({ expiresAt: 1, isExpired: 1 })
```

**بهینه‌سازی‌ها:**
- استفاده از compound index: `{ expiresAt: 1, isExpired: 1 }`
- Index روی `expiryWarningSent` برای فیلتر سریع
- استفاده از `.lean()` برای کاهش overhead

## رابط کاربری Admin

### صفحه تنظیمات

**مسیر:** `/settings` → تب "تنظیمات سبد خرید"

#### بخش 1: تنظیمات اصلی

**1. سبدهای خرید ماندگار**
```
[Switch] سبدهای خرید ماندگار (بدون انقضا)
```
- وقتی فعال است، تمام فیلدهای زیر غیرفعال می‌شوند
- سبدها هیچ‌گاه منقضی نمی‌شوند

**2. مدت زمان نگهداری**
```
[InputNumber 0.5-168] مدت زمان نگهداری سبد خرید (ساعت)
```
- فعال فقط وقتی که "ماندگار" غیرفعال است
- پیش‌فرض: 1 ساعت

**3. فعال‌سازی انقضای خودکار**
```
[Switch] فعال‌سازی انقضای خودکار
```
- کنترل کلی سیستم انقضا
- فعال فقط وقتی که "ماندگار" غیرفعال است

**4. حذف خودکار**
```
[Switch] حذف خودکار سبدهای منقضی شده
```
- توصیه نمی‌شود (به دلیل از دست رفتن داده‌های تحلیلی)

#### بخش 2: هشدار انقضا

**1. فعال‌سازی هشدار**
```
[Switch] فعال‌سازی هشدار قبل از انقضا
```
- کنترل کلی سیستم هشدار
- فعال فقط وقتی که "ماندگار" غیرفعال است

**2. زمان ارسال هشدار**
```
[InputNumber 5-120] زمان ارسال هشدار (دقیقه قبل از انقضا)
```
- فعال فقط وقتی هشدار فعال است
- پیش‌فرض: 30 دقیقه

**3. ارسال دستی**
```
[Button] ارسال دستی هشدارهای انقضا (همین الان)
```
- نمایش فقط وقتی هشدار فعال است
- ارسال فوری هشدار برای همه سبدهای نزدیک به انقضا

### رفتار پویا UI

```javascript
// وقتی "ماندگار" فعال شود:
- فیلد "مدت زمان نگهداری" → disabled
- سوئیچ "انقضای خودکار" → disabled
- سوئیچ "حذف خودکار" → disabled
- سوئیچ "هشدار انقضا" → disabled
- فیلد "زمان هشدار" → disabled
- دکمه "ارسال هشدار" → مخفی شود

// وقتی "هشدار انقضا" غیرفعال شود:
- فیلد "زمان هشدار" → disabled
- دکمه "ارسال هشدار" → مخفی شود
```

## سناریوهای استفاده

### سناریو 1: فروشگاه با محصولات محدود

**تنظیمات پیشنهادی:**
```yaml
cartTTLHours: 1
autoExpireEnabled: true
permanentCart: false
expiryWarningEnabled: true
expiryWarningMinutes: 30
```

**دلیل:**
- مهلت کوتاه (1 ساعت) برای آزادسازی سریع موجودی
- هشدار 30 دقیقه قبل برای فرصت تکمیل خرید

### سناریو 2: فروشگاه دیجیتال بدون محدودیت موجودی

**تنظیمات پیشنهادی:**
```yaml
cartTTLHours: 168 (7 روز)
autoExpireEnabled: true
permanentCart: false
expiryWarningEnabled: false
```

**دلیل:**
- مهلت طولانی برای تصمیم‌گیری بهتر
- بدون نیاز به هشدار (موجودی نامحدود)

### سناریو 3: سایت B2B با سفارشات بزرگ

**تنظیمات پیشنهادی:**
```yaml
permanentCart: true
```

**دلیل:**
- نیاز به زمان طولانی برای بررسی و تایید
- سبد باید تا زمان تکمیل باقی بماند

### سناریو 4: فروشگاه معمولی با رویکرد متعادل

**تنظیمات پیشنهادی:**
```yaml
cartTTLHours: 2
autoExpireEnabled: true
permanentCart: false
expiryWarningEnabled: true
expiryWarningMinutes: 30
```

**دلیل:**
- تعادل بین تجربه کاربری و مدیریت منابع
- هشدار برای کاهش نرخ رهاشدگی

## پیاده‌سازی Cron Job (اختیاری)

### روش 1: استفاده از node-cron

**نصب:**
```bash
npm install node-cron
```

**پیاده‌سازی در server.js:**

```javascript
const cron = require('node-cron')
const axios = require('axios')

// هر 15 دقیقه یک بار بررسی و ارسال هشدار
cron.schedule('*/15 * * * *', async () => {
  try {
    console.log('🔔 بررسی سبدهای نزدیک به انقضا...')

    // فراخوانی endpoint هشدار
    const response = await axios.post(
      'http://localhost:5000/api/carts/admin/send-warnings',
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
        },
      }
    )

    const { count } = response.data
    console.log(`✅ هشدار برای ${count} سبد ارسال شد`)

  } catch (error) {
    console.error('❌ خطا در ارسال هشدارها:', error.message)
  }
})

// هر روز ساعت 3 صبح پاکسازی سبدهای منقضی
cron.schedule('0 3 * * *', async () => {
  try {
    console.log('🧹 پاکسازی سبدهای منقضی شده...')

    const response = await axios.post(
      'http://localhost:5000/api/carts/admin/cleanup',
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
        },
      }
    )

    const { count } = response.data
    console.log(`✅ ${count} سبد خرید پاکسازی شد`)

  } catch (error) {
    console.error('❌ خطا در پاکسازی:', error.message)
  }
})
```

### روش 2: استفاده از سرویس‌های خارجی

**گزینه‌ها:**
- **cron-job.org**: سرویس رایگان برای اجرای وظایف زمان‌بندی شده
- **EasyCron**: پنل ساده برای مدیریت cron jobها
- **AWS Lambda + CloudWatch**: برای استقرار در AWS

**نمونه تنظیمات:**
```
URL: https://your-api.com/api/carts/admin/send-warnings
Method: POST
Schedule: */15 * * * * (هر 15 دقیقه)
Headers:
  Authorization: Bearer YOUR_ADMIN_TOKEN
```

## نکات امنیتی

### 1. احراز‌هویت
```javascript
router.post(
  '/admin/send-warnings',
  protect,  // بررسی token
  authorize('admin', 'manager', 'superadmin'),  // بررسی نقش
  sendExpiryWarnings,
)
```

### 2. محدودیت نرخ (Rate Limiting)

```javascript
const rateLimit = require('express-rate-limit')

const warningLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقیقه
  max: 1, // حداکثر 1 درخواست
  message: 'لطفاً 15 دقیقه صبر کنید',
})

router.post(
  '/admin/send-warnings',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  warningLimiter,
  sendExpiryWarnings,
)
```

### 3. Token مخصوص Cron Job

```javascript
// در .env
CRON_SECRET_TOKEN=your-super-secret-cron-token

// در middleware
const cronAuth = (req, res, next) => {
  const token = req.headers['x-cron-secret']

  if (token === process.env.CRON_SECRET_TOKEN) {
    return next()
  }

  // اگر نه، بررسی عادی
  return protect(req, res, next)
}
```

## مانیتورینگ و لاگ‌ها

### لاگ‌های مهم

```javascript
// در sendExpiryWarnings
console.log('[CART-WARNING]', {
  timestamp: new Date(),
  totalFound: cartsNearExpiry.length,
  successCount,
  errorCount: errors.length,
  settings: {
    enabled: cartSettings.expiryWarningEnabled,
    minutes: cartSettings.expiryWarningMinutes,
  },
})

// در cleanupExpiredCarts
console.log('[CART-CLEANUP]', {
  timestamp: new Date(),
  expiredCount: expiredCarts.length,
  settings: {
    autoDelete: cartSettings.autoDeleteExpired,
  },
})
```

### متریک‌های کلیدی

1. **تعداد هشدارهای ارسالی**: برای ارزیابی تاثیر
2. **نرخ موفقیت ارسال**: برای شناسایی مشکلات
3. **زمان پاسخ**: برای بهینه‌سازی
4. **نرخ تبدیل پس از هشدار**: برای سنجش اثربخشی

## خطایابی

### مشکل: هشدارها ارسال نمی‌شوند

**بررسی‌ها:**
1. آیا `expiryWarningEnabled` فعال است؟
```javascript
const settings = await Settings.findOne({ singletonKey: 'main_settings' })
console.log(settings.cartSettings.expiryWarningEnabled)
```

2. آیا سبدهای واجد شرایط وجود دارند؟
```javascript
const now = new Date()
const warningTime = new Date(now.getTime() + 30 * 60 * 1000)

const count = await Cart.countDocuments({
  status: 'active',
  isExpired: false,
  expiryWarningSent: false,
  expiresAt: { $lte: warningTime, $gt: now },
})

console.log('سبدهای واجد شرایط:', count)
```

3. آیا سرویس ایمیل/پیامک کار می‌کند؟

### مشکل: حذف سبد خطا می‌دهد

**راه‌حل:**
- استفاده از `findByIdAndDelete` به جای `deleteOne`
- بررسی وجود سبد قبل از حذف
- لاگ کردن خطاهای دقیق

```javascript
try {
  const cart = await Cart.findByIdAndDelete(cartId)
  if (!cart) {
    return res.status(404).json({ message: 'سبد یافت نشد' })
  }
} catch (error) {
  console.error('Delete error:', error)
  return res.status(500).json({ message: error.message })
}
```

## نتیجه‌گیری

این سیستم پیشرفته امکانات زیر را فراهم می‌کند:

✅ **انعطاف‌پذیری کامل**: از سبدهای 30 دقیقه‌ای تا ماندگار
✅ **هوشمند**: هشدار خودکار قبل از انقضا
✅ **قابل مدیریت**: ابزارهای دستی برای ادمین
✅ **بهینه**: استفاده از indexها و کوئری‌های کارآمد
✅ **امن**: احراز هویت و مجوزهای دقیق
✅ **قابل رصد**: لاگ‌ها و متریک‌های جامع

با استفاده صحیح از این سیستم، می‌توانید:
- نرخ رهاشدگی سبد را کاهش دهید
- تجربه کاربری را بهبود بخشید
- منابع سرور را بهینه مدیریت کنید
- درآمد فروشگاه را افزایش دهید
