# سیستم پویا برای فوریت سبدهای رها شده

## مشکل قبلی ❌

```javascript
// مقادیر hard-coded بودند
if (remaining.minutes <= 15) {
  // 🔴 قرمز - فوری
} else if (remaining.minutes <= 30) {
  // 🟠 نارنجی - متوسط
}
```

**مشکل:** این مقادیر ثابت بودند و به تنظیمات ادمین توجهی نداشتند!

## راه‌حل جدید ✅

### 1. خواندن تنظیمات از Backend

```javascript
const [settings, setSettings] = useState(null)

const fetchSettings = async () => {
  try {
    const res = await api.get('/settings')
    setSettings(res?.data?.data)
  } catch (err) {
    // استفاده از مقادیر پیش‌فرض
    setSettings({
      cartSettings: {
        cartTTLHours: 1,
        expiryWarningMinutes: 30,
        permanentCart: false,
      },
    })
  }
}
```

### 2. محاسبه پویا آستانه‌های فوریت

```javascript
const getUrgencyIcon = (cart) => {
  const remaining = getTimeRemaining(cart.expiresAt)

  // خواندن زمان هشدار از تنظیمات
  const warningMinutes = settings?.cartSettings?.expiryWarningMinutes || 30

  // محاسبه آستانه فوری = نصف زمان هشدار
  const urgentThreshold = Math.floor(warningMinutes / 2)

  if (remaining.minutes <= urgentThreshold) {
    return { icon: <FireOutlined />, color: '#ff4d4f' } // 🔥 قرمز - فوری
  } else if (remaining.minutes <= warningMinutes) {
    return { icon: <WarningOutlined />, color: '#fa8c16' } // ⚠️  نارنجی - متوسط
  } else {
    return { icon: <ClockCircleOutlined />, color: '#52c41a' } // 🕐 سبز - عادی
  }
}
```

## منطق جدید

### مثال 1: هشدار 30 دقیقه

```
تنظیمات ادمین:
⏰ مهلت سبد: 1 ساعت (60 دقیقه)
🔔 هشدار: 30 دقیقه قبل

محاسبه آستانه‌ها:
📊 urgentThreshold = 30 / 2 = 15 دقیقه
📊 warningMinutes = 30 دقیقه

رنگ‌بندی:
🟢 سبز: بیشتر از 30 دقیقه
🟠 نارنجی: 15 تا 30 دقیقه
🔴 قرمز: کمتر از 15 دقیقه
```

### مثال 2: هشدار 45 دقیقه (B2B)

```
تنظیمات ادمین:
⏰ مهلت سبد: 2 ساعت (120 دقیقه)
🔔 هشدار: 45 دقیقه قبل

محاسبه آستانه‌ها:
📊 urgentThreshold = 45 / 2 = 22.5 ≈ 22 دقیقه
📊 warningMinutes = 45 دقیقه

رنگ‌بندی:
🟢 سبز: بیشتر از 45 دقیقه
🟠 نارنجی: 22 تا 45 دقیقه
🔴 قرمز: کمتر از 22 دقیقه
```

### مثال 3: هشدار 10 دقیقه (فروش فلش)

```
تنظیمات ادمین:
⏰ مهلت سبد: 30 دقیقه
🔔 هشدار: 10 دقیقه قبل

محاسبه آستانه‌ها:
📊 urgentThreshold = 10 / 2 = 5 دقیقه
📊 warningMinutes = 10 دقیقه

رنگ‌بندی:
🟢 سبز: بیشتر از 10 دقیقه
🟠 نارنجی: 5 تا 10 دقیقه
🔴 قرمز: کمتر از 5 دقیقه
```

## تغییرات اعمال شده

### 1. State برای تنظیمات
```javascript
const [settings, setSettings] = useState(null)
```

### 2. Fetch تنظیمات در شروع
```javascript
useEffect(() => {
  fetchSettings()
  fetchAbandonedCarts()
}, [hoursAgo, daysAgo])
```

### 3. استفاده در getExpiryProgress
```javascript
const getExpiryProgress = (cart) => {
  const warningMinutes = settings?.cartSettings?.expiryWarningMinutes || 30
  const urgentThreshold = Math.floor(warningMinutes / 2)

  let status = 'success'
  if (remaining.minutes <= urgentThreshold) {
    status = 'exception' // قرمز
  } else if (remaining.minutes <= warningMinutes) {
    status = 'normal' // نارنجی
  }

  return { percent, status }
}
```

### 4. استفاده در getUrgencyIcon
```javascript
const getUrgencyIcon = (cart) => {
  const warningMinutes = settings?.cartSettings?.expiryWarningMinutes || 30
  const urgentThreshold = Math.floor(warningMinutes / 2)

  if (remaining.minutes <= urgentThreshold) {
    return { icon: <FireOutlined />, color: '#ff4d4f' }
  } else if (remaining.minutes <= warningMinutes) {
    return { icon: <WarningOutlined />, color: '#fa8c16' }
  } else {
    return { icon: <ClockCircleOutlined />, color: '#52c41a' }
  }
}
```

### 5. نمایش آستانه‌ها در UI
```javascript
{settings?.cartSettings && (
  <div style={{ fontSize: '12px', color: '#666' }}>
    🔥 فوری: کمتر از {Math.floor((settings.cartSettings.expiryWarningMinutes || 30) / 2)} دقیقه
    <span style={{ marginRight: 8 }}>|</span>
    ⚠️  متوسط: کمتر از {settings.cartSettings.expiryWarningMinutes || 30} دقیقه
  </div>
)}
```

