# 🚀 راهنمای راه‌اندازی سیستم پرداخت چندگانه

## ✅ نصب کامل شد!

سیستم پرداخت چندگانه با پشتیبانی از **ZarinPal** و **Sadad** به طور کامل پیاده‌سازی شده است.

---

## 📋 فهرست فایل‌های ایجاد شده

### Backend

```
welfvita-backend/
├── models/
│   ├── Settings.js                    ✅ (به‌روزرسانی شد - ساختار چندگانه)
│   └── Order.js                       ✅ (به‌روزرسانی شد - فیلدهای درگاه)
├── utils/
│   ├── payment/
│   │   ├── zarinpal.js               ✅ جدید - استراتژی ZarinPal
│   │   └── sadad.js                  ✅ جدید - استراتژی Sadad
│   └── paymentService.js             ✅ جدید - Factory Pattern
├── controllers/
│   ├── orderController.js            ✅ (به‌روزرسانی شد - چندگانه)
│   └── settingsController.js         ✅ (به‌روزرسانی شد - چندگانه)
└── routes/
    └── orders.js                      ✅ (به‌روزرسانی شد)
```

### Frontend Admin

```
frontend/src/app/admin/settings/
├── layout.tsx                         ✅ جدید - سیستم تب
├── page.tsx                           ✅ موجود - تنظیمات AI
└── payment/
    └── page.tsx                       ✅ جدید - تنظیمات پرداخت
```

### Frontend User

```
frontend/src/app/
├── checkout/page.tsx                  ✅ (به‌روزرسانی شد)
└── payment/result/page.tsx            ✅ موجود - صفحه نتیجه
```

---

## 🎯 راه‌اندازی گام به گام

### 1️⃣ راه‌اندازی بک‌اند

```bash
cd welfvita-backend
npm install  # axios اضافه شده
npm run dev
```

✅ بک‌اند روی پورت **5000** اجرا می‌شود

---

### 2️⃣ راه‌اندازی فرانت‌اند

```bash
cd frontend
npm run dev
```

✅ فرانت‌اند روی پورت **3000** اجرا می‌شود

---

### 3️⃣ تنظیم متغیرهای محیطی

در فایل `welfvita-backend/.env` اضافه کنید:

```env
FRONTEND_URL=http://localhost:3000
```

این URL برای callback پرداخت استفاده می‌شود.

---

## 🔧 تنظیم درگاه‌های پرداخت

### ورود به پنل ادمین

1. به آدرس `http://localhost:3000/admin` بروید
2. با حساب ادمین وارد شوید
3. از منوی کناری روی **"تنظیمات"** کلیک کنید
4. روی تب **"درگاه‌های پرداخت"** کلیک کنید

---

### ⚡ تنظیم ZarinPal

1. **انتخاب درگاه فعال**: ZarinPal را انتخاب کنید
2. **Merchant ID**: کد 36 رقمی خود را وارد کنید
   - فرمت: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
3. **Sandbox Mode**:
   - ✅ فعال = حالت تست (بدون پرداخت واقعی)
   - ❌ غیرفعال = حالت واقعی
4. **فعال‌سازی**: toggle کنار عنوان کارت را روشن کنید
5. **ذخیره**: دکمه "ذخیره همه تنظیمات" را بزنید

#### 🔑 دریافت Merchant ID از ZarinPal

