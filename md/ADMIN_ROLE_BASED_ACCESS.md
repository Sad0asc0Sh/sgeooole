# سیستم دسترسی بر اساس نقش در پنل ادمین

## 🔐 نمای کلی

سیستم پنل ادمین اکنون به طور کامل از **Role-Based Access Control (RBAC)** پشتیبانی می‌کند.

## 👥 نقش‌های موجود

| نقش | توضیحات | دسترسی‌ها |
|-----|---------|-----------|
| **admin** | ادمین معمولی | دسترسی به محصولات، سفارشات، مشتریان، محتوا، تیکت‌ها، گزارشات |
| **manager** | مدیر | همه دسترسی‌های admin + تنظیمات سیستم |
| **superadmin** | مدیر ارشد | دسترسی کامل به همه بخش‌ها شامل مدیریت ادمین‌ها |

## 📊 جدول دسترسی‌های کامل

| بخش | admin | manager | superadmin |
|-----|-------|---------|------------|
| داشبورد | ✅ | ✅ | ✅ |
| محصولات | ✅ | ✅ | ✅ |
| دسته‌بندی‌ها | ✅ | ✅ | ✅ |
| برندها | ✅ | ✅ | ✅ |
| موجودی | ✅ | ✅ | ✅ |
| نظرات | ✅ | ✅ | ✅ |
| سفارشات | ✅ | ✅ | ✅ |
| مرجوعی‌ها | ✅ | ✅ | ✅ |
| سبدهای رها شده | ✅ | ✅ | ✅ |
| مشتریان | ✅ | ✅ | ✅ |
| کدهای تخفیف | ✅ | ✅ | ✅ |
| تخفیف‌های زمان‌دار | ✅ | ✅ | ✅ |
| تنظیمات ارسال | ✅ | ✅ | ✅ |
| مدیریت صفحات | ✅ | ✅ | ✅ |
| وبلاگ | ✅ | ✅ | ✅ |
| بنرها | ✅ | ✅ | ✅ |
| اعلانات | ✅ | ✅ | ✅ |
| تیکت‌ها | ✅ | ✅ | ✅ |
| گزارشات | ✅ | ✅ | ✅ |
| **تنظیمات سیستم** | ❌ | ✅ | ✅ |
| **مدیریت ادمین‌ها** | ❌ | ❌ | ✅ |

## 🛠️ پیاده‌سازی فنی

### 1. محافظت در سطح Routing

**فایل:** `admin/src/App.jsx`

```javascript
{/* Settings - Only for manager and superadmin */}
<Route
  path="/settings"
  element={
    user?.role === 'manager' || user?.role === 'superadmin'
      ? <SettingsPage />
      : <Navigate to="/" />
  }
/>

{/* Admins - Only for superadmin */}
<Route
  path="/admins"
  element={
    user?.role === 'superadmin'
      ? <AdminsPage />
      : <Navigate to="/" />
  }
/>
```

### 2. نمایش شرطی در منو

**فایل:** `admin/src/components/layout/MainLayout.jsx`

```javascript
const isManagerOrSuperAdmin = role === 'manager' || role === 'superadmin'
const isSuperAdmin = role === 'superadmin'

const menuItems = [
  // ... سایر آیتم‌ها

  // Settings - Only for manager and superadmin
  ...(isManagerOrSuperAdmin
    ? [
        {
          key: '/settings',
          icon: <SettingOutlined />,
          label: <Link to="/settings">تنظیمات</Link>,
        },
      ]
    : []),

  // Admins Management - Only for superadmin
  ...(isSuperAdmin
    ? [
        {
          key: '/admins',
          icon: <TeamOutlined />,
          label: <Link to="/admins">مدیریت ادمین‌ها</Link>,
        },
      ]
    : []),
]
```

### 3. منوی کاربر در Header

```javascript
const userMenu = {
  items: [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'پروفایل کاربر',
    },
    // Settings - Only for manager and superadmin
    ...(isManagerOrSuperAdmin
      ? [
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: <Link to="/settings">تنظیمات</Link>,
          },
        ]
      : []),
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'خروج',
    },
  ],
}
```

## 🔒 امنیت چندلایه

