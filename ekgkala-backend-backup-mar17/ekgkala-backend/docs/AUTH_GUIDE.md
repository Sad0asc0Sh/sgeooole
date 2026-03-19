# 🔐 راهنمای Authentication

## ✅ رفع خطا: `Endpoint not found: POST /api/auth/admin/login`

این خطا رفع شد! حالا Backend دارای سیستم کامل Authentication است.

---

## 📦 فایل‌های اضافه شده

```
ekgkala-backend/
├── models/
│   ├── Admin.js                 ✅ جدید - مدل ادمین
│   └── Category.js
├── routes/
│   ├── auth.js                  ✅ جدید - Routes احراز هویت
│   └── categories.js
├── middleware/
│   └── auth.js                  ✅ جدید - Middleware محافظت
├── seedAdmin.js                 ✅ جدید - ساخت ادمین اولیه
└── ...
```

---

## 🚀 نصب و راه‌اندازی

### مرحله 1: نصب Dependencies جدید

```bash
cd ekgkala-backend
npm install
```

**Dependencies جدید:**
- `bcryptjs` - برای hash کردن password
- `jsonwebtoken` - برای JWT authentication

### مرحله 2: تنظیم .env

```bash
# اگر .env ندارید:
cp .env.example .env

# ویرایش .env:
nano .env
```

**محتوای .env:**
```bash
MONGODB_URI=mongodb://localhost:27017/ekgkala
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ⚠️ مهم: JWT Secret را تغییر دهید
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRE=7d
```

### مرحله 3: ساخت ادمین اولیه

```bash
npm run seed
```

**خروجی:**
```
╔════════════════════════════════════════╗
║     ادمین پیش‌فرض ایجاد شد            ║
╚════════════════════════════════════════╝
✅ ادمین با موفقیت ایجاد شد!

📧 Email: admin@ekgkala.com
🔑 Password: admin123

⚠️  توصیه: رمز عبور را بعد از اولین ورود تغییر دهید
```

### مرحله 4: اجرای سرور

```bash
npm run dev
```

**خروجی:**
```
✅ MongoDB متصل شد
🚀 Server running on port 5000
```

---

## 🔑 Endpoints احراز هویت

### 1. Login ادمین

```bash
POST /api/auth/admin/login
Content-Type: application/json

{
  "email": "admin@ekgkala.com",
  "password": "admin123"
}
```

**پاسخ موفق:**
```json
{
  "success": true,
  "message": "ورود موفق",
  "data": {
    "user": {
      "_id": "65abc123...",
      "name": "مدیر سیستم",
      "email": "admin@ekgkala.com",
      "role": "superadmin",
      "isActive": true,
      "createdAt": "2024-01-01T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 2. دریافت اطلاعات کاربر

```bash
GET /api/auth/me
Authorization: Bearer {token}
```

**پاسخ:**
```json
{
  "success": true,
  "data": {
    "_id": "65abc123...",
    "name": "مدیر سیستم",
    "email": "admin@ekgkala.com",
    "role": "superadmin"
  }
}
```

---

### 3. ثبت‌نام ادمین جدید

```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "ادمین جدید",
  "email": "newadmin@ekgkala.com",
  "password": "securepassword123",
  "role": "admin"
}
```

**پاسخ:**
```json
{
  "success": true,
  "message": "ثبت‌نام موفق",
  "data": {
    "user": {...},
    "token": "..."
  }
}
```

---

## 🧪 تست Authentication

### تست 1: Login

```bash
curl -X POST http://localhost:5000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ekgkala.com",
    "password": "admin123"
  }'
```

**نتیجه مورد انتظار:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "token": "eyJ..."
  }
}
```

---

### تست 2: دریافت اطلاعات با Token

```bash
# ابتدا token را از پاسخ login کپی کنید
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**نتیجه مورد انتظار:**
```json
{
  "success": true,
  "data": {
    "name": "مدیر سیستم",
    "email": "admin@ekgkala.com"
  }
}
```

---

## 🔒 محافظت از Routes

اگر می‌خواهید یک route را محافظت کنید:

```javascript
const { protect, authorize } = require('../middleware/auth')

// محافظت ساده (فقط login)
router.get('/protected', protect, (req, res) => {
  res.json({ user: req.user })
})

// محافظت با نقش خاص
router.delete('/admin-only', protect, authorize('superadmin'), (req, res) => {
  // فقط superadmin می‌تواند اجرا کند
})
```

---

## ⚠️ خطاهای رایج

### خطا 1: `email یا رمز عبور نادرست است`

**علت:** Email یا Password اشتباه است

**راه‌حل:**
```bash
# استفاده از اطلاعات پیش‌فرض:
Email: admin@ekgkala.com
Password: admin123
```

---

### خطا 2: `توکن منقضی شده است`

**علت:** Token بعد از 7 روز منقضی می‌شود

**راه‌حل:**
```bash
# Login مجدد کنید تا token جدید بگیرید
```

---

### خطا 3: `Admin model not found`

**علت:** npm install اجرا نشده

**راه‌حل:**
```bash
cd ekgkala-backend
npm install
```

---

## 🔐 امنیت

### 1. Password Hashing
- استفاده از `bcryptjs` با salt=10
- Password هرگز به صورت plain text ذخیره نمی‌شود

### 2. JWT Security
- Token با secret key امضا می‌شود
- Expiration: 7 روز
- Token در localStorage Frontend ذخیره می‌شود

### 3. توصیه‌های Production

```bash
# .env در production:
JWT_SECRET=use-a-very-strong-random-string-at-least-64-characters
NODE_ENV=production

# تغییر رمز ادمین پیش‌فرض:
# بعد از اولین login، حتماً password را تغییر دهید
```

---

## 📊 ساختار Response

### Response موفق:
```json
{
  "success": true,
  "message": "پیام موفقیت",
  "data": {...}
}
```

### Response خطا:
```json
{
  "success": false,
  "message": "توضیح خطا"
}
```

---

## ✅ چک‌لیست

- [ ] `npm install` اجرا شد
- [ ] `.env` تنظیم شد (JWT_SECRET)
- [ ] `npm run seed` اجرا شد
- [ ] ادمین پیش‌فرض ساخته شد
- [ ] `npm run dev` اجراست
- [ ] Login با Postman تست شد
- [ ] Token دریافت شد
- [ ] `/api/auth/me` با token کار می‌کند

---

## 🎯 اتصال به Frontend

Frontend شما باید:

1. Token را از `/api/auth/admin/login` دریافت کند
2. Token را در localStorage ذخیره کند
3. Token را در header همه درخواست‌ها ارسال کند:

```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

این دقیقاً همان کاری است که Frontend شما انجام می‌دهد!

---

**Authentication آماده است! حالا می‌توانید Login کنید! 🎉**