1. به [panel.zarinpal.com](https://panel.zarinpal.com) بروید
2. وارد شوید
3. منوی **"درگاه پرداخت"** → **"تنظیمات درگاه"**
4. کد 36 رقمی را کپی کنید

---

### 🏦 تنظیم Sadad (بانک ملی)

1. **انتخاب درگاه فعال**: Sadad را انتخاب کنید
2. **Merchant ID**: کد پذیرنده
3. **Terminal ID**: شناسه ترمینال
4. **Terminal Key**: کلید ترمینال (از بانک دریافت می‌شود)
5. **Sandbox Mode**: برای تست فعال کنید
6. **فعال‌سازی**: toggle را روشن کنید
7. **ذخیره**: دکمه "ذخیره همه تنظیمات" را بزنید

---

## 🧪 تست کردن

### حالت Sandbox (توصیه می‌شود)

1. در پنل ادمین، Sandbox Mode را فعال کنید
2. به سایت بروید و یک محصول به سبد خرید اضافه کنید
3. به صفحه Checkout بروید
4. روش پرداخت "آنلاین" را انتخاب کنید
5. روی "تکمیل خرید" کلیک کنید
6. به صفحه ZarinPal/Sadad منتقل می‌شوید
7. از کارت تست استفاده کنید
8. بعد از پرداخت به صفحه نتیجه برمی‌گردید

#### 🧾 کارت‌های تست ZarinPal (Sandbox)

برای تست در حالت Sandbox می‌توانید از هر شماره کارتی استفاده کنید.

---

## 📊 جریان پرداخت

```
┌─────────────┐
│   مشتری    │
│ کلیک روی   │
│  "پرداخت"  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   Backend       │
│ - ایجاد سفارش  │
│ - دریافت Gateway│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Payment Service │
│ (Factory)       │
│ - انتخاب درگاه  │
└──────┬──────────┘
       │
       ├─────────┬─────────┐
       ▼         ▼         ▼
   ZarinPal   Sadad   (Future)
   Strategy  Strategy  Gateways
       │         │
       └────┬────┘
            │
            ▼
   ┌─────────────────┐
   │  Redirect to    │
   │  Gateway Page   │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ User pays       │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Callback to     │
   │ /payment/result │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Backend Verify  │
   │ - Update Order  │
   │ - Set isPaid    │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Show Success    │
   │ with Ref ID     │
   └─────────────────┘
```

---

## 🔐 امنیت

- ✅ تمام اطلاعات احراز هویت در دیتابیس با `select: false` ذخیره می‌شوند
- ✅ در API با `****` mask می‌شوند
- ✅ فقط وقتی مقدار جدید وارد شود به‌روزرسانی می‌شوند
- ✅ HMAC-SHA256 برای Sadad
- ✅ Audit Log برای تمام تراکنش‌ها

---

## ➕ اضافه کردن درگاه جدید

برای اضافه کردن درگاه جدید (مثلاً PayPing):

### 1. Model

```js
// Settings.js
payping: {
  merchantId: { type: String, default: '', select: false },
  isSandbox: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false }
}
```

### 2. Strategy

```js
// utils/payment/payping.js
exports.requestPayment = async ({ amount, config, ... }) => {
  // پیاده‌سازی
}

exports.verifyPayment = async ({ token, config, ... }) => {
  // پیاده‌سازی
}
```

### 3. Factory

```js
// utils/paymentService.js
const payping = require('./payment/payping')
const strategies = { zarinpal, sadad, payping }
```

### 4. Settings Controller

```js
// settingsController.js
if (payment.payping) {
  // Handle PayPing config
}
```

### 5. Admin UI

اضافه کردن کارت PayPing در صفحه `/admin/settings/payment/page.tsx`

---

## 📞 پشتیبانی

در صورت بروز مشکل:

1. لاگ‌های Console را بررسی کنید
2. وضعیت `isActive` درگاه را چک کنید
3. Merchant ID/Terminal ID را بررسی کنید
4. اطمینان حاصل کنید که `FRONTEND_URL` تنظیم شده

---

## ✨ ویژگی‌ها

- ✅ پشتیبانی از چند درگاه همزمان
- ✅ تعویض آسان بین درگاه‌ها
- ✅ Sandbox mode برای تست
- ✅ امنیت بالا
- ✅ UI زیبا و کاربرپسند
- ✅ لاگ کامل تراکنش‌ها
- ✅ پشتیبانی از Toman و Rial
- ✅ پیام‌های خطای فارسی
- ✅ Responsive design

---

## 🎉 تمام!

سیستم پرداخت شما آماده است! فقط کافی است:
1. به پنل ادمین بروید
2. درگاه مورد نظر را انتخاب کنید
3. اطلاعات را وارد کنید
4. ذخیره کنید

**همین!** 🚀
