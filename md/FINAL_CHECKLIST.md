# ✅ چک‌لیست نهایی - سیستم پرداخت

## 🔍 بررسی فایل‌ها

### Backend Files

- [x] `models/Settings.js` - ساختار چندگانه ✅
- [x] `models/Order.js` - فیلدهای درگاه ✅
- [x] `utils/payment/zarinpal.js` - استراتژی ZarinPal ✅
- [x] `utils/payment/sadad.js` - استراتژی Sadad ✅
- [x] `utils/paymentService.js` - Factory Pattern ✅
- [x] `controllers/orderController.js` - Integration ✅
- [x] `controllers/settingsController.js` - Multi-gateway ✅
- [x] `routes/orders.js` - Payment routes ✅
- [x] `package.json` - axios dependency ✅

### Frontend Files

- [x] `admin/settings/layout.tsx` - Tab system ✅
- [x] `admin/settings/page.tsx` - AI settings (existing) ✅
- [x] `admin/settings/payment/page.tsx` - Payment settings ✅
- [x] `checkout/page.tsx` - Payment integration ✅
- [x] `payment/result/page.tsx` - Result page (existing) ✅

### Documentation

- [x] `PAYMENT_SETUP_GUIDE.md` - راهنمای کامل ✅
- [x] `PAYMENT_CHANGES_SUMMARY.md` - خلاصه تغییرات ✅
- [x] `FINAL_CHECKLIST.md` - این فایل ✅

---

## 🚀 مراحل راه‌اندازی

### 1. نصب Dependencies

```bash
cd welfvita-backend
npm install  # axios اضافه شده است
```

✅ axios برای HTTP requests به درگاه‌ها

### 2. راه‌اندازی Backend

```bash
cd welfvita-backend
npm run dev
```

✅ باید روی پورت 5000 اجرا شود

### 3. راه‌اندازی Frontend

```bash
cd frontend
npm run dev
```

✅ باید روی پورت 3000 اجرا شود

### 4. تنظیم Environment Variables

فایل: `welfvita-backend/.env`

```env
FRONTEND_URL=http://localhost:3000
```

✅ برای callback URL

---

## 🎯 تست عملکرد

### ✅ Panel Admin

1. به `http://localhost:3000/admin` بروید
2. با حساب admin وارد شوید
3. روی "تنظیمات" کلیک کنید
4. باید 2 تب ببینید:
   - ✅ "تنظیمات عمومی"
   - ✅ "درگاه‌های پرداخت"
5. روی "درگاه‌های پرداخت" کلیک کنید
6. باید ببینید:
   - ✅ Radio buttons برای انتخاب درگاه
   - ✅ کارت ZarinPal (زرد/نارنجی)
   - ✅ کارت Sadad (آبی)
   - ✅ Toggle های فعال/غیرفعال
   - ✅ Toggle های Sandbox
   - ✅ دکمه "ذخیره همه تنظیمات"

### ✅ تنظیم ZarinPal

1. ZarinPal را به عنوان درگاه فعال انتخاب کنید
2. Merchant ID را وارد کنید (36 کاراکتر)
3. Sandbox را فعال کنید (برای تست)
4. Toggle فعال/غیرفعال را روشن کنید
5. "ذخیره" کنید
6. صفحه reload می‌شود و Merchant ID ماسک می‌شود (****)

### ✅ تست پرداخت (Frontend)

1. به سایت اصلی بروید
2. یک محصول به سبد خرید اضافه کنید
3. به Checkout بروید
4. آدرس را انتخاب کنید
5. روش پرداخت "آنلاین" را انتخاب کنید
6. "تکمیل خرید" را بزنید
7. باید به صفحه ZarinPal منتقل شوید
8. در حالت Sandbox هر شماره کارتی کار می‌کند
9. پرداخت را تکمیل کنید
10. باید به `/payment/result` برگردید
11. باید پیام موفقیت و Ref ID را ببینید

---

## 🔧 عیب‌یابی

### مشکل: پنل ادمین تب "درگاه‌های پرداخت" را نشان نمی‌دهد

