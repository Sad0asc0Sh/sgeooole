# 🔧 راهنمای رفع مشکل پیامک در Production (ekgkala.ir)

## 📋 خلاصه مشکل
پیامک در محیط محلی کار می‌کند اما در production (ekgkala.ir) ارسال نمی‌شود.

---

## ✅ راه‌حل‌های عملی

### روش 1: بررسی لاگ‌های Railway (بهترین روش)

1. **وارد Railway شوید:**
   - https://railway.app
   
2. **پروژه backend را باز کنید**

3. **برو به تب "Logs"**

4. **یک درخواست OTP از سایت بفرستید:**
   - برو به ekgkala.ir
   - سعی کن لاگین کنی یا ثبت‌نام کنی
   - کدی که نیاز به OTP داره رو امتحان کن

5. **در لاگ‌ها دنبال این پیام‌ها بگرد:**
   ```
   [SMS] نام کاربری یا رمز عبور پنل ملی‌پیامک تنظیم نشده است
   [SMS] ❌ خطا در ارسال پیامک
   تنظیمات پیامک ناقص است
   ```

6. **اگر این پیام رو دیدی:**
   - یعنی تنظیمات در دیتابیس production وارد نشده
   - باید از پنل ادمین تنظیمات رو وارد کنی

---

### روش 2: استفاده از API های تست (جدید)

من سه endpoint تست برات اضافه کردم. بعد از deploy کردن کد جدید، می‌تونی ازشون استفاده کنی:

#### 1️⃣ بررسی وضعیت سیستم
```bash
GET https://api.ekgkala.ir/api/admin/test/health
```
**نیاز به Auth:** بله (توکن admin)

**پاسخ نمونه:**
```json
{
  "success": true,
  "timestamp": "2025-12-24T...",
  "environment": "production",
  "database": "connected",
  "sms": {
    "configured": false,
    "provider": "ملی‌پیامک (Melipayamak)"
  }
}
```

#### 2️⃣ بررسی تنظیمات پیامک
```bash
GET https://api.ekgkala.ir/api/admin/test/sms-settings
```
**نیاز به Auth:** بله (توکن admin)

**پاسخ نمونه:**
```json
{
  "success": true,
  "settings": {
    "smsUsername": "✅ تنظیم شده",
    "smsPassword": "✅ تنظیم شده (8 کاراکتر)",
    "smsSenderNumber": "09001234567"
  },
  "isComplete": true,
  "message": "تنظیمات کامل است"
}
```

#### 3️⃣ تست ارسال پیامک
```bash
POST https://api.ekgkala.ir/api/admin/test/send-sms
Content-Type: application/json

{
  "mobile": "09123456789"
}
```
**نیاز به Auth:** بله (توکن admin)

**پاسخ موفق:**
```json
{
  "success": true,
  "message": "پیامک تست با موفقیت به 09123456789 ارسال شد",
  "code": "123456"
}
```

**پاسخ خطا:**
```json
{
  "success": false,
  "message": "خطا در ارسال پیامک",
  "error": "تنظیمات پیامک ناقص است"
}
```

---

### روش 3: ست کردن تنظیمات از پنل ادمین

1. **برو به:**
   https://admin.ekgkala.ir (یا هر آدرسی که پنل ادمین رو داری)

2. **لاگین بشو** با حساب ادمین

3. **برو به: تنظیمات → اعلان‌ها (Notifications)**

4. **اطلاعات پنل ملی‌پیامک** را وارد کن:
   - نام کاربری (Username)
   - رمز عبور (Password)
   - شماره فرستنده (اختیاری)

5. **دکمه ذخیره** را بزنید و **صبر کنید تا ذخیره شود**

6. **تست کنید:** یک OTP از سایت بخواهید

---

## 🔍 تشخیص مشکل

### سناریو 1: تنظیمات خالی است
**علائم:**
- در لاگ می‌بینی: `تنظیمات پیامک ناقص است`
- API `/test/sms-settings` می‌گه: `isComplete: false`

**راه حل:**
- از پنل ادمین تنظیمات رو وارد کن (روش 3)

---

### سناریو 2: تنظیمات موجود است اما پیامک ارسال نمی‌شود
**علائم:**
- API `/test/sms-settings` می‌گه: `isComplete: true`
- اما در لاگ خطا می‌بینی

**مشکلات احتمالی:**
1. **نام کاربری یا رمز عبور اشتباه است**
   - دوباره از پنل ملی‌پیامک چک کن

2. **اعتبار حساب تمام شده**
   - لاگین کن به پنل: https://panel.payamak-panel.com
   - موجودی رو چک کن

3. **محدودیت IP در پنل ملی‌پیامک**
   - به بخش امنیت پنل برو
   - IP سرور Railway رو add کن
   - یا محدودیت IP رو غیرفعال کن

4. **شماره فرستنده معتبر نیست**
   - از بخش "خطوط من" شماره صحیح رو بردار

5. **Timeout / کندی شبکه (به‌خصوص روی Render/Railway خارج ایران)**
   - اگر در لاگ می‌بینی: `timeout of ...ms exceeded`
   - `SMS_TIMEOUT_MS` رو بیشتر کن (مثلاً 25000 یا 40000)
   - در صورت نیاز از `SMS_PROXY` (SOCKS) داخل ایران استفاده کن تا درخواست‌ها به ملی‌پیامک پایدارتر بشه

---

## 🚀 مراحل Deploy کد جدید

برای استفاده از API های تست، باید کد رو deploy کنی:

### Railway:
```bash
git add .
git commit -m "Add SMS test endpoints"
git push origin main
```

Railway خودکار deploy می‌کند.

---

## 📞 تست با Postman یا Insomnia

### گام 1: دریافت توکن ادمین
```bash
POST https://api.ekgkala.ir/api/auth/admin/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "yourpassword"
}
```

از پاسخ توکن رو بردار:
```json
{
  "success": true,
  "token": "eyJhbGc..."
}
```

### گام 2: بررسی تنظیمات
```bash
GET https://api.ekgkala.ir/api/admin/test/sms-settings
Authorization: Bearer eyJhbGc...
```

### گام 3: تست ارسال
```bash
POST https://api.ekgkala.ir/api/admin/test/send-sms
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "mobile": "09123456789"
}
```

---

## 🔐 امنیت

این API ها **فقط برای ادمین** هستند و نیاز به توکن احراز هویت دارند.

مطمئن شو که:
- توکن رو share نکنی
- این endpoint ها رو در production برای مدت طولانی باز نذاری
- بعد از رفع مشکل، می‌تونی اونها رو حذف کنی

---

## ✅ چک لیست رفع مشکل

- [ ] لاگ‌های Railway رو چک کردم
- [ ] API `/admin/test/health` رو تست کردم
- [ ] API `/admin/test/sms-settings` رو چک کردم و `isComplete: true` دیدم
- [ ] از پنل ادمین تنظیمات رو وارد کردم
- [ ] اعتبار حساب ملی‌پیامک رو چک کردم
- [ ] محدودیت IP در پنل ملی‌پیامک رو غیرفعال کردم
- [ ] API `/admin/test/send-sms` رو تست کردم و موفق بود

---

## 📱 پشتیبانی

اگر همه موارد بالا رو انجام دادی و باز مشکل داری:

1. **پشتیبانی ملی‌پیامک:** 02191004346
2. **لاگ کامل رو بفرست** (از Railway)
3. **خطای دقیق رو بفرست** (از API test)

---

**تاریخ:** 2025-12-24