### 6. Alert پویا در Modal
```javascript
{remaining.minutes <= (settings?.cartSettings?.expiryWarningMinutes || 30) && (
  <div style={{ background: '#fff1f0', border: '1px solid #ffccc7' }}>
    <WarningOutlined />
    <strong>توجه:</strong> این سبد به زودی منقضی می‌شود!
  </div>
)}
```

## جریان کار کامل

```
1️⃣ صفحه بارگذاری می‌شود
   ↓
2️⃣ fetchSettings() فراخوانی می‌شود
   ↓
3️⃣ GET /api/settings → دریافت تنظیمات
   ↓
4️⃣ تنظیمات در state ذخیره می‌شود
   ↓
5️⃣ fetchAbandonedCarts() فراخوانی می‌شود
   ↓
6️⃣ برای هر سبد:
   - getTimeRemaining() → محاسبه زمان باقیمانده
   - getUrgencyIcon() → انتخاب آیکون بر اساس settings
   - getExpiryProgress() → محاسبه progress بر اساس settings
   ↓
7️⃣ UI نمایش داده می‌شود با رنگ‌بندی پویا
   ↓
8️⃣ هر 1 دقیقه refresh می‌شود (settings تغییر نمی‌کند)
```

## مزایا

### ✅ انعطاف‌پذیری کامل
```
ادمین می‌تواند تنظیمات را تغییر دهد:
- Settings → تغییر expiryWarningMinutes
- صفحه Abandoned Carts را refresh کند
- رنگ‌بندی خودکار آپدیت می‌شود
```

### ✅ سازگاری با انواع کسب‌وکار
```
فروش فلش:
  expiryWarningMinutes: 10
  → قرمز: < 5 دقیقه
  → نارنجی: < 10 دقیقه

استاندارد:
  expiryWarningMinutes: 30
  → قرمز: < 15 دقیقه
  → نارنجی: < 30 دقیقه

B2B:
  expiryWarningMinutes: 60
  → قرمز: < 30 دقیقه
  → نارنجی: < 60 دقیقه
```

### ✅ واضح و قابل فهم
```
ادمین می‌بیند:
🔥 فوری: کمتر از 15 دقیقه
⚠️  متوسط: کمتر از 30 دقیقه

این مقادیر مستقیماً از تنظیماتی که خودش انجام داده می‌آیند!
```

### ✅ Fallback هوشمند
```javascript
const warningMinutes = settings?.cartSettings?.expiryWarningMinutes || 30
//                                                                     ^^
//                                        مقدار پیش‌فرض اگر تنظیمات نباشد
```

## تست سیستم

### تست 1: تنظیمات پیش‌فرض
```bash
1. صفحه را بدون تنظیمات باز کن
2. باید ببینی: "🔥 فوری: کمتر از 15 دقیقه"
3. باید ببینی: "⚠️  متوسط: کمتر از 30 دقیقه"
```

### تست 2: تغییر تنظیمات
```bash
1. برو Settings → تنظیمات سبد
2. expiryWarningMinutes را 45 دقیقه کن
3. ذخیره کن
4. برو Abandoned Carts
5. refresh کن
6. باید ببینی: "🔥 فوری: کمتر از 22 دقیقه"
7. باید ببینی: "⚠️  متوسط: کمتر از 45 دقیقه"
```

### تست 3: رنگ‌بندی پویا
```bash
تنظیمات: expiryWarningMinutes = 20

سبد با 25 دقیقه باقیمانده:
✓ باید سبز باشد (> 20)

سبد با 15 دقیقه باقیمانده:
✓ باید نارنجی باشد (10 < x < 20)

سبد با 5 دقیقه باقیمانده:
✓ باید قرمز باشد (< 10)
```

### تست 4: Modal Alert
```bash
تنظیمات: expiryWarningMinutes = 40

سبد با 35 دقیقه باقیمانده:
✓ Alert قرمز باید نمایش داده شود (< 40)

سبد با 50 دقیقه باقیمانده:
✗ Alert نباید نمایش داده شود (> 40)
```

## خطاهای رایج و راه‌حل

### خطا 1: تنظیمات load نمی‌شود
```javascript
// راه‌حل: fallback هوشمند
const warningMinutes = settings?.cartSettings?.expiryWarningMinutes || 30
```

### خطا 2: رنگ‌ها تغییر نمی‌کنند
```bash
مشکل: settings در useEffect بارگذاری نمی‌شود
راه‌حل: fetchSettings() را در useEffect اولیه صدا بزن
```

### خطا 3: نشانگر آستانه‌ها نمایش داده نمی‌شود
```javascript
// چک کن settings null نباشد
{settings?.cartSettings && (
  <div>...</div>
)}
```

## نتیجه‌گیری

سیستم فوریت حالا **کاملاً پویا** است:

✅ از تنظیمات Backend می‌خواند
✅ بر اساس `expiryWarningMinutes` محاسبه می‌کند
✅ آستانه‌ها را به ادمین نشان می‌دهد
✅ رنگ‌بندی خودکار تغییر می‌کند
✅ Fallback هوشمند دارد

**همه چیز مرتبط با هم کار می‌کند!** 🎯✨