**راه حل:**
- مطمئن شوید `admin/settings/layout.tsx` ایجاد شده
- Cache مرورگر را پاک کنید (Ctrl+Shift+R)
- Dev server را restart کنید

### مشکل: خطای "axios is not defined"

**راه حل:**
```bash
cd welfvita-backend
npm install axios
```

### مشکل: خطای "تنظیمات درگاه پرداخت یافت نشد"

**راه حل:**
- از پنل ادمین، درگاه را فعال کنید
- Merchant ID را وارد کنید
- ذخیره کنید

### مشکل: Redirect به درگاه کار نمی‌کند

**راه حل:**
- `FRONTEND_URL` در `.env` را چک کنید
- مطمئن شوید درگاه فعال است (`isActive = true`)
- Console logs را بررسی کنید

### مشکل: "مبلغ نامعتبر است"

**راه حل:**
- مطمئن شوید سفارش مبلغ بیشتر از 0 دارد
- تبدیل تومان به ریال اتوماتیک است (*10)

---

## 📊 API Endpoints

### Payment Endpoints

```
POST /api/orders/:id/pay
- Body: None
- Headers: Authorization: Bearer <token>
- Response: { paymentUrl, authority/token, gateway }
```

```
POST /api/orders/verify-payment
- Body: { Authority, Status } (ZarinPal) یا { Token, ResCode, OrderId } (Sadad)
- Response: { success, refId, orderId, isPaid }
```

### Settings Endpoints

```
GET /api/settings
- Response: { paymentConfig: { activeGateway, zarinpal, sadad } }
```

```
PUT /api/settings
- Body: { paymentConfig: { ... } }
- Response: { success, message }
```

---

## 🎨 UI/UX Features

### Admin Panel

✅ **Tab Navigation**
- نوار تب با آیکون
- Active state highlighting
- Responsive

✅ **Gateway Selection**
- Radio buttons بزرگ
- رنگ‌بندی متفاوت (زرد برای ZarinPal، آبی برای Sadad)
- نمایش وضعیت (فعال/غیرفعال)

✅ **Input Fields**
- Password type با show/hide
- Placeholder راهنما
- Validation

✅ **Toggles**
- Sandbox mode
- Active/Inactive
- Visual feedback

✅ **Info Boxes**
- راهنمای دریافت Merchant ID
- نکات مهم
- رنگ‌بندی معنادار

### User Experience

✅ **Checkout**
- Loading state
- Redirect به درگاه
- Error handling

✅ **Payment Result**
- Success state (سبز، تیک)
- Failure state (قرمز، X)
- Ref ID display
- Action buttons

---

## 🔐 Security Checklist

- [x] Merchant IDs با `select: false` در DB
- [x] Masking در API responses (****)
- [x] HTTPS برای production (توصیه می‌شود)
- [x] HMAC-SHA256 برای Sadad
- [x] Validation در backend
- [x] Audit logging
- [x] Authorization checks
- [x] No secrets در client-side code

---

## 📈 Performance

- [x] Single DB query برای دریافت تنظیمات
- [x] Caching در factory (در حافظه)
- [x] Async/await در همه جا
- [x] Error handling مناسب
- [x] Timeout برای HTTP requests (15s)

---

## 🌍 Production Checklist

قبل از استفاده در Production:

1. **Environment Variables**
   - [ ] `FRONTEND_URL` را به domain واقعی تغییر دهید
   - [ ] SSL certificate نصب کنید

2. **Gateway Settings**
   - [ ] Sandbox را غیرفعال کنید
   - [ ] Merchant ID واقعی را وارد کنید
   - [ ] در Production تست کنید

3. **Security**
   - [ ] HTTPS را فعال کنید
   - [ ] Rate limiting اضافه کنید
   - [ ] Monitoring راه‌اندازی کنید

4. **Database**
   - [ ] Backup منظم
   - [ ] Index optimization

5. **Documentation**
   - [ ] راهنمای کاربر نهایی
   - [ ] API documentation

---

## ✨ نتیجه

✅ **همه چیز آماده است!**

شما می‌توانید:
- به پنل ادمین بروید
- درگاه پرداخت را تنظیم کنید
- شروع به دریافت پرداخت کنید

**موفق باشید!** 🎉
