# رفع باگ محاسبه تخفیف در پنل ادمین

## 🐛 مشکل اصلی

در پنل ادمین، هنگام ویرایش محصولات دارای تخفیف، قیمت اصلی محصول با قیمت تخفیف‌خورده جایگزین می‌شد و در نتیجه:
- قیمت اصلی محصول از بین می‌رفت
- با هر بار ویرایش، تخفیف دوباره روی قیمت تخفیف‌خورده اعمال می‌شد
- قیمت‌ها به صورت نادرست کاهش پیدا می‌کردند

### مثال از مشکل:
```
محصول اصلی: 1,000,000 تومان
تخفیف: 20%

دفعه اول ویرایش:
- قیمت نمایشی: 800,000 تومان (1,000,000 - 20%)
- بعد از ذخیره: قیمت اصلی = 800,000 تومان ❌

دفعه دوم ویرایش:
- قیمت نمایشی: 640,000 تومان (800,000 - 20%)
- بعد از ذخیره: قیمت اصلی = 640,000 تومان ❌
```

## 🔍 تحلیل علت مشکل

### روند باگ:
1. **دریافت محصول برای ویرایش** ([products.js:565-677](ekgkala-backend/routes/products.js#L565-L677))
   - وقتی ادمین محصولی را برای ویرایش باز می‌کرد، بک‌اند تخفیف را محاسبه و اعمال می‌کرد
   - در خطوط 647-650، قیمت اصلی با قیمت تخفیف‌خورده جایگزین می‌شد:
   ```javascript
   const originalPrice = productObj.price
   const discountAmount = (originalPrice * activeSale.discountPercentage) / 100
   productObj.price = originalPrice - discountAmount  // ❌ قیمت اصلی جایگزین میشه
   ```

2. **ذخیره تغییرات** ([ProductForm.jsx:329-431](admin/src/pages/products/ProductForm.jsx#L329-L431))
   - فرم ادمین قیمت تخفیف‌خورده را دریافت می‌کرد
   - این قیمت را به عنوان قیمت جدید محصول ذخیره می‌کرد
   - در نتیجه قیمت اصلی از دست می‌رفت

3. **نمایش لیست محصولات**
   - در لیست محصولات پنل ادمین نیز قیمت‌های تخفیف‌خورده نمایش داده می‌شد
   - این موضوع باعث سردرگمی ادمین می‌شد

## ✅ راه حل پیاده‌سازی شده

### 1. افزودن پارامتر `skipDiscount` به API

#### Backend - فایل `ekgkala-backend/routes/products.js`

**تغییرات در endpoint دریافت تک محصول (GET /api/products/:id):**

```javascript
// ✅ اضافه شده
const skipDiscount = req.query.skipDiscount === 'true';

// If skipDiscount is true, return raw product data without discount calculation
// This is used for admin editing to preserve original prices
if (skipDiscount) {
  return res.json({
    success: true,
    data: productObj,
  })
}
```

**تغییرات در endpoint لیست محصولات (GET /api/products):**

```javascript
// ✅ اضافه شده
const skipDiscount = req.query.skipDiscount === 'true';

// Apply discounts to products (skip if skipDiscount is true for admin panel)
const itemsWithCampaign = skipDiscount ? items : items.map((item) => {
  // محاسبه تخفیف...
})
```

### 2. استفاده از پارامتر در پنل ادمین

#### Frontend - فایل `admin/src/pages/products/ProductForm.jsx`

**دریافت محصول برای ویرایش:**

```javascript
// ✅ FIX: Use skipDiscount=true to get raw product data without discount calculation
// This ensures we get the original price, not the discounted price
const res = await api.get(`/products/${id}?skipDiscount=true`)
```

#### Frontend - فایل `admin/src/pages/products/ProductsList.jsx`

**دریافت لیست محصولات:**

```javascript
// ✅ FIX: Get raw prices for admin panel (without discount calculation)
params.set('skipDiscount', 'true')
```

## 📊 نتیجه

### قبل از رفع باگ:
```
محصول: 1,000,000 تومان با 20% تخفیف

ویرایش 1 → قیمت ذخیره شده: 800,000 تومان ❌
ویرایش 2 → قیمت ذخیره شده: 640,000 تومان ❌
ویرایش 3 → قیمت ذخیره شده: 512,000 تومان ❌
```

### بعد از رفع باگ:
```
محصول: 1,000,000 تومان با 20% تخفیف

ویرایش 1 → قیمت ذخیره شده: 1,000,000 تومان ✅
ویرایش 2 → قیمت ذخیره شده: 1,000,000 تومان ✅
ویرایش 3 → قیمت ذخیره شده: 1,000,000 تومان ✅

قیمت نمایشی برای کاربران: 800,000 تومان ✅
```

## 🎯 مزایای این راه حل

1. **حفظ قیمت اصلی**: قیمت اصلی محصولات در دیتابیس حفظ می‌شود
2. **عدم تغییر رفتار سایت**: کاربران همچنان قیمت‌های تخفیف‌خورده را می‌بینند
3. **سازگاری با سیستم موجود**: نیازی به تغییر ساختار دیتابیس نیست
4. **قابلیت بازگشت**: با حذف پارامتر `skipDiscount` رفتار قبلی برمی‌گردد
5. **شفافیت برای ادمین**: ادمین‌ها قیمت‌های واقعی را می‌بینند

## 🔧 فایل‌های تغییر یافته

### Backend:
- ✅ [ekgkala-backend/routes/products.js](ekgkala-backend/routes/products.js)
  - خط 567-572: افزودن پارامتر skipDiscount به GET /api/products/:id
  - خط 611-618: اعمال شرط skipDiscount
  - خط 204: افزودن پارامتر skipDiscount به GET /api/products
  - خط 437: اعمال شرط skipDiscount در لیست محصولات

- ✅ [ekgkala-backend/middleware/cache.js](ekgkala-backend/middleware/cache.js)
  - خط 22-29: غیرفعال کردن browser & server cache برای درخواست‌های ادمین

### Frontend (Admin Panel):
- ✅ [admin/src/pages/products/ProductForm.jsx](admin/src/pages/products/ProductForm.jsx)
  - خط 101-103: استفاده از skipDiscount در دریافت محصول

- ✅ [admin/src/pages/products/ProductsList.jsx](admin/src/pages/products/ProductsList.jsx)
  - خط 78-79: استفاده از skipDiscount در لیست محصولات

## 🧪 تست و بررسی

### سناریوهای تست:

1. **ایجاد محصول جدید با تخفیف:**
   - ✅ قیمت اصلی صحیح ذخیره شود
   - ✅ درصد تخفیف صحیح اعمال شود

2. **ویرایش محصول با تخفیف:**
   - ✅ قیمت اصلی در فرم نمایش داده شود
   - ✅ قیمت اصلی بعد از ذخیره تغییر نکند
   - ✅ درصد تخفیف قابل ویرایش باشد

3. **تغییر درصد تخفیف:**
   - ✅ با افزایش تخفیف، قیمت اصلی ثابت بماند
   - ✅ با کاهش تخفیف، قیمت اصلی ثابت بماند

4. **نمایش در سایت:**
   - ✅ کاربران قیمت تخفیف‌خورده را ببینند
   - ✅ قیمت اصلی در compareAtPrice نمایش داده شود

5. **نمایش در پنل ادمین:**
   - ✅ لیست محصولات قیمت اصلی را نشان دهد
   - ✅ فرم ویرایش قیمت اصلی را نشان دهد

6. **تست کش (بدون نیاز به پاک کردن):**
   - ✅ محصول را ویرایش کنید و قیمت را تغییر دهید
   - ✅ فقط با رفرش معمولی (F5) صفحه را بارگذاری کنید
   - ✅ تغییرات باید بلافاصله نمایش داده شود
   - ✅ نیازی به Ctrl+Shift+Delete یا Hard Refresh نیست

## 🚫 مشکل دوم: Browser Caching

### مشکل:
بعد از رفع باگ اصلی، مشکل جدیدی پیش آمد:
- تغییرات با موفقیت ذخیره می‌شدند
- اما تنها با **پاک کردن کش مرورگر** نمایش داده می‌شدند
- رفرش معمولی صفحه کافی نبود

### علت:
Server این header را برمی‌گرداند:
```http
Cache-Control: public, max-age=3600
```

این باعث می‌شد مرورگر response را برای ۱ ساعت کش کند. حتی اگر server-side cache پاک می‌شد، مرورگر همچنان از کش محلی خود استفاده می‌کرد!

### راه حل:
در [middleware/cache.js](ekgkala-backend/middleware/cache.js#L22-L29)، برای درخواست‌های ادمین (با `skipDiscount=true`) کش را کاملاً غیرفعال کردیم:

```javascript
if (req.query.skipDiscount === 'true') {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  return next()
}
```

**نتیجه:**
- ✅ تغییرات بلافاصله با رفرش معمولی نمایش داده می‌شوند
- ✅ نیازی به پاک کردن کش مرورگر نیست
- ✅ درخواست‌های عمومی همچنان از کش استفاده می‌کنند (بهینه‌سازی سرعت)

## 📝 نکات مهم

- این تغییرات **فقط** برای پنل ادمین اعمال می‌شود
- سایت اصلی و APIهای عمومی همچنان تخفیف را محاسبه و نمایش می‌دهند
- برای محصولات متغیر (variable products) نیز این رفع باگ کار می‌کند
- محصولاتی که در کمپین‌های فروش (Sales) قرار دارند نیز تحت تاثیر این رفع باگ هستند
- **درخواست‌های ادمین دیگر کش نمی‌شوند** (نه در سرور، نه در مرورگر)

## 🔐 امنیت

- پارامتر `skipDiscount` فقط برای خواندن اطلاعات است
- تغییری در سطح دسترسی یا احراز هویت ایجاد نشده
- همه endpointهای ادمین همچنان نیاز به احراز هویت دارند

---

## 📋 خلاصه تغییرات

### باگ ۱: تخفیف اشتباه روی قیمت اصلی
- **مشکل**: قیمت اصلی با قیمت تخفیف‌خورده جایگزین می‌شد
- **راه حل**: افزودن پارامتر `skipDiscount=true` برای درخواست‌های ادمین

### باگ ۲: کش مرورگر
- **مشکل**: تغییرات فقط با پاک کردن کش نمایش داده می‌شد
- **راه حل**: غیرفعال کردن browser & server cache برای درخواست‌های ادمین

---

**تاریخ رفع باگ:** 2025-12-02
**نسخه:** 2.0.0 (شامل رفع مشکل کش)
**وضعیت:** ✅ تکمیل شده و آماده استفاده