سیستم دسترسی در **سه لایه** کنترل می‌شود:

1. **UI Layer (Frontend):**
   - منوها فقط برای نقش‌های مجاز نمایش داده می‌شوند
   - کاربر اصلاً گزینه‌های غیرمجاز را نمی‌بیند

2. **Routing Layer (Frontend):**
   - اگر کاربر مستقیماً URL وارد کند، به Dashboard هدایت می‌شود
   - `<Navigate to="/" />` برای دسترسی‌های غیرمجاز

3. **Backend Layer (API):**
   - در backend هم middleware احراز هویت و مجوز وجود دارد
   - حتی اگر frontend bypass شود، backend دسترسی را رد می‌کند

## 📝 نحوه استفاده

### تغییر نقش کاربر

برای تغییر نقش یک کاربر، از طریق پنل Superadmin:

1. به **مدیریت ادمین‌ها** بروید (فقط superadmin)
2. کاربر مورد نظر را انتخاب کنید
3. نقش را به `admin`, `manager` یا `superadmin` تغییر دهید

### افزودن بخش جدید با محدودیت دسترسی

#### مرحله 1: اضافه کردن Route

```javascript
<Route
  path="/new-section"
  element={
    user?.role === 'superadmin'
      ? <NewSectionPage />
      : <Navigate to="/" />
  }
/>
```

#### مرحله 2: اضافه کردن به منو

```javascript
...(isSuperAdmin
  ? [
      {
        key: '/new-section',
        icon: <SomeIcon />,
        label: <Link to="/new-section">بخش جدید</Link>,
      },
    ]
  : []),
```

## 🐛 رفع مشکل قبلی

### مشکل:
- کاربران با نقش `admin` می‌توانستند منوی "تنظیمات" و "مدیریت ادمین‌ها" را ببینند
- وقتی کلیک می‌کردند، به Dashboard برگردانده می‌شدند
- این باعث سردرگمی کاربر می‌شد

### راه حل:
- ✅ منوها فقط برای نقش‌های مجاز نمایش داده می‌شوند
- ✅ کاربران فقط گزینه‌هایی که دسترسی دارند را می‌بینند
- ✅ تجربه کاربری بهتر و واضح‌تر

## 🧪 تست

برای تست کامل سیستم:

1. **با نقش admin:**
   ```
   - نباید "تنظیمات" در منو باشد ❌
   - نباید "مدیریت ادمین‌ها" در منو باشد ❌
   - دسترسی به /settings → Redirect to / ✅
   - دسترسی به /admins → Redirect to / ✅
   ```

2. **با نقش manager:**
   ```
   - باید "تنظیمات" در منو باشد ✅
   - نباید "مدیریت ادمین‌ها" در منو باشد ❌
   - دسترسی به /settings → نمایش صفحه ✅
   - دسترسی به /admins → Redirect to / ✅
   ```

3. **با نقش superadmin:**
   ```
   - باید "تنظیمات" در منو باشد ✅
   - باید "مدیریت ادمین‌ها" در منو باشد ✅
   - دسترسی به /settings → نمایش صفحه ✅
   - دسترسی به /admins → نمایش صفحه ✅
   ```

## 📌 نکات مهم

1. **Default Role:** اگر role تعیین نشده باشد، به `'user'` تنظیم می‌شود که هیچ دسترسی خاصی ندارد
2. **Case Sensitive:** نقش‌ها case-sensitive هستند (`superadmin` نه `SuperAdmin`)
3. **Token Expiry:** وقتی token منقضی می‌شود، کاربر به صفحه login هدایت می‌شود
4. **Protected Routes:** همه route‌های admin در داخل `<AdminDataProvider>` و `<MainLayout>` هستند

## 🔄 سازگاری با Backend

این سیستم با API Backend هماهنگ است:

**Backend Middleware:**
```javascript
authorize('admin', 'manager', 'superadmin')
```

**Frontend Check:**
```javascript
user?.role === 'manager' || user?.role === 'superadmin'
```

---

**نسخه:** 1.0
**آخرین به‌روزرسانی:** 2025-01-26
**توسعه‌دهنده:** تیم ای‌کا‌جی کالا
